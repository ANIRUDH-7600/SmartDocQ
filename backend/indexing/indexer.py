import threading
import requests
from db.chroma import collection
from config import SERVICE_TOKEN, CHUNK_UPSERT_URL, NODE_FETCH_TIMEOUT
from state.memory_store import consent_state
from utils.extraction import extract_text_for_mimetype, extract_text_from_pdf_bytes, extract_text_from_docx_bytes, extract_text_from_txt_bytes
from utils.security import detect_sensitive
from services.embedding_service import generate_embeddings
from indexing.chunking import chunk_text, split_sheet_sections


_indexing_in_progress = set()
_indexing_lock = threading.Lock()


def has_index(doc_id: str) -> bool:
    res = collection.get(where={"doc_id": doc_id})
    ids = res.get("ids", [])
    return bool(ids)


def _push_chunks_to_node(doc_id: str, filename: str, chunk_records: list):
    """Best-effort push of chunk texts to Node for keyword/metadata search. Non-fatal on error."""
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
            print("[Chunks Upsert] Node returned", r.status_code, r.text[:200])
    except Exception as e:
        print("[Chunks Upsert] Error:", e)


def _flush_batch(collection_ref, batch_embeddings, batch_documents, batch_metadatas, batch_ids):
    """Upsert a batch into Chroma. Returns updated added count."""
    if not batch_ids:
        return 0
    collection_ref.upsert(
        embeddings=batch_embeddings,
        documents=batch_documents,
        metadatas=batch_metadatas,
        ids=batch_ids,
    )
    return len(batch_ids)


def index_bytes(doc_id: str, filename: str, mimetype: str, data: bytes):
    """Index document bytes by type. Returns (indexed: bool, added_count: int)."""
    text = ""
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")
    if mimetype == "application/pdf" or ext == "pdf":
        text = extract_text_from_pdf_bytes(data)
    elif mimetype in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or ext in ("docx", "doc"):
        text = extract_text_from_docx_bytes(data)
    elif mimetype == "text/plain" or ext == "txt":
        text = extract_text_from_txt_bytes(data)
    else:
        return False, 0

    text = (text or "").strip()
    if not text:
        return False, 0

    try:
        existing = collection.get(where={"doc_id": doc_id}) or {}
        existing_ids = existing.get("ids", []) or []
        if existing_ids:
            collection.delete(ids=existing_ids)
    except Exception:
        pass

    sections = split_sheet_sections(text)
    added = 0
    chunk_records = []
    BATCH_SIZE = 64
    batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    def flush():
        nonlocal added, batch_embeddings, batch_documents, batch_metadatas, batch_ids
        added += _flush_batch(collection, batch_embeddings, batch_documents, batch_metadatas, batch_ids)
        batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    chunk_index = 0
    for sheet_name, body in sections:
        for chunk in chunk_text(body):
            c = (chunk or "").strip()
            if not c:
                continue
            emb = generate_embeddings(c)
            if not emb:
                continue
            batch_embeddings.append(emb)
            batch_documents.append(c)
            meta = {"doc_id": doc_id, "chunk": chunk_index, "filename": filename}
            if sheet_name:
                meta["sheet"] = sheet_name
            batch_metadatas.append(meta)
            batch_ids.append(f"{doc_id}_{chunk_index}")
            try:
                chunk_records.append({"chunk": chunk_index, "sheet": sheet_name or None, "text": c})
            except Exception:
                pass
            chunk_index += 1
            if len(batch_ids) >= BATCH_SIZE:
                flush()

    flush()
    _push_chunks_to_node(doc_id, filename, chunk_records)
    return True, added


def index_text(doc_id: str, filename: str, text: str):
    """Index plain text content for a given document id by replacing existing chunks.
    Returns (indexed: bool, added_count: int).
    """
    text = (text or "").strip()
    if not text:
        return False, 0

    try:
        existing = collection.get(where={"doc_id": doc_id}) or {}
        existing_ids = existing.get("ids", []) or []
        if existing_ids:
            collection.delete(ids=existing_ids)
    except Exception:
        pass

    sections = split_sheet_sections(text)
    added = 0
    chunk_records = []
    BATCH_SIZE = 64
    batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    def flush():
        nonlocal added, batch_embeddings, batch_documents, batch_metadatas, batch_ids
        added += _flush_batch(collection, batch_embeddings, batch_documents, batch_metadatas, batch_ids)
        batch_embeddings, batch_documents, batch_metadatas, batch_ids = [], [], [], []

    chunk_index = 0
    for sheet_name, body in sections:
        for chunk in chunk_text(body):
            c = (chunk or "").strip()
            if not c:
                continue
            emb = generate_embeddings(c)
            if not emb:
                continue
            batch_embeddings.append(emb)
            batch_documents.append(c)
            meta = {"doc_id": doc_id, "chunk": chunk_index, "filename": filename or "document.txt"}
            if sheet_name:
                meta["sheet"] = sheet_name
            batch_metadatas.append(meta)
            batch_ids.append(f"{doc_id}_{chunk_index}")
            try:
                chunk_records.append({"chunk": chunk_index, "sheet": sheet_name or None, "text": c})
            except Exception:
                pass
            chunk_index += 1
            if len(batch_ids) >= BATCH_SIZE:
                flush()

    flush()
    _push_chunks_to_node(doc_id, filename or "document.txt", chunk_records)
    return True, added


def _background_index(doc_id: str):
    from services.retrieval_service import fetch_doc_from_node
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
        index_bytes(doc_id, filename, mimetype, data_bytes)
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
