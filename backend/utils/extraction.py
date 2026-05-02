import io
import PyPDF2
from docx import Document as DocxDocument


def extract_text_from_pdf_bytes(data: bytes) -> str:
    text = ""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        for page in reader.pages:
            content = page.extract_text() or ""
            text += content + "\n"
    except Exception as e:
        print("PDF extraction error:", e)
    return text


def extract_text_from_docx_bytes(data: bytes) -> str:
    text = ""
    try:
        with io.BytesIO(data) as f:
            doc = DocxDocument(f)
            for p in doc.paragraphs:
                text += p.text + "\n"
    except Exception as e:
        print("DOCX extraction error:", e)
    return text


def extract_text_from_txt_bytes(data: bytes) -> str:
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception as e:
        print("TXT extraction error:", e)
        return ""


def extract_text_for_mimetype(filename: str, mimetype: str, data: bytes) -> str:
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")
    if mimetype == "application/pdf" or ext == "pdf":
        return extract_text_from_pdf_bytes(data)
    elif mimetype in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or ext in ("docx", "doc"):
        return extract_text_from_docx_bytes(data)
    elif mimetype == "text/plain" or ext == "txt":
        return extract_text_from_txt_bytes(data)
    return ""
