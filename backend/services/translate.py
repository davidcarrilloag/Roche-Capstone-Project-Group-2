"""Translate free-text feedback comments into the four supported languages.

Reuses the same Gemini model + GOOGLE_API_KEY the chatbot already uses, so no
extra key or service is needed. Translation happens once, when a comment is
stored, and the result is kept on the entry (`translations`) — the dashboard's
language switcher then reads it for free, with zero cost per view.

Degrades gracefully: with no API key (MOCK mode), or on any error, it returns
None and the comment simply shows in its original language.

Owner: Analytics & Feedback.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

SUPPORTED = ("en", "de", "fr", "it")
# Skip very short snippets ("ok", "vague") — not worth a call and unreliable.
MIN_CHARS = 12

_llm = None


def _get_llm(settings: Settings):
    """Lazily build the Gemini client (same one the RAG uses)."""
    global _llm
    if _llm is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            temperature=0,
            google_api_key=settings.google_api_key,
        )
    return _llm


def _parse_json(raw: str) -> Optional[dict]:
    """Pull a JSON object out of the model reply (tolerates code fences)."""
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("{"):]
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(s[start:end + 1])
    except json.JSONDecodeError:
        return None


def translate_comment(text: str, source_lang: Optional[str] = None,
                      settings: Optional[Settings] = None) -> Optional[dict]:
    """Translate `text` into en/de/fr/it. Returns {lang: text} or None.

    The source language's slot is forced back to the exact original text so it
    is never altered. Returns None when translation is unavailable (no key,
    text too short) or fails — callers then keep the original only.
    """
    settings = settings or get_settings()
    if not text or len(text.strip()) < MIN_CHARS:
        return None
    if not settings.has_google:
        return None  # MOCK mode: no key, leave it in the original language

    system = (
        "You are a translation engine for short lab-support feedback comments. "
        "Translate the comment into English, German, French and Italian. "
        "Return ONLY a JSON object with keys \"en\", \"de\", \"fr\", \"it\" — "
        "each value the faithful, natural translation in that language. "
        "No commentary, no code fences."
    )
    user = f"Comment (language: {source_lang or 'unknown'}):\n{text}"
    try:
        from langchain_core.messages import HumanMessage, SystemMessage

        reply = _get_llm(settings).invoke(
            [SystemMessage(content=system), HumanMessage(content=user)]
        ).content
        data = _parse_json(reply)
        if not data:
            return None
        out = {lang: (data.get(lang) or "").strip() for lang in SUPPORTED}
        # Drop if the model returned nothing usable.
        if not any(out.values()):
            return None
        # Never alter the original; fill any gaps with it too.
        for lang in SUPPORTED:
            if source_lang == lang or not out[lang]:
                out[lang] = text
        return out
    except Exception as exc:  # pragma: no cover - network/defensive
        logger.warning("Comment translation failed (keeping original): %s", exc)
        return None
