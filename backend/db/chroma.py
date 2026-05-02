import os
import chromadb
from config import CHROMA_DB_PATH


def _ensure_dir(p: str) -> str:
    try:
        os.makedirs(p, exist_ok=True)
        return p
    except Exception as e:
        print("[Chroma] Failed to create directory", p, "=>", e)
        return ""


def init_chroma_client():
    env_path = os.path.abspath(CHROMA_DB_PATH)
    if _ensure_dir(env_path):
        try:
            cli = chromadb.PersistentClient(path=env_path)
            print(f"[Chroma] Persistent path: {env_path}")
            return cli
        except Exception as e:
            print("[Chroma] PersistentClient failed for", env_path, "=>", e)

    default_path = os.path.abspath(os.path.join(os.getcwd(), "chroma_db"))
    if _ensure_dir(default_path):
        try:
            cli = chromadb.PersistentClient(path=default_path)
            print(f"[Chroma] Fallback persistent path: {default_path}")
            return cli
        except Exception as e:
            print("[Chroma] PersistentClient failed for default path", default_path, "=>", e)

    try:
        cli = chromadb.EphemeralClient()
        print("[Chroma] Using EphemeralClient (no persistence)")
        return cli
    except Exception as e:
        raise e


chroma_client = init_chroma_client()
collection = chroma_client.get_or_create_collection("documents")
