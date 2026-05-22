import re


_PARAGRAPH_SPLITTER = re.compile(r"\n\s*\n")
_SHEET_PATTERN = re.compile(r"^\s*#\s*Sheet:\s*(.*)", re.IGNORECASE)

# Ensure paragraph snapping doesn't reduce overlap too aggressively.
_MIN_OVERLAP_RATIO = 0.5


def _nearest_word_boundary(text: str, cut: int) -> int | None:
    """Return nearest whitespace boundary around cut.

    Prefer the closer boundary; tie-break toward the backward boundary to
    preserve more leading context (useful for identifier-heavy text).
    Returns None if there is no whitespace in the string.
    """

    if not text:
        return None

    if cut <= 0:
        return 0
    if cut >= len(text):
        return len(text)

    # If we're cutting mid-token, prefer the token start so we don't drop
    # the leading part of identifiers/words.
    try:
        if not text[cut].isspace():
            for i in range(cut - 1, -1, -1):
                if text[i].isspace():
                    return i + 1
            # No whitespace anywhere => no word boundary to snap to.
            return None
    except Exception:
        pass

    back: int | None = None
    for i in range(min(cut - 1, len(text) - 1), -1, -1):
        if text[i].isspace():
            back = i
            break

    forward: int | None = None
    for i in range(max(cut, 0), len(text)):
        if text[i].isspace():
            forward = i
            break

    if back is None and forward is None:
        return None
    if back is None:
        return forward
    if forward is None:
        return back + 1

    if (cut - back) <= (forward - cut):
        return back + 1
    return forward


def _word_boundary_tail(text: str, desired_len: int) -> str:
    """Return a clean overlap tail without starting mid-word.

    Strategy order:
    1. Snap to paragraph boundary inside overlap window
    2. Snap to nearest whitespace boundary around the cut
    3. Fallback to raw cut if unavoidable
    """

    if not text or desired_len <= 0:
        return ""

    if len(text) <= desired_len:
        return text

    cut = len(text) - desired_len

    # Strategy 1: paragraph boundary inside overlap (only if it retains enough overlap)
    para_match = re.search(r"\n\s*\n", text[cut:])
    if para_match:
        start = cut + para_match.end()
        tail = text[start:].strip()
        if tail and len(tail) >= int(desired_len * _MIN_OVERLAP_RATIO):
            return tail

    # Strategy 2: snap to nearest whitespace boundary around the cut
    nearest = _nearest_word_boundary(text, cut)
    if nearest is not None:
        cut = nearest

    tail = text[cut:].strip()
    if tail:
        return tail

    # Strategy 3: raw fallback
    return text[-desired_len:].strip()


def _split_large_para(p: str, size: int) -> list[str]:
    """Split very large paragraphs into word-safe chunks."""

    p = (p or "").strip()
    if not p:
        return []

    if len(p) <= size:
        return [p]

    parts: list[str] = []
    start = 0

    while start < len(p):
        end = min(start + size, len(p))

        # Exact fit
        if end >= len(p):
            parts.append(p[start:].strip())
            break

        # Snap backward to nearest whitespace
        snap = p.rfind(" ", start, end)

        # If no whitespace found, fallback to hard cut
        if snap <= start:
            snap = end

        piece = p[start:snap].strip()
        if piece:
            parts.append(piece)

        start = snap

        # Skip leading spaces
        while start < len(p) and p[start].isspace():
            start += 1

    return parts


def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    if size <= 0:
        raise ValueError("size must be positive")
    if overlap < 0:
        raise ValueError("overlap must be non-negative")
    if overlap >= size:
        overlap = size // 2

    text = (text or "").strip()
    if not text:
        return []

    paras = [p.strip() for p in _PARAGRAPH_SPLITTER.split(text) if p.strip()]
    if not paras:
        paras = [text]

    windows = []
    buf = []
    cur_len = 0

    for p in paras:

        # handle large paragraph
        if len(p) > size:
            if buf:
                windows.append("\n\n".join(buf))
                buf = []
                cur_len = 0

            windows.extend(_split_large_para(p, size))
            continue

        p_len = len(p) + 2

        if cur_len + p_len <= size or not buf:
            buf.append(p)
            cur_len += p_len
        else:
            joined = "\n\n".join(buf) 
            windows.append(joined)

            if overlap > 0 and len(joined) > overlap:
                tail = _word_boundary_tail(joined, overlap)
                buf = [tail, p]
                # Account for the '\n\n' separator between `tail` and `p`.
                cur_len = len(tail) + p_len + 2
            else:
                buf = [p]
                cur_len = p_len

    if buf:
        windows.append("\n\n".join(buf))

    return windows


def split_sheet_sections(text: str) -> list:
    lines = (text or "").splitlines()
    sections = []
    current_name = None
    current_lines = []
    found = False

    for ln in lines:
        #regex-based flexible matching
        m = _SHEET_PATTERN.match(ln)
        if m:
            found = True
            if current_lines:
                sections.append((current_name, "\n".join(current_lines).strip()))
                current_lines = []
            current_name = m.group(1).strip() or None
        else:
            current_lines.append(ln)

    if current_lines:
        sections.append((current_name, "\n".join(current_lines).strip()))

    if not found:
        return [(None, text or "")]

    return [(name, body) for (name, body) in sections if (body or "").strip()]