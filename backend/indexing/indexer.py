import threading
import requests
import re
import logging
import hashlib
from datetime import datetime, timezone
from db.chroma import collection
from config import (
    SERVICE_TOKEN,
    CHUNK_UPSERT_URL,
    NODE_FETCH_TIMEOUT,
    EMBED_MODEL,
    INDEX_PIPELINE_VERSION,
    INDEX_BATCH_SIZE,
)
from state.memory_store import consent_state
from utils.extraction import (
    extract_text_for_mimetype,
    extract_text_from_pdf_bytes,
    extract_text_from_docx_bytes,
    extract_text_from_txt_bytes,
)
from utils.table_extraction import extract_tables_for_file, render_markdown_table, flatten_table_for_embedding
from utils.security import detect_sensitive
from services.embedding_service import generate_embeddings
from services.bm25_service import build_bm25_index, invalidate_bm25_index
from indexing.chunking import chunk_text, split_sheet_sections


logger = logging.getLogger(__name__)


# ===== CONFIG =====
MIN_CHUNK_LEN = 40
MIN_WORDS = 4

# Cap markdown stored in metadata to avoid Chroma bloat.
# This is auxiliary (debug/UI preview) and not retrieval-critical.
MAX_MD_META_LEN = 800
_MD_TRUNC_SUFFIX = "...[truncated]"

_JUNK_PATTERN = re.compile(r"\b(fig\.?|figure|table|page)\b")

# Preserve structured identifier-heavy chunks (teams / academic IDs / mappings).
IDENTIFIER_RE = re.compile(
    r"\b(team\s*\d+|[0-9]{2}[A-Z]{2}[0-9A-Z]+)\b",
    re.IGNORECASE,
)


_indexing_in_progress = set()
_indexing_lock = threading.Lock()


# ===== HELPERS =====

def _truncate_markdown(md: str, *, max_len: int = MAX_MD_META_LEN) -> str:
    try:
        md = "" if md is None else str(md)
    except Exception:
        return ""

    md = md.strip()
    if not md:
        return ""
    if max_len <= 0:
        return _MD_TRUNC_SUFFIX
    if len(md) <= max_len:
        return md

    suffix = _MD_TRUNC_SUFFIX
    keep = max(0, int(max_len) - len(suffix))
    return md[:keep].rstrip() + suffix

def _build_chunk_header(filename: str, sheet_name: str | None = None) -> str:
    """Build a contextual header prepended ONLY to embedding input.

    This improves retrieval quality by anchoring vectors to document-level context
    (and sheet context for spreadsheets), while keeping stored chunk text unchanged.
    """

    filename = (filename or "").strip() or "document"
    parts = [f"Document: {filename}"]
    if sheet_name:
        sheet_name = (sheet_name or "").strip()
        if sheet_name:
            parts.append(f"Sheet: {sheet_name}")
    return "\n".join(parts)

def has_index(doc_id: str) -> bool:
    res = collection.get(where={"doc_id": doc_id})
    ids = res.get("ids", [])
    return bool(ids)


def _delete_existing(doc_id: str):
    # Invalidate the BM25 cache before removing Chroma vectors so queries
    # cannot race against a half-deleted corpus.
    invalidate_bm25_index(doc_id)
    try:
        existing = collection.get(where={"doc_id": doc_id}) or {}
        ids = existing.get("ids", []) or []
        if ids:
            collection.delete(ids=ids)
    except Exception as e:
        logger.warning("Could not delete existing chunks for %s: %s", doc_id, e)


def _push_chunks_to_node(doc_id: str, filename: str, chunk_records: list):
    try:
        if not chunk_records:
            return
        payload = {
            "doc_id": doc_id,
            "filename": filename,
            "chunks": chunk_records,
        }
        headers = {"Content-Type": "application/json", "x-service-token": SERVICE_TOKEN}
        r = requests.post(CHUNK_UPSERT_URL, json=payload, headers=headers, timeout=NODE_FETCH_TIMEOUT)
        if r.status_code >= 300:
            logger.warning(
                "Node chunk upsert returned %s: %s",
                r.status_code,
                (r.text or "")[:200],
            )
    except Exception as e:
        logger.exception("Node chunk upsert failed: %s", e)


def _flush_batch(collection_ref, batch_embeddings, batch_documents, batch_metadatas, batch_ids):
    if not batch_ids:
        return 0
    collection_ref.upsert(
        embeddings=batch_embeddings,
        documents=batch_documents,
        metadatas=batch_metadatas,
        ids=batch_ids,
    )
    return len(batch_ids)


