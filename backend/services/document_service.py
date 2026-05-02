"""Document-level helpers that don't belong to LLM generation or raw retrieval.
- Heading extraction from text
- Topic suggestion for a document (used by the ask greeting flow)
"""
import re

from state.memory_store import consent_state
from services.retrieval_service import fetch_doc_from_node
from utils.extraction import extract_text_for_mimetype

GENERIC_TOPICS = [
    "Introduction", "Overview", "Summary", "Background", "Objectives",
    "Methodology", "Approach", "Results", "Discussion", "Conclusion",
    "Features", "Requirements", "Limitations", "Future Work",
]

_KEYWORD_SET = {k.lower() for k in GENERIC_TOPICS}
_NUM_PAT = re.compile(r"^\d+(?:\.\d+){0,3}\s+.{3,80}$")


def extract_headings_from_text(text: str, limit: int = 6) -> list:
    """Scan raw document text and return likely heading strings."""
    if not text:
        return []
    candidates = []
    seen: set = set()
    for ln in (l.strip() for l in text.splitlines()):
        if not ln or len(ln) > 100:
            continue
        low = ln.lower()
        is_upperish = ln == ln.upper() and 3 <= len(ln) <= 80
        ends_colon = ln.endswith(":") and 3 <= len(ln) <= 80
        looks_numbered = bool(_NUM_PAT.match(ln))
        has_keyword = any(k in low for k in _KEYWORD_SET)
        words = ln.split()
        short_title = 1 <= len(words) <= 8 and ln[0].isupper()
        if looks_numbered or is_upperish or ends_colon or has_keyword or short_title:
            key = low.strip(":")
            if key not in seen:
                seen.add(key)
                candidates.append(ln.strip().rstrip(": ."))
                if len(candidates) >= limit:
                    break
    return candidates


def suggest_topics_for_doc(doc_id: str) -> list:
    """Return topic suggestions for the greeting response.
    Falls back to GENERIC_TOPICS if consent is blocked or fetch fails.
    """
    st = consent_state.get(doc_id) or {}
    if st.get("sensitive") and not st.get("confirmed"):
        return GENERIC_TOPICS[:6]
    try:
        ok, filename, mimetype, data_bytes = fetch_doc_from_node(doc_id)
        if not ok:
            return GENERIC_TOPICS[:6]
        text = extract_text_for_mimetype(filename or "document", mimetype or "", data_bytes or b"")
        heads = extract_headings_from_text(text, limit=6)
        return heads if heads else GENERIC_TOPICS[:6]
    except Exception:
        return GENERIC_TOPICS[:6]
