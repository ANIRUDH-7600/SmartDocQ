# Single source of truth for all in-memory per-document state.
# In production, replace these dicts with Redis or a DB-backed store.

# Consent state per document.
# Shape: { doc_id: { "sensitive": bool, "confirmed": bool, "awaiting": bool,
#                    "last_scan": str, "summary": dict } }
consent_state: dict = {}

# General-knowledge fallback state per document.
# Shape: { doc_id: { "awaiting": bool, "pending_question": str } }
general_fallback: dict = {}