# ===== SMART NOISE FILTER =====

def _is_noise(c: str) -> bool:
    if not c or not c.strip():
        return True

    c = c.strip()
    words = c.split()

    # Preserve structured identifier-heavy chunks.
    if IDENTIFIER_RE.search(c):
        return False

    if len(c) < MIN_CHUNK_LEN and len(words) < MIN_WORDS:
        return True

    if len(words) == 1:
        token = words[0]
        alpha_ratio = sum(ch.isalpha() for ch in token) / max(len(token), 1)
        if alpha_ratio < 0.5:
            return True

    if len(words) <= 3 and _JUNK_PATTERN.search(c.lower()):
        return True

    return False


# ===== CORE INDEXING LOGIC =====

def _index_sections(
    doc_id: str,
    filename: str,
    sections: list,
    chunk_records_out: list,
    file_hash: str | None = None,
) -> tuple[int, int]:
    BATCH_SIZE = INDEX_BATCH_SIZE
    batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []
    added = 0
    chunk_index = 0

    seen = set()  #dedup set

    def flush():
        nonlocal added, batch_embeddings, batch_documents, batch_metadatas, batch_ids
        added += _flush_batch(collection, batch_embeddings, batch_documents, batch_metadatas, batch_ids)
        batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    for sheet_name, body in sections:
        for chunk in chunk_text(body):
            c = (chunk or "").strip()
            if not c:
                continue

            # filter noise
            if _is_noise(c):
                continue

            # normalization + dedup
            norm = " ".join(c.lower().split())
            is_dup = norm in seen
            if not is_dup:
                seen.add(norm)

            # Reserve a stable logical chunk id even if we skip later.
            reserved_chunk_index = chunk_index
            chunk_index += 1

            # Skip duplicates after consuming an index to preserve deterministic ordering.
            if is_dup:
                continue

            # Contextual Chunk Headers (CCH): prepend document/sheet context
            # to the embedding input while keeping the stored chunk text intact.
            header = _build_chunk_header(filename, sheet_name)
            chunk_with_header = f"{header}\n\n{c}"
            emb = generate_embeddings(chunk_with_header)
            if not emb:
                continue

            # Chunk metadata persisted in Chroma.
            # `embedding_model` is critical for detecting incompatible vectors
            # after EMBED_MODEL changes.
            meta = {
                "doc_id": doc_id,
                "chunk": reserved_chunk_index,
                "filename": filename,
                "embedding_model": EMBED_MODEL,
                # ISO 8601 UTC timestamp for observability/debugging.
                "indexed_at": datetime.now(timezone.utc).isoformat(),
                # Allows reindexing when pipeline changes (chunking/cleaning/etc.).
                "pipeline_version": INDEX_PIPELINE_VERSION,
            }

            if file_hash:
                meta["file_hash"] = file_hash
            if sheet_name:
                meta["sheet"] = sheet_name

            # Optional: persist header used for embedding for debugging/traceability.
            meta["chunk_header"] = header

            batch_embeddings.append(emb)
            batch_documents.append(c)
            batch_metadatas.append(meta)
            batch_ids.append(f"{doc_id}_{reserved_chunk_index}")

            chunk_records_out.append({
                "chunk": reserved_chunk_index,
                "sheet": sheet_name or None,
                "text": c
            })

            if len(batch_ids) >= BATCH_SIZE:
                flush()

    flush()
    return added, chunk_index


def _iter_table_row_groups(
    headers: list[str],
    rows: list[list[str]],
    *,
    max_rows_per_group: int = 50,
    max_flat_chars: int = 4500,
    sheet: str | None = None,
) -> list[tuple[int, int, list[list[str]]]]:
    """Return [(row_start, row_end_exclusive, rows_subset), ...].

    Avoid splitting across rows. Uses a simple size heuristic so very large
    tables become multiple chunks.
    """

    if not rows:
        return []

    # Small tables: keep as a single semantic unit.
    flat = flatten_table_for_embedding(sheet=sheet, headers=headers, rows=rows)
    if len(rows) <= max_rows_per_group and len(flat) <= max_flat_chars:
        return [(0, len(rows), rows)]

    groups: list[tuple[int, int, list[list[str]]]] = []
    start = 0
    while start < len(rows):
        end = min(len(rows), start + max_rows_per_group)

        # If the group is still too large text-wise, shrink it.
        while end > start + 1:
            flat_group = flatten_table_for_embedding(sheet=sheet, headers=headers, rows=rows[start:end])
            if len(flat_group) <= max_flat_chars:
                break
            end -= 1

        groups.append((start, end, rows[start:end]))
        start = end

    return groups


