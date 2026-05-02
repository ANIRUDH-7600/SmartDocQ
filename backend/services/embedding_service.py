import concurrent.futures
import google.generativeai as genai
from config import GEMINI_API_KEY, EMBED_MODEL

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _embed_call(text: str):
    return genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_document"
    )


def generate_embeddings(text: str, timeout_sec: int = 20):
    """Generate embeddings with a timeout to avoid hanging requests."""
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(_embed_call, text)
            result = fut.result(timeout=timeout_sec)
            return result.get("embedding") if isinstance(result, dict) else None
    except concurrent.futures.TimeoutError:
        print("Embedding timeout after", timeout_sec, "seconds")
        return None
    except Exception as e:
        print("Embedding error:", e)
        return None
