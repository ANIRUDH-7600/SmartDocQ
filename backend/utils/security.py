import re
from better_profanity import profanity
from config import URL_REGEX

profanity.load_censor_words()

# ====== SENSITIVE DATA PATTERNS ======
SENSITIVE_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone": re.compile(r"\b(?:\+?\d{1,3}[\s-]?)?(?:\d{3}[\s-]?){2}\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
    "pan": re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),
    "aadhaar": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "ssn_like": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
}


def detect_sensitive(text: str) -> dict:
    summary = {"found": False, "matches": {}}
    if not text:
        return summary
    any_found = False
    for name, pattern in SENSITIVE_PATTERNS.items():
        try:
            hits = pattern.findall(text)
            if hits:
                any_found = True
                summary["matches"][name] = len(hits)
        except Exception:
            continue
    summary["found"] = any_found
    print("[Sensitive Check] Summary:", {"found": summary["found"], "matches": summary["matches"]})
    return summary


def contains_link(text: str) -> bool:
    return bool(URL_REGEX.search(text))


def contains_profanity(text: str) -> bool:
    return profanity.contains_profanity(text)


# ====== GREETING / SMALL-TALK DETECTION ======
GREET_WORDS = {
    "hi", "hello", "hey", "yo", "hola", "namaste",
    "good morning", "good afternoon", "good evening",
    "gm", "ge", "gn"
}
SMALL_TALK = {"how are you", "what's up", "sup", "howdy"}
WISHES = {"have a nice day", "good day", "good night"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def is_greeting_or_smalltalk(text: str) -> bool:
    s = _norm(text)
    if not s:
        return False
    if len(s) <= 40 and "?" not in s:
        for kw in list(GREET_WORDS) + list(SMALL_TALK) + list(WISHES):
            if s == kw or re.search(rf"(^|\b){re.escape(kw)}(\b|$)", s):
                return True
    for kw in GREET_WORDS:
        if re.search(rf"(^|\b){re.escape(kw)}(\b|$)", s):
            return True
    return False