def _index_tables(
    doc_id: str,
    filename: str,
    tables: list[dict],
    *,
    start_chunk_index: int,
    chunk_records_out: list,
    file_hash: str | None = None,
) -> int:
    """Index extracted tables as table-derived chunks.

    Embedding input uses the flattened table representation; stored document text
    is also flattened to keep Chroma keyword overlap strong.
    Markdown is preserved in metadata (size-capped) for future UI/debugging.
    """

    if not tables:
        return 0

    BATCH_SIZE = INDEX_BATCH_SIZE
    batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []
    added = 0
    chunk_index = int(start_chunk_index or 0)

    def flush():
        nonlocal added, batch_embeddings, batch_documents, batch_metadatas, batch_ids
        added += _flush_batch(collection, batch_embeddings, batch_documents, batch_metadatas, batch_ids)
        batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    seen_tables: set[str] = set()

    for table_index, t in enumerate(tables):
        headers = list(t.get("headers") or [])
        rows = [list(r) for r in (t.get("rows") or [])]
        if not headers or not rows:
            continue

        sheet_name = t.get("sheet") or None
        table_id = t.get("table_id")

        groups = _iter_table_row_groups(headers, rows, sheet=sheet_name)
        for row_start, row_end, subset in groups:
            md = render_markdown_table(headers, subset)
            flat = flatten_table_for_embedding(sheet=sheet_name, headers=headers, rows=subset)
            if not flat.strip() or not md.strip():
                continue

            md_meta = _truncate_markdown(md)

            # Table-chunk deduplication (ONLY for table-derived chunks).
            norm = " ".join(flat.lower().split())
            is_dup = norm in seen_tables
            if not is_dup:
                seen_tables.add(norm)

            # Reserve a stable logical chunk id even if we skip later.
            reserved_chunk_index = chunk_index
            chunk_index += 1

            # Skip duplicates after consuming an index to preserve deterministic ordering.
            if is_dup:
                continue

            header = _build_chunk_header(filename, sheet_name)
            emb_in = f"{header}\n\n{flat}"
            emb = generate_embeddings(emb_in)
            if not emb:
                continue

            meta = {
                "doc_id": doc_id,
                "chunk": reserved_chunk_index,
                "filename": filename,
                "embedding_model": EMBED_MODEL,
                "indexed_at": datetime.now(timezone.utc).isoformat(),
                "pipeline_version": INDEX_PIPELINE_VERSION,
                "is_table": True,
                "table_id": table_id,
                "table_index": table_index,
                "row_start": row_start,
                "row_end": row_end,
                # Preserve markdown for future UI/debugging while keeping Chroma documents clean.
                "markdown": md_meta,
            }

            if file_hash:
                meta["file_hash"] = file_hash
            if sheet_name:
                meta["sheet"] = sheet_name
            meta["chunk_header"] = header

            batch_embeddings.append(emb)
            batch_documents.append(flat)
            batch_metadatas.append(meta)
            batch_ids.append(f"{doc_id}_{reserved_chunk_index}")

            chunk_records_out.append({
                "chunk": reserved_chunk_index,
                "sheet": sheet_name or None,
                "text": flat,
                "is_table": True,
                "table_id": table_id,
                "table_index": table_index,
                "markdown": md_meta,
            })
            if len(batch_ids) >= BATCH_SIZE:
                flush()

    flush()
    return added


# ===== PUBLIC INDEX FUNCTIONS =====

