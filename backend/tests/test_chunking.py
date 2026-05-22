"""Unit tests for indexing/chunking.py

These tests cover:
- _split_large_para
- chunk_text
- split_sheet_sections

Run:
    cd backend
    python -m pytest tests/test_chunking.py -v
"""

import pytest

from indexing.chunking import (
    _word_boundary_tail,
    _nearest_word_boundary,
    _split_large_para,
    chunk_text,
    split_sheet_sections,
)


# =========================
# _split_large_para
# =========================

def test_split_large_para_exact_multiple():
    text = "a" * 2000
    chunks = _split_large_para(text, 1000)

    assert len(chunks) == 2
    assert all(len(c) == 1000 for c in chunks)


def test_split_large_para_non_multiple():
    text = "a" * 2500
    chunks = _split_large_para(text, 1000)

    assert len(chunks) == 3
    assert len(chunks[0]) == 1000
    assert len(chunks[1]) == 1000
    assert len(chunks[2]) == 500


def test_split_large_para_word_safe_splits_on_spaces():
    text = ("hello world project title " * 50).strip()
    chunks = _split_large_para(text, 120)

    assert len(chunks) > 1
    assert all(chunks)
    assert all(len(c) <= 120 for c in chunks)
    # Since the input has regular single spaces, splitting should be lossless.
    assert " ".join(chunks) == text


# =========================
# chunk_text
# =========================

def test_chunk_text_empty_input():
    assert chunk_text("") == []
    assert chunk_text(None) == []


def test_chunk_text_single_small_paragraph():
    text = "This is a short paragraph."
    chunks = chunk_text(text)

    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_multiple_paragraphs_fit_one_chunk():
    text = "Paragraph one.\n\nParagraph two."
    chunks = chunk_text(text, size=1000)

    assert len(chunks) == 1
    assert "Paragraph one." in chunks[0]
    assert "Paragraph two." in chunks[0]


def test_chunk_text_creates_multiple_chunks():
    p1 = "a" * 600
    p2 = "b" * 600

    chunks = chunk_text(f"{p1}\n\n{p2}", size=1000, overlap=0)

    assert len(chunks) == 2
    assert chunks[0] == p1
    assert chunks[1] == p2


def test_chunk_text_overlap_applied():
    p1 = "a" * 800
    p2 = "b" * 300

    chunks = chunk_text(f"{p1}\n\n{p2}", size=1000, overlap=200)

    assert len(chunks) == 2
    assert chunks[1].startswith("a" * 200)


def test_word_boundary_tail_prefers_paragraph_boundary():
    text = "Intro\n\nProject title and details follow."
    tail = _word_boundary_tail(text, desired_len=30)
    assert tail.startswith("Project title")


def test_word_boundary_tail_moves_forward_to_whitespace():
    text = "hello project title"
    # This cut is intentionally inside "project".
    tail = _word_boundary_tail(text, desired_len=10)
    # Nearest-boundary snapping prefers preserving more identifier context.
    assert tail == "project title"


def test_word_boundary_tail_falls_back_when_no_whitespace():
    text = "aaaaaaaaaabbbbbbbbbbcccccccccc"
    tail = _word_boundary_tail(text, desired_len=10)
    assert tail == text[-10:]


def test_nearest_word_boundary_prefers_backward_on_tie():
    text = "hello project title"
    # cut inside 'project' such that back and forward whitespace are equally distant
    cut = len(text) - 10
    idx = _nearest_word_boundary(text, cut)
    assert idx == text.find(" ") + 1  # position after space after 'hello'


def test_nearest_word_boundary_chooses_forward_when_closer():
    text = "hello project title"
    # A cut very close to the whitespace after 'project' should pick forward
    cut = text.find("title") - 1
    idx = _nearest_word_boundary(text, cut)
    assert idx == text.find(" ", text.find("project"))


def test_word_boundary_tail_preserves_identifier_near_cut():
    text = "Team 47QZ9K2M7P project title mapping"
    # Choose desired_len so the cut lands inside the identifier token.
    tail = _word_boundary_tail(text, desired_len=27)
    assert tail.startswith("47QZ9K2M7P")


def test_word_boundary_tail_paragraph_snap_must_retain_min_overlap():
    # Paragraph boundary exists inside overlap window, but tail after it is tiny.
    text = "alpha beta gamma delta epsilon\n\nX"
    tail = _word_boundary_tail(text, desired_len=20)
    # With MIN_OVERLAP_RATIO=0.5, we should NOT return just 'X'.
    assert tail != "X"
    assert len(tail) >= 10


