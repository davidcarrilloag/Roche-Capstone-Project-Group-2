"""
RAG client — delegates document Q&A to Pablo's RAG service.

The canonical RAG pipeline lives in `pablo/` (Gemini + ChromaDB) and is exposed
as an HTTP service:  POST {RAG_SERVICE_URL}/api/rag/query  (default :8001).

This module keeps the same `RAGService.query(question, language) -> dict`
interface the rest of the backend already uses, so the chat route doesn't care
that retrieval now happens in a separate service. To run the full stack:

    # terminal 1 — Pablo's RAG service
    cd pablo && uvicorn src.api:app --port 8001
    # terminal 2 — this backend
    cd backend && uvicorn main:app --port 8000

Pablo's request : {query, user_language, user_role}
Pablo's response: {answer, source{title,doc_id,version,date},
                   language_detected, confidence (float), low_confidence (bool)}
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import Settings, get_settings

logger = logging.getLogger(__name__)

SERVICE_UNAVAILABLE = (
    "The knowledge service is not available right now. Please try again in a "
    "moment or contact your local IT support."
)


class RAGService:
    """Thin HTTP client for Pablo's RAG pipeline."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.base_url = self.settings.rag_service_url.rstrip("/")

    @staticmethod
    def _confidence_label(confidence: float, low_confidence: bool) -> str:
        """Map Pablo's numeric confidence + flag to our high/medium/low label."""
        if low_confidence:
            return "low"
        if confidence >= 0.8:
            return "high"
        if confidence >= 0.6:
            return "medium"
        return "low"

    def query(self, question: str, language: str = "en") -> dict:
        """
        Ask Pablo's RAG service and adapt the response to the backend's shape.

        Returns: {answer, source_doc, source_page, source_version,
                  source_last_updated, confidence}.
        """
        url = f"{self.base_url}/api/rag/query"
        payload = {"query": question, "user_language": language}
        try:
            resp = httpx.post(url, json=payload, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # service down, timeout, or pipeline error
            logger.warning("RAG service call failed (%s): %s", url, exc)
            return {
                "answer": SERVICE_UNAVAILABLE,
                "source_doc": "",
                "source_page": "",
                "source_version": "",
                "source_last_updated": "",
                "confidence": "low",
            }

        source = data.get("source", {}) or {}
        return {
            "answer": data.get("answer", ""),
            # Pablo's citation: title + doc_id + version + date.
            "source_doc": source.get("title", ""),
            "source_page": source.get("doc_id", ""),
            "source_version": source.get("version", ""),
            "source_last_updated": source.get("date", ""),
            "confidence": self._confidence_label(
                float(data.get("confidence", 0.0)),
                bool(data.get("low_confidence", False)),
            ),
        }

    def health(self) -> bool:
        """True if Pablo's RAG service is reachable."""
        try:
            r = httpx.get(f"{self.base_url}/health", timeout=5.0)
            return r.status_code == 200
        except Exception:
            return False


_rag_singleton: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_singleton
    if _rag_singleton is None:
        _rag_singleton = RAGService()
    return _rag_singleton
