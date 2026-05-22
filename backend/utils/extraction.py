import io
import re
import PyPDF2
from docx import Document as DocxDocument

from utils.table_extraction import extract_tables_for_file, tables_to_scan_text


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
                raw = (p.text or "").strip()
                if not raw:
                    continue
                norm = re.sub(r"\s+", " ", raw).strip()
                if norm:
                    text += norm + "\n"
    except Exception as e:
        print("DOCX extraction error:", e)
    return text


def extract_text_from_txt_bytes(data: bytes) -> str:
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception as e:
        print("TXT extraction error:", e)
        return ""


def extract_text_from_csv_bytes(filename: str, mimetype: str, data: bytes) -> str:
    try:
        tables = extract_tables_for_file(filename, mimetype, data)
        return tables_to_scan_text(tables)
    except Exception as e:
        print("CSV extraction error:", e)
        return ""


def extract_text_from_xlsx_bytes(filename: str, mimetype: str, data: bytes) -> str:
    try:
        tables = extract_tables_for_file(filename, mimetype, data)
        return tables_to_scan_text(tables)
    except Exception as e:
        print("XLSX extraction error:", e)
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
    elif mimetype == "text/csv" or ext == "csv":
        return extract_text_from_csv_bytes(filename, mimetype, data)
    elif mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" or ext == "xlsx":
        return extract_text_from_xlsx_bytes(filename, mimetype, data)
    elif mimetype == "text/plain" or ext == "txt":
        return extract_text_from_txt_bytes(data)
    return ""
