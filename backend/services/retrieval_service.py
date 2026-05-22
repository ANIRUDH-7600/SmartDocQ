"""
Retrieval service.
Responsible for:
  - Fetching raw documents from the Node API
  - Vector search + keyword re-ranking against ChromaDB
Routes should call retrieve_context() and get back plain text — no query logic in routes.
"""
import re
import requests
import logging
import threading
import time

from config import NODE_BASE_URL, SERVICE_TOKEN, NODE_FETCH_TIMEOUT
from db.chroma import collection
from services.embedding_service import generate_embeddings

logger = logging.getLogger(__name__)


# --- Node document metadata TTL cache ---
# Used to avoid one synchronous Node HTTP call per question.
# Fail-open: any cache errors should fall back to a direct fetch.
_DOC_META_CACHE_TTL = 300  # 5 minutes
_doc_meta_cache: dict[str, dict] = {}
_doc_meta_cache_lock = threading.Lock()

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "of", "in", "on", "to", "for",
    "is", "are", "was", "were", "be", "with", "by", "at", "from",
    "as", "that", "this", "it", "its", "if", "then", "than", "into",
    "about", "over", "under", "within", "between",
}


def _normalize_numeric_tokens(text: str) -> str:
    return re.sub(r"\b0+(\d+)\b", r"\1", text or "")


def _keywords(s: str) -> set:
    normalized = _normalize_numeric_tokens(s or "")
    toks = re.split(r"[^A-Za-z0-9]+", normalized.lower())
    return {
        t
        for t in toks
        if t
        and (len(t) >= 2 or t.isdigit())
        and t not in _STOP_WORDS
    }


_TABLE_Q_TERMS = {
    "table",
    "row",
    "rows",
    "column",
    "columns",
    "highest",
    "lowest",
    "average",
    "avg",
    "mean",
    "median",
    "total",
    "sum",
    "compare",
    "percentage",
    "percent",
    "statistics",
    "stats",
    "values",
}


_EXPLICIT_TABLE_HINTS = {
    "table",
    "tables",
    "row",
    "rows",
    "column",
    "columns",
    "spreadsheet",
    "xlsx",
    "csv",
}


def _table_intent_strength(question: str) -> int:
    """Return 0 (none), 1 (weak), 2 (explicit).

    Keep it cheap and robust: no external parsers, no heavy NLP.
    """

    q = (question or "").lower().strip()
    if not q:
        return 0

    # Explicit mentions of tables/spreadsheets are strong signals.
    if any(h in q for h in _EXPLICIT_TABLE_HINTS):
        return 2

    # Aggregation/comparison verbs are weaker hints (could be narrative text too).
    if any(t in q for t in _TABLE_Q_TERMS):
        return 1

    return 0


def retrieve_context(question: str, doc_id: str) -> tuple[str | None, str | None]:
    """Embed the question, query ChromaDB, re-rank with keyword overlap."""

    q_emb = generate_embeddings(question)
    if not q_emb:
        logger.error("[Retrieval] Embedding failed")
        return None, "Failed to generate embedding"

    results = collection.query(
        query_embeddings=[q_emb],
        n_results=12,
        where={"doc_id": doc_id},
        include=["documents", "distances", "metadatas"],
    )

    docs = results.get("documents", [[]])[0] or []
    dists = results.get("distances", [[]])[0] or []
    metas = results.get("metadatas", [[]])[0] or []

    q_terms = _keywords(question)

    table_intent = _table_intent_strength(question)

    candidates: list[dict] = []
    for i, (doc_txt, dist) in enumerate(zip(docs, dists)):
        meta = metas[i] if i < len(metas) and isinstance(metas[i], dict) else {}
        if not doc_txt:
            continue

        if dist is None:
            dist = 0.5  # normalize

        # Temporary distance logging (requested for debugging).
        print(f"DIST: {dist}")

        overlap = len(q_terms & _keywords(doc_txt))
        sim = 1.0 - max(0.0, min(1.0, dist))
        score = 0.7 * sim + 0.3 * (overlap / (len(q_terms) or 1))

        # Lightweight table-aware boosting.
        if table_intent:
            try:
                is_table = bool(meta and meta.get("is_table"))
            except Exception:
                is_table = False

            # Explicit table intent: boost tables more, penalize non-tables slightly.
            if table_intent >= 2:
                score *= 1.30 if is_table else 0.93
            # Weak table intent: mild preference.
            else:
                score *= 1.15 if is_table else 0.99

        logger.info(
            "[Retrieval Candidate] "
            "dist=%.4f overlap=%s score=%.4f table=%s text=%s",
            dist,
            overlap,
            score,
            meta.get("is_table") if isinstance(meta, dict) else False,
            repr(doc_txt[:180]),
        )

        candidates.append(
            {
                "text": doc_txt,
                "metadata": meta,
                "score": score,
                "distance": dist,
            }
        )

    if not candidates:
        logger.warning("[Retrieval] No candidates found for doc_id={doc_id}")
        return None, None

    # Sort by hybrid score (descending)
    candidates.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)


    strong = [c for c in candidates if (c.get("distance") is not None and float(c.get("distance")) < 0.6)]
    weak = [c for c in candidates if (c.get("distance") is not None and float(c.get("distance")) < 0.9)]

    if not strong and weak:
        logger.info("[Retrieval] Fallback to weak matches for doc_id={doc_id}")

    if not strong and not weak:
        logger.warning("[Retrieval] No matches passed thresholds for doc_id={doc_id}")

    selected = strong[:5] if strong else weak[:5]

    logger.info(
        "[Retrieval Selected] count=%s strong=%s weak=%s",
        len(selected),
        len(strong),
        len(weak),
    )

    chosen = [c.get("text") for c in selected if c.get("text")]

    if not chosen:
        return None, None

    return "\n\n".join(chosen), None


