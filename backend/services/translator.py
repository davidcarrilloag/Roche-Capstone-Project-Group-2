"""
Language detection (langdetect).

Owner: Sentiment, feedback analytics.

Note: the RAG generates answers directly in the user's language (cross-lingual
retrieval), so app-level translation isn't needed — `translate` is a no-op kept
for API compatibility. Supported demo languages: English, German, French,
Italian.
"""

from __future__ import annotations

import logging
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)


class TranslatorService:
    """Detect the language of text (translation is handled by the RAG itself)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def detect_language(self, text: str) -> str:
        """Return an ISO-639-1 code (best effort). Defaults to 'en'."""
        if not text or not text.strip():
            return "en"
        try:
            from langdetect import detect

            return detect(text)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Language detection failed, defaulting to 'en': %s", exc)
            return "en"

    def translate(
        self, text: str, target_language: str, source_language: Optional[str] = None
    ) -> str:
        """No-op: answers are already produced in the target language by the RAG."""
        return text


_translator_singleton: Optional[TranslatorService] = None


def get_translator_service() -> TranslatorService:
    global _translator_singleton
    if _translator_singleton is None:
        _translator_singleton = TranslatorService()
    return _translator_singleton
