"""
Central configuration loaded from environment variables (.env).

Every service reads from this single Settings object instead of calling
os.getenv directly, so configuration is consistent and easy to mock in tests.
"""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the repo root or backend/ if present. Safe to call repeatedly.
load_dotenv()

# Repo root = two levels up from this file (backend/config.py -> repo root).
REPO_ROOT = Path(__file__).resolve().parents[1]


class Settings:
    """Typed accessor over environment variables with sensible defaults."""

    def __init__(self) -> None:
        # --- LLM (Groq) — used by sentiment / translator / intent classifier ---
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "")
        # Model is overridable so we can swap when Groq rotates model names.
        self.groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

        # --- RAG (Gemini via Google AI Studio) ---
        # Document Q&A runs in-process: Gemini embeddings + ChromaDB + Gemini LLM.
        self.google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
        self.embedding_model: str = os.getenv(
            "EMBEDDING_MODEL", "models/gemini-embedding-001"
        )
        self.chroma_db_path: str = os.getenv(
            "CHROMA_DB_PATH", str(REPO_ROOT / "chroma_db")
        )

        # --- Documents ---
        # The SOP knowledge base the RAG pipeline ingests.
        # `or` (not getenv default) so a blank SOPS_PATH= line falls back too.
        self.sops_path: str = os.getenv("SOPS_PATH") or str(
            REPO_ROOT / "data" / "sops"
        )

        # --- Google Drive ---
        self.gdrive_folder_id: str = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
        self.gdrive_service_account_json: str = os.getenv(
            "GOOGLE_SERVICE_ACCOUNT_JSON", ""
        )

        # --- ServiceNow ---
        self.servicenow_instance_url: str = os.getenv(
            "SERVICENOW_INSTANCE_URL", ""
        )
        self.servicenow_username: str = os.getenv("SERVICENOW_USERNAME", "")
        self.servicenow_password: str = os.getenv("SERVICENOW_PASSWORD", "")

        # --- Behaviour flags ---
        # When true, external integrations (ServiceNow) return mock data.
        self.mock_mode: bool = os.getenv("MOCK_MODE", "true").lower() == "true"

        # Retrieval relevance score below which an answer is flagged low-confidence.
        self.confidence_threshold: float = float(
            os.getenv("CONFIDENCE_THRESHOLD", "0.45")
        )

    @property
    def has_groq(self) -> bool:
        """True when a Groq key is configured; services degrade gracefully if not."""
        return bool(self.groq_api_key)

    @property
    def has_google(self) -> bool:
        """True when a Gemini/Google AI Studio key is configured for the RAG."""
        return bool(self.google_api_key)


@lru_cache
def get_settings() -> Settings:
    """Cached singleton. Used as a FastAPI dependency too."""
    return Settings()