def fetch_doc_from_node(doc_id: str):
    """Fetch binary document from Node API /api/document/:id/download."""
    try:
        url = f"{NODE_BASE_URL}/api/document/{doc_id}/download"
        headers = {"x-service-token": SERVICE_TOKEN}
        r = requests.get(url, headers=headers, timeout=NODE_FETCH_TIMEOUT)

        if r.status_code != 200:
            return False, f"Node returned {r.status_code}", None, None

        disp = r.headers.get("Content-Disposition", "")
        filename = "document"

        if "filename=" in disp:
            filename = disp.split("filename=")[-1].strip('"')

        mimetype = r.headers.get("Content-Type", "application/octet-stream")

        return True, filename, mimetype, r.content

    except Exception:
        logger.exception("[Retrieval] Failed to fetch document from Node API")
        return False, "Failed to fetch document", None, None


def fetch_doc_meta_from_node(doc_id: str):
    """Fetch document metadata from Node.

    Expected keys (best-effort; depends on Node version):
      - contentHash: sha256 hex digest of the stored file bytes
      - sensitiveFound: whether sensitive data was detected
      - consentConfirmed: whether user consent was confirmed

    Notes:
      - Returns None if the Node endpoint is unavailable.
      - Callers must be backward compatible with missing keys.
    """

    try:
        url = f"{NODE_BASE_URL}/api/document/{doc_id}/_meta"
        headers = {"x-service-token": SERVICE_TOKEN}
        r = requests.get(url, headers=headers, timeout=NODE_FETCH_TIMEOUT)

        if r.status_code != 200:
            return None

        return r.json()

    except Exception:
        return None


def get_cached_doc_meta(doc_id: str) -> dict | None:
    """Return cached Node document metadata for doc_id if not expired."""

    try:
        doc_id = (doc_id or "").strip()
        if not doc_id:
            return None

        now = time.time()
        with _doc_meta_cache_lock:
            entry = _doc_meta_cache.get(doc_id)
            if not isinstance(entry, dict):
                return None
            expires_at = entry.get("expires_at")
            if not isinstance(expires_at, (int, float)):
                _doc_meta_cache.pop(doc_id, None)
                return None
            if now >= float(expires_at):
                _doc_meta_cache.pop(doc_id, None)
                return None

            data = entry.get("data")
            return data if isinstance(data, dict) else None

    except Exception:
        return None


def set_cached_doc_meta(doc_id: str, meta: dict):
    """Store Node metadata for doc_id with TTL. Safe no-op on invalid input."""

    try:
        doc_id = (doc_id or "").strip()
        if not doc_id or not isinstance(meta, dict):
            return

        with _doc_meta_cache_lock:
            _doc_meta_cache[doc_id] = {
                "data": meta,
                "expires_at": time.time() + _DOC_META_CACHE_TTL,
            }
    except Exception:
        return


def invalidate_cached_doc_meta(doc_id: str):
    """Remove cache entry for doc_id if it exists."""

    try:
        doc_id = (doc_id or "").strip()
        if not doc_id:
            return
        with _doc_meta_cache_lock:
            _doc_meta_cache.pop(doc_id, None)
    except Exception:
        return


def fetch_doc_meta_cached(doc_id: str) -> dict:
    """Fetch Node metadata with TTL caching.

    Returns {} on failure.
    """

    try:
        cached = get_cached_doc_meta(doc_id)
        if isinstance(cached, dict):
            return cached

        meta = fetch_doc_meta_from_node(doc_id)
        if isinstance(meta, dict):
            set_cached_doc_meta(doc_id, meta)
            return meta

        return {}
    except Exception:
        # Fail open: keep behavior similar to callers using fetch_doc_meta_from_node.
        return {}