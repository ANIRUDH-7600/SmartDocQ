"""LLM generation layer.
Responsible for: building prompts and calling Gemini.
NOT responsible for: retrieval, ranking, topic suggestion, or state management.
"""
from services.gemini_client import genai, TEXT_MODEL


def generate_answer_from_context(question: str, context: str) -> str | None:
    """Generate a document-grounded answer using only the supplied context."""
    prompt = f"""You are a document assistant. Use ONLY the context below to answer the question.
Do NOT include anything that is not in the context.

Please format your response clearly with:
- Proper line breaks between paragraphs
- Use bullet points or numbered lists when appropriate
- Break up long text into readable paragraphs
- Add spacing for better readability

Context:
{context}

Question: {question}

Answer strictly from the context with proper formatting:
"""
    model = genai.GenerativeModel(TEXT_MODEL)
    response = model.generate_content(prompt, request_options={"timeout": 30})
    if response and response.text:
        return response.text.strip()
    return None


def generate_general_answer(question: str) -> str | None:
    """Generate a general-knowledge answer when no document context is available."""
    prompt = f"""You are a helpful assistant. Provide a clear, accurate answer to the user's question below.

Question: {question}
"""
    model = genai.GenerativeModel(TEXT_MODEL)
    try:
        response = model.generate_content(prompt)
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as e:
        print("General fallback error:", e)
        return None
