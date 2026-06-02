"""
Language detection (langdetect) + translation (Groq).

Owner: Sentiment, feedback analytics.

Supported demo languages: English, German, French, Italian — but the service
works for any language Groq supports.
"""

from __future__ import annotations

import logging
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "en": "English",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "es": "Spanish",
}


class TranslatorService:
    """Detect the language of text and translate between languages via Groq."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._llm = None

    def _get_llm(self):
        if self._llm is None and self.settings.has_groq:
            from langchain_groq import ChatGroq

            self._llm = ChatGroq(
                api_key=self.settings.groq_api_key,
                model=self.settings.groq_model,
                temperature=0.0,
            )
        return self._llm

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

    def translate(self, text: str, target_language: str) -> str:
        """
        Translate `text` into `target_language` (ISO code).

        Only calls the API when the detected source language differs from the
        target, to save tokens and latency.
        """
        if not text or not text.strip():
            return text

        source = self.detect_language(text)
        if source == target_language:
            return text

        llm = self._get_llm()
        if llm is None:
            # No translation backend available; return original text unchanged.
            logger.info("No Groq key; skipping translation %s->%s", source, target_language)
            return text

        from langchain_core.messages import HumanMessage

        target_name = LANGUAGE_NAMES.get(target_language, target_language)
        prompt = (
            f"Translate the following text into {target_name}. "
            f"Return ONLY the translation, no explanations.\n\n{text}"
        )
        try:
            resp = llm.invoke([HumanMessage(content=prompt)])
            return resp.content.strip()
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Translation failed: %s", exc)
            return text


_translator_singleton: Optional[TranslatorService] = None


def get_translator_service() -> TranslatorService:
    global _translator_singleton
    if _translator_singleton is None:
        _translator_singleton = TranslatorService()
    return _translator_singleton