def index_bytes(
    doc_id: str,
    filename: str,
    mimetype: str,
    data: bytes,
    file_hash: str | None = None,
):
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")

    if mimetype == "application/pdf" or ext == "pdf":
        text = extract_text_from_pdf_bytes(data)
    elif mimetype in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or ext in ("docx", "doc"):
        text = extract_text_from_docx_bytes(data)
    elif mimetype == "text/csv" or ext == "csv":
        # For spreadsheets, the scan/index text is derived from the sheet/table content.
        text = extract_text_for_mimetype(filename, mimetype, data)
    elif mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" or ext == "xlsx":
        text = extract_text_for_mimetype(filename, mimetype, data)
    elif mimetype == "text/plain" or ext == "txt":
        text = extract_text_from_txt_bytes(data)
    else:
        return False, 0

    text = (text or "").strip()

    # Prefer Node-provided hash (sha256 of stored bytes). If absent, compute.
    if file_hash is None and data:
        try:
            file_hash = hashlib.sha256(data).hexdigest()
        except Exception:
            file_hash = None

    # Extract structured tables (CSV/XLSX/DOCX only).
    try:
        tables = extract_tables_for_file(filename, mimetype, data, source_key=doc_id)
    except Exception:
        tables = []

    # Preserve backward compatibility: if a file yields neither text nor tables, treat it as empty/unsupported.
    if not text and not tables:
        return False, 0

    _delete_existing(doc_id)

    sections = split_sheet_sections(text) if text else [(None, "")]
    chunk_records = []

    if text:
        added_text, next_chunk_index = _index_sections(
            doc_id,
            filename,
            sections,
            chunk_records,
            file_hash=file_hash,
        )
    else:
        added_text, next_chunk_index = 0, 0

    added_tables = _index_tables(
        doc_id,
        filename,
        tables,
        start_chunk_index=next_chunk_index,
        chunk_records_out=chunk_records,
        file_hash=file_hash,
    )

    added = added_text + added_tables

    _push_chunks_to_node(doc_id, filename, chunk_records)

    # Build the in-process BM25 index from the same chunk_records that were
    # just pushed to Node.  This runs synchronously but is fast (pure Python
    # tokenization + BM25Okapi construction) and makes the index immediately
    # available for the first query after upload.
    bm25_chunks = [
        {
            "chunk_id": f"{doc_id}_{r['chunk']}",
            "text": r["text"],
            "is_table": bool(r.get("is_table", False)),
        }
        for r in chunk_records
    ]
    build_bm25_index(doc_id, bm25_chunks, file_hash=file_hash)

    return True, added


def index_text(doc_id: str, filename: str, text: str, file_hash: str | None = None):
    """Low-level indexing helper.

    Assumes the caller has already performed:
    - sensitive data detection
    - user consent checks
    - authorization
    """
    text = (text or "").strip()
    if not text:
        return False, 0

    filename = filename or "document.txt"

    _delete_existing(doc_id)

    sections = split_sheet_sections(text)
    chunk_records = []

    added, _next_chunk_index = _index_sections(doc_id, filename, sections, chunk_records, file_hash=file_hash)

    _push_chunks_to_node(doc_id, filename, chunk_records)

    bm25_chunks = [
        {
            "chunk_id": f"{doc_id}_{r['chunk']}",
            "text": r["text"],
            "is_table": bool(r.get("is_table", False)),
        }
        for r in chunk_records
    ]
    build_bm25_index(doc_id, bm25_chunks, file_hash=file_hash)

    return True, added


# ===== BACKGROUND INDEXING =====

def _background_index(doc_id: str):
    from services.retrieval_service import fetch_doc_from_node, fetch_doc_meta_from_node

    try:
        ok, filename, mimetype, data_bytes = fetch_doc_from_node(doc_id)
        if not ok:
            return

        text_for_scan = extract_text_for_mimetype(filename, mimetype, data_bytes)
        if not text_for_scan:
            return

        scan = detect_sensitive(text_for_scan)
        prev = consent_state.get(doc_id) or {}

        consent_state[doc_id] = {
            "sensitive": bool(scan.get("found")),
            "confirmed": bool(prev.get("confirmed", False)),
            "awaiting": False,
            "last_scan": "ok",
            "summary": scan,
        }

        if scan.get("found") and not prev.get("confirmed", False):
            return

        meta = fetch_doc_meta_from_node(doc_id) or {}
        file_hash = meta.get("contentHash")
        index_bytes(doc_id, filename, mimetype, data_bytes, file_hash=file_hash)

    except Exception as e:
        logger.exception("Background indexing failed for %s: %s", doc_id, e)

    finally:
        with _indexing_lock:
            _indexing_in_progress.discard(doc_id)


def start_background_indexing(doc_id: str):
    with _indexing_lock:
        if doc_id in _indexing_in_progress:
            return
        _indexing_in_progress.add(doc_id)

    th = threading.Thread(target=_background_index, args=(doc_id,), daemon=True)
    th.start()