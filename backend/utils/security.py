import re
from better_profanity import profanity
from config import URL_REGEX
import logging

logger = logging.getLogger(__name__)

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


# ====== LUHN CHECK (for credit cards) ======
def _luhn_check(number: str) -> bool:
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 13:
        return False

    checksum = 0
    reverse = digits[::-1]

    for i, d in enumerate(reverse):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d

    return checksum % 10 == 0


def detect_sensitive(text: str) -> dict:
    summary = {"found": False, "matches": {}}
    if not text:
        return summary

    any_found = False

    for name, pattern in SENSITIVE_PATTERNS.items():
        try:
            hits = pattern.findall(text)
            if not hits:
                continue

            # ===== Credit card special handling =====
            if name == "credit_card":
                valid_hits = []

                for h in hits:
                    clean = "".join(c for c in h if c.isdigit())

                    if _luhn_check(clean):
                        valid_hits.append(h)

                if valid_hits:
                    any_found = True
                    summary["matches"][name] = len(valid_hits)

            else:
                any_found = True
                summary["matches"][name] = len(hits)

        except Exception as e:
            # Prevent silently swallow errors
            logger.warning("Sensitive detection error for %s: %s", name, e)

    summary["found"] = any_found

    # Use debug level
    logger.debug(
        "[Sensitive Check] found=%s matches=%s",
        summary["found"],
        summary["matches"],
    )

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