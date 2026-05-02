import re


def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list:
    """Paragraph-aware chunking with overlap.
    - Prefer splitting on double newlines (paragraphs) to preserve context boundaries.
    - Pack paragraphs into windows up to ~size characters with overlap between windows.
    """
    text = (text or "").strip()
    if not text:
        return []

    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paras:
        paras = [text]

    windows = []
    buf = []
    cur_len = 0
    for p in paras:
        p_len = len(p) + 2
        if cur_len + p_len <= size or not buf:
            buf.append(p)
            cur_len += p_len
        else:
            windows.append("\n\n".join(buf))
            join = "\n\n".join(buf)
            if overlap > 0 and len(join) > overlap:
                tail = join[-overlap:]
                buf = [tail, p]
                cur_len = len(tail) + p_len
            else:
                buf = [p]
                cur_len = p_len
    if buf:
        windows.append("\n\n".join(buf))
    return windows


def split_sheet_sections(text: str) -> list:
    """Split text into sections by lines that start with '# Sheet: <name>'.
    Returns list of tuples (sheet_name, content_str).
    If no markers found, returns [(None, text)].
    """
    lines = (text or "").splitlines()
    sections = []
    current_name = None
    current_lines = []
    found = False

    for ln in lines:
        if ln.startswith("# Sheet: "):
            found = True
            if current_lines:
                sections.append((current_name, "\n".join(current_lines).strip()))
                current_lines = []
            current_name = ln[len("# Sheet: "):].strip() or None
        else:
            current_lines.append(ln)

    if current_lines:
        sections.append((current_name, "\n".join(current_lines).strip()))

    if not found:
        return [(None, text or "")]

    return [(name, body) for (name, body) in sections if (body or "").strip()]