def test_chunk_text_overlap_uses_word_boundary_tail():
    # Force a split so overlap is used.
    p1 = ("alpha beta project title " * 8).strip()
    p2 = ("next paragraph starts here " * 8).strip()

    chunks = chunk_text(f"{p1}\n\n{p2}", size=250, overlap=60)
    assert len(chunks) == 2

    expected_tail = _word_boundary_tail(chunks[0], 60)
    assert chunks[1].startswith(expected_tail)


def test_chunk_text_large_paragraph_split():
    text = "x" * 2500
    chunks = chunk_text(text, size=1000)

    assert len(chunks) == 3
    assert len(chunks[0]) == 1000
    assert len(chunks[1]) == 1000
    assert len(chunks[2]) == 500


def test_chunk_text_no_empty_chunks():
    text = "\n\n\nParagraph\n\n\n"
    chunks = chunk_text(text)

    assert len(chunks) == 1
    assert chunks[0] == "Paragraph"


# =========================
# split_sheet_sections
# =========================

def test_split_sheet_sections_no_markers():
    text = "Simple text"
    sections = split_sheet_sections(text)

    assert sections == [(None, "Simple text")]


def test_split_sheet_sections_single_sheet():
    text = "# Sheet: Students\nAlice\nBob"
    sections = split_sheet_sections(text)

    assert len(sections) == 1
    assert sections[0][0] == "Students"
    assert "Alice" in sections[0][1]


def test_split_sheet_sections_multiple_sheets():
    text = (
        "# Sheet: Students\n"
        "Alice\nBob\n"
        "# Sheet: Marks\n"
        "95\n88"
    )

    sections = split_sheet_sections(text)

    assert len(sections) == 2
    assert sections[0][0] == "Students"
    assert sections[1][0] == "Marks"


def test_split_sheet_sections_case_insensitive():
    text = "# sheet: Data\nvalue"
    sections = split_sheet_sections(text)

    assert sections[0][0] == "Data"


def test_split_sheet_sections_ignores_empty_sections():
    text = "# Sheet: Empty\n\n# Sheet: Data\nValue"
    sections = split_sheet_sections(text)

    assert len(sections) == 1
    assert sections[0][0] == "Data"


# =========================
# Additional Edge Case Tests
# =========================


def test_chunk_text_no_overlap_when_overlap_zero():
    p1 = "a" * 800
    p2 = "b" * 300

    chunks = chunk_text(f"{p1}\n\n{p2}", size=1000, overlap=0)

    assert len(chunks) == 2
    assert chunks[0] == p1
    assert chunks[1] == p2
    assert not chunks[1].startswith("a" * 200)


def test_chunk_text_large_paragraph_between_small_paragraphs():
    small1 = "Introduction paragraph."
    large = "x" * 2500
    small2 = "Conclusion paragraph."

    text = f"{small1}\n\n{large}\n\n{small2}"
    chunks = chunk_text(text, size=1000)

    # small1 + three large chunks + small2
    assert len(chunks) == 5

    assert chunks[0] == small1
    assert len(chunks[1]) == 1000
    assert len(chunks[2]) == 1000
    assert len(chunks[3]) == 500
    assert chunks[4] == small2


def test_chunk_text_whitespace_only_returns_empty():
    assert chunk_text("   \n\n   ") == []


def test_split_sheet_sections_empty_input():
    assert split_sheet_sections("") == [(None, "")]
    assert split_sheet_sections(None) == [(None, "")]


def test_split_sheet_sections_blank_sheet_name():
    text = "# Sheet:\nValue1\nValue2"
    sections = split_sheet_sections(text)

    assert len(sections) == 1
    assert sections[0][0] is None
    assert "Value1" in sections[0][1]


def test_chunk_text_size_zero_raises_value_error():
    with pytest.raises(ValueError, match="size must be positive"):
        chunk_text("hello", size=0)


def test_chunk_text_negative_overlap_raises_value_error():
    with pytest.raises(ValueError, match="overlap must be non-negative"):
        chunk_text("hello", overlap=-1)


def test_chunk_text_overlap_auto_adjusts_when_overlap_ge_size():
    # overlap >= size should auto-adjust and still behave normally.
    chunks = chunk_text("hello", size=100, overlap=100)
    assert chunks == ["hello"]
