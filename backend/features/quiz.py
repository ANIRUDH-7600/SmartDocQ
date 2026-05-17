from flask import Blueprint, request, jsonify
import re as _re
import time as _time

# Dependencies to be initialized from main.py
collection = None
has_index = None
fetch_doc_from_node = None
extract_text_for_mimetype = None
TEXT_MODEL = None
genai = None


def init_quiz(_collection, _has_index, _fetch_doc_from_node, _extract_text_for_mimetype, _TEXT_MODEL, _genai):
    global collection, has_index, fetch_doc_from_node, extract_text_for_mimetype, TEXT_MODEL, genai
    collection = _collection
    has_index = _has_index
    fetch_doc_from_node = _fetch_doc_from_node
    extract_text_for_mimetype = _extract_text_for_mimetype
    TEXT_MODEL = _TEXT_MODEL
    genai = _genai


quiz_bp = Blueprint("quiz", __name__)

@quiz_bp.route("/api/document/generate-quiz", methods=["POST", "GET", "OPTIONS"])
def generate_quiz():
    """Generate a quiz based on the uploaded document content.
    Request JSON:
      - doc_id: string (required)
      - num_questions: int (default 10)
      - difficulty: str (easy|medium|hard)
      - question_types: list[str] (subset of [mcq,true_false,short_answer])
    Response JSON: { success, quiz: { questions: [...] } } or { success: false, error }
    """
    if not all([collection, has_index, fetch_doc_from_node, extract_text_for_mimetype, TEXT_MODEL, genai]):
        return jsonify({"success": False, "error": "Quiz service not initialized"}), 500

    # Handle CORS preflight explicitly (some environments disable automatic OPTIONS).
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        body = {
            "doc_id": request.args.get("doc_id") or request.args.get("documentId"),
            "num_questions": request.args.get("num_questions"),
            "difficulty": request.args.get("difficulty"),
            "question_types": request.args.get("question_types"),
        }
    else:
        body = request.get_json(silent=True) or {}

    doc_id = (body.get("doc_id") or body.get("documentId") or "").strip()
    if not doc_id:
        return jsonify({"success": False, "error": "doc_id is required"}), 400
    try:
        num_questions = int(body.get("num_questions", 10))
    except Exception:
        num_questions = 10
    difficulty = (body.get("difficulty") or "medium").lower()

    qtypes = body.get("question_types")
    if isinstance(qtypes, str):
        # Support query-string format: question_types=mcq,true_false,short_answer
        qtypes = [s.strip() for s in qtypes.split(",") if s.strip()]
    qtypes = qtypes or ["mcq", "true_false", "short_answer"]

    # Build context from indexed chunks if available; else fetch raw text
    context = ""
    try:
        if has_index(doc_id):
            res = collection.get(where={"doc_id": doc_id}, include=["documents"], limit=500)
            docs = (res or {}).get("documents") or []
            # flatten if nested
            if docs and isinstance(docs[0], list):
                docs = docs[0]
            context = "\n\n".join(docs)
        else:
            ok, filename, mimetype, data_bytes = fetch_doc_from_node(doc_id)
            if not ok:
                return jsonify({"success": False, "error": filename}), 404
            context = extract_text_for_mimetype(filename, mimetype, data_bytes)
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to load document: {e}"}), 500

    context = (context or "").strip()
    if not context:
        return jsonify({"success": False, "error": "Document has no readable text"}), 400

    # Prompt the model to return a strict JSON quiz
    sys_instr = (
        "You are SmartDoc Quiz Generator. Given the document context, generate a quiz strictly about the content. "
        "Return ONLY valid JSON with schema: {\n"
        "  \"questions\": [\n"
        "    {\n"
        "      \"type\": \"mcq|true_false|short_answer\",\n"
        "      \"question\": string,\n"
        "      \"options\": [string, ...] (required for mcq only),\n"
        "      \"correct_answer\": string,\n"
        "      \"explanation\": string\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "- Ensure there are exactly the requested number of questions.\n"
        "- Ensure all questions are answerable using the context.\n"
        "- For mcq, include 3-5 plausible options.\n"
        "- For true_false, use the strings 'true' or 'false'.\n"
        "- Keep explanations concise and factual.\n"
    )
    def _build_user_instr(to_generate: int, existing_questions: list[str]) -> str:
        avoid_list = "\n".join(f"- {q[:180]}" for q in existing_questions[:50])
        avoid_block = ("Previously generated (avoid duplicates):\n" + avoid_list + "\n\n") if existing_questions else ""
        return (
            f"Difficulty: {difficulty}. Number of questions: {to_generate}. Allowed types: {', '.join(qtypes)}.\n\n"
            + avoid_block +
            "Document Context:\n" + context[:12000]
        )

    try:
        # Prefer structured JSON responses if supported by the SDK
        model = None
        try:
            model = genai.GenerativeModel(
                TEXT_MODEL,
                generation_config={
                    # Ask Gemini to return JSON only. If unsupported, fallback below.
                    "response_mime_type": "application/json",
                    # Tweakables (safe defaults)
                    "temperature": 0.4,
                    "max_output_tokens": 1536,
                },
            )
        except Exception:
            model = genai.GenerativeModel(TEXT_MODEL)

        def _is_transient_llm_error(err: Exception) -> bool:
            msg = str(err or "")
            # Common transient failures: 504 Deadline Exceeded, 503 Service Unavailable, 429 rate limit
            needles = [
                "504",
                "Deadline Exceeded",
                "503",
                "Service Unavailable",
                "429",
                "RESOURCE_EXHAUSTED",
                "Rate limit",
                "rate limit",
                "ECONNRESET",
                "ETIMEDOUT",
                "timeout",
            ]
            return any(n in msg for n in needles)

        def _generate_content_with_retry(parts, timeouts=(30, 45, 60)):
            last_err = None
            for i, t in enumerate(timeouts):
                try:
                    return model.generate_content(parts, request_options={"timeout": int(t)})
                except Exception as e:
                    last_err = e
                    if i >= len(timeouts) - 1 or not _is_transient_llm_error(e):
                        raise
                    # Small backoff before retrying
                    _time.sleep(0.4 * (i + 1))
            raise last_err  # pragma: no cover

        # Avoid hanging requests: limit to ~30s per generate
        def _parse_json_safely(s: str):
            if not s:
                return None
            try:
                return json.loads(s)
            except Exception:
                # Try fenced code blocks ```json ... ```
                m = _re.search(r"```(?:json)?\s*([\s\S]*?)```", s, _re.IGNORECASE)
                if m:
                    inner = m.group(1).strip()
                    try:
                        return json.loads(inner)
                    except Exception:
                        pass
                # Try last {...}
                m2 = _re.search(r"\{[\s\S]*\}", s)
                if m2:
                    try:
                        return json.loads(m2.group(0))
                    except Exception:
                        pass
                return None

        def _generate_batch(to_generate: int, existing_questions: list[str]):
            prompt = _build_user_instr(to_generate, existing_questions)
            resp_local = _generate_content_with_retry([sys_instr, prompt])

            raw_local = ""
            try:
                raw_local = (getattr(resp_local, "text", "") or "").strip()
            except Exception:
                raw_local = ""

            data_local = _parse_json_safely(raw_local)
            if data_local is None:
                try:
                    conv_prompt = (
                        "Convert the following content to valid JSON that matches this schema: "
                        "{\n  \"questions\": [\n    {\n      \"type\": \"mcq|true_false|short_answer\",\n      \"question\": string,\n      \"options\": [string] (for mcq only),\n      \"correct_answer\": string,\n      \"explanation\": string\n    }\n  ]\n}\n"
                        "Respond with JSON only, no extra text.\n\nContent to convert:\n" + (raw_local or "")
                    )
                    resp2 = _generate_content_with_retry(conv_prompt, timeouts=(20, 30, 45))
                    raw2 = (getattr(resp2, "text", "") or "").strip()
                    data_local = _parse_json_safely(raw2)
                except Exception:
                    data_local = None

            if not isinstance(data_local, dict):
                return []
            items = data_local.get("questions")
            return items if isinstance(items, list) else []

        import json

        # Iteratively request until we reach the target or run out of attempts.
        qs = []
        seen_questions = set()
        attempts = 3
        remaining = num_questions

        while remaining > 0 and attempts > 0:
            attempts -= 1
            existing_questions = [q["question"] for q in qs]
            batch = _generate_batch(min(remaining, 10), existing_questions)
            if not batch:
                break

            # Basic sanitize and trim
            added_this_round = 0
            for q in batch:
                if not isinstance(q, dict):
                    continue
                qtype = str(q.get("type", "")).strip().lower()
                if qtype not in ("mcq", "true_false", "short_answer"):
                    continue
                question = str(q.get("question", "")).strip()
                if not question:
                    continue
                if question in seen_questions:
                    continue

                correct = q.get("correct_answer", "")
                if qtype == "true_false":
                    correct = str(correct).strip().lower()
                    if correct not in ("true", "false"):
                        # Try to coerce booleans
                        if str(correct).strip().lower() in ("t", "yes", "y", "1"):
                            correct = "true"
                        elif str(correct).strip().lower() in ("f", "no", "n", "0"):
                            correct = "false"
                        else:
                            continue
                else:
                    correct = str(correct).strip()
                    if not correct:
                        continue

                item = {
                    "type": qtype,
                    "question": question,
                    "correct_answer": correct,
                    "explanation": str(q.get("explanation", "")).strip(),
                }

                if qtype == "mcq":
                    opts = q.get("options") or []
                    if not isinstance(opts, list):
                        opts = []
                    # Normalize options to strings and include the correct answer if missing
                    norm_opts = []
                    for o in opts:
                        s = str(o).strip()
                        if s:
                            norm_opts.append(s)
                    if str(correct) not in norm_opts:
                        norm_opts.append(str(correct))
                    # Ensure 3-5 options; dedupe while preserving order
                    seen_options = set()
                    dedup = []
                    for o in norm_opts:
                        if o not in seen_options:
                            dedup.append(o)
                            seen_options.add(o)
                    item["options"] = dedup[:5]
                    if len(item["options"]) < 3:
                        # Skip if insufficient options
                        continue

                qs.append(item)
                seen_questions.add(question)
                added_this_round += 1
                if len(qs) >= num_questions:
                    break

            remaining = num_questions - len(qs)
            if added_this_round == 0:
                break

        if not qs:
            return jsonify({"success": False, "error": "No valid questions could be constructed from the model output."}), 502

        return jsonify({"success": True, "quiz": {"questions": qs}})
    except Exception as e:
        return jsonify({"success": False, "error": f"Quiz generation failed: {e}"}), 500
