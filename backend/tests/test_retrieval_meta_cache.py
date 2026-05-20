import threading

import pytest


@pytest.fixture(autouse=True)
def _reset_meta_cache(monkeypatch):
    # Import inside fixture so we can reset module state per test.
    from services import retrieval_service

    # Clear cache state before each test.
    with retrieval_service._doc_meta_cache_lock:
        retrieval_service._doc_meta_cache.clear()

    # Set a deterministic default TTL for tests.
    monkeypatch.setattr(
        retrieval_service,
        "_DOC_META_CACHE_TTL",
        300,
        raising=False,
    )

    yield

    # Clear cache state again after each test.
    with retrieval_service._doc_meta_cache_lock:
        retrieval_service._doc_meta_cache.clear()


def test_cache_miss_triggers_underlying_fetch(monkeypatch):
    from services import retrieval_service

    calls = {"n": 0}

    def fake_fetch(doc_id):
        calls["n"] += 1
        return {"contentHash": "h1"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    meta = retrieval_service.fetch_doc_meta_cached("doc1")

    assert meta.get("contentHash") == "h1"
    assert calls["n"] == 1


def test_cache_hit_avoids_repeated_fetch(monkeypatch):
    from services import retrieval_service

    calls = {"n": 0}

    def fake_fetch(doc_id):
        calls["n"] += 1
        return {"contentHash": "h1"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    meta1 = retrieval_service.fetch_doc_meta_cached("doc1")
    meta2 = retrieval_service.fetch_doc_meta_cached("doc1")

    assert meta1.get("contentHash") == "h1"
    assert meta2.get("contentHash") == "h1"
    assert calls["n"] == 1


def test_expired_entry_is_refreshed(monkeypatch):
    from services import retrieval_service

    now = {"t": 1000.0}

    def fake_time():
        return now["t"]

    # Control time deterministically instead of sleeping.
    monkeypatch.setattr(retrieval_service.time, "time", fake_time)

    calls = {"n": 0}

    def fake_fetch(doc_id):
        calls["n"] += 1
        return {"contentHash": f"h{calls['n']}"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    # First fetch caches h1.
    meta1 = retrieval_service.fetch_doc_meta_cached("doc1")
    assert meta1.get("contentHash") == "h1"
    assert calls["n"] == 1

    # Advance beyond TTL so the cached entry expires.
    now["t"] += retrieval_service._DOC_META_CACHE_TTL + 1

    # Second fetch should refresh and return h2.
    meta2 = retrieval_service.fetch_doc_meta_cached("doc1")
    assert meta2.get("contentHash") == "h2"
    assert calls["n"] == 2


def test_invalidate_cached_doc_meta_removes_entry(monkeypatch):
    from services import retrieval_service

    calls = {"n": 0}

    def fake_fetch(doc_id):
        calls["n"] += 1
        return {"contentHash": f"h{calls['n']}"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    # First fetch caches h1.
    assert retrieval_service.fetch_doc_meta_cached("doc1")["contentHash"] == "h1"

    # Explicit invalidation removes the entry.
    retrieval_service.invalidate_cached_doc_meta("doc1")

    # Next fetch should hit the underlying fetch again and return h2.
    assert retrieval_service.fetch_doc_meta_cached("doc1")["contentHash"] == "h2"
    assert calls["n"] == 2


def test_blank_doc_id_is_handled_safely(monkeypatch):
    from services import retrieval_service

    calls = {"n": 0}

    def fake_fetch(_doc_id):
        calls["n"] += 1
        return {"contentHash": "h"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    # Cache helper treats blank doc_id as a cache miss.
    assert retrieval_service.get_cached_doc_meta("") is None

    # fetch_doc_meta_cached delegates to the underlying fetch even for blank IDs.
    assert retrieval_service.fetch_doc_meta_cached("") == {"contentHash": "h"}

    # Underlying fetch is called once.
    assert calls["n"] == 1


def test_failed_fetch_is_cached_if_it_returns_empty_dict(monkeypatch):
    from services import retrieval_service

    calls = {"n": 0}

    def fake_fetch(doc_id):
        calls["n"] += 1
        return {}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    # First call stores {} in the cache.
    assert retrieval_service.fetch_doc_meta_cached("doc1") == {}

    # Second call should hit the cache.
    assert retrieval_service.fetch_doc_meta_cached("doc1") == {}

    # Only one underlying fetch occurs because {} is cached.
    assert calls["n"] == 1


def test_concurrent_cache_miss_is_thread_safe(monkeypatch):
    """
    Two threads hitting the same cache miss simultaneously should:
    1. Return valid metadata to both callers.
    2. Populate the cache correctly.
    3. Trigger at least one underlying fetch.
    4. Trigger at most two fetches (acceptable without single-flight protection).
    """
    from services import retrieval_service

    calls = {"n": 0}
    start_barrier = threading.Barrier(2)

    def fake_fetch(doc_id):
        # Synchronize both threads so they race on the cache miss path.
        start_barrier.wait()
        calls["n"] += 1
        return {"contentHash": "h1"}

    monkeypatch.setattr(
        retrieval_service,
        "fetch_doc_meta_from_node",
        fake_fetch,
    )

    results = []

    def worker():
        results.append(retrieval_service.fetch_doc_meta_cached("doc1"))

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)

    t1.start()
    t2.start()
    t1.join(timeout=5)
    t2.join(timeout=5)

    # Ensure both threads completed.
    assert not t1.is_alive()
    assert not t2.is_alive()

    # Both threads should receive valid metadata.
    assert len(results) == 2
    assert all(result.get("contentHash") == "h1" for result in results)

    # Depending on timing, the underlying fetch may run once or twice.
    # (Without a single-flight guard, two concurrent misses are acceptable.)
    assert 1 <= calls["n"] <= 2

    # Cache should be populated for subsequent reads.
    cached = retrieval_service.get_cached_doc_meta("doc1")
    assert cached is not None
    assert cached.get("contentHash") == "h1"