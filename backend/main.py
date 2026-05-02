from dotenv import load_dotenv
load_dotenv()

import os
from services.gemini_client import genai, TEXT_MODEL
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import ALLOWED_ORIGINS, MAX_CONTENT_LENGTH
from routes.document_routes import document_bp
from routes.ask_routes import ask_bp


# ====== APP FACTORY ======
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

# ====== BLUEPRINTS ======
app.register_blueprint(document_bp)
app.register_blueprint(ask_bp)

# ====== EXTERNAL BLUEPRINTS (quiz, flashcard, summarize) ======
try:
    from quiz import quiz_bp, init_quiz
    from db.chroma import collection
    from indexing.indexer import has_index
    from services.retrieval_service import fetch_doc_from_node
    from utils.extraction import extract_text_for_mimetype

    init_quiz(collection, has_index, fetch_doc_from_node, extract_text_for_mimetype, TEXT_MODEL, genai)
    app.register_blueprint(quiz_bp)
except Exception:
    pass

try:
    from flashcard import flashcard_bp, init_flashcards
    from db import collection
    from indexing.indexer import has_index
    from services.retrieval_service import fetch_doc_from_node
    from utils.extraction import extract_text_for_mimetype

    init_flashcards(collection, has_index, fetch_doc_from_node, extract_text_for_mimetype, TEXT_MODEL, genai)
    app.register_blueprint(flashcard_bp)
except Exception:
    pass

try:
    from summarize import init_summarizer, summarize_bp
    app.register_blueprint(init_summarizer(TEXT_MODEL, genai))
except Exception:
    pass

# ====== ERROR HANDLERS ======
@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(413)
def handle_request_entity_too_large(e):
    return jsonify({"error": "File too large. Max 25 MB."}), 413


@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), getattr(e, "code", 500)
    print("Unhandled Exception:", e)
    return jsonify({"error": str(e)}), 500


# ====== HEALTHCHECK / ROOT ======
@app.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"})


@app.route("/", methods=["GET", "HEAD"])
def root():
    return jsonify({"service": "SmartDocQ Flask", "status": "ok"})


# ====== RUN SERVER ======
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
