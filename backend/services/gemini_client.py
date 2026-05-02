"""Single place where the Gemini SDK is configured.
Import `genai` and `TEXT_MODEL` from here — never call genai.configure() elsewhere.
"""
import google.generativeai as genai
from config import GEMINI_API_KEY, TEXT_MODEL

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

__all__ = ["genai", "TEXT_MODEL"]
