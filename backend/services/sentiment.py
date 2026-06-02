"""
Sentiment detection via Groq.

Owner: Sentiment, feedback analytics.

The service degrades gracefully: if no Groq key is configured it falls back to
a tiny keyword heuristic so the rest of the app keeps working in development.
"""

from __future__ import annotations

import logging
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

ALLOWED_LABELS = {
    "positive",
    "negative",
    "neutral",
    "frustrated",
    "confused",
    "satisfied",
}

_CLASSIFY_PROMPT = (
    "You are a sentiment classifier for messages Roche scientists send to IT. "
    "Classify the message into exactly ONE of these labels: "
    "positive, negative, neutral, frustrated, confused, satisfied. "
    "Respond with ONLY the single label word, lowercase, nothing else.\n\n"
    "Message: {text}"
)


class SentimentService:
    """Classify the emotional tone of a scientist's message."""

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

    def analyze(self, text: str) -> str:
        """Return one of ALLOWED_LABELS for the given text."""
        if not text or not text.strip():
            return "neutral"

        llm = self._get_llm()
        if llm is None:
            return self._heuristic(text)

        from langchain_core.messages import HumanMessage

        try:
            resp = llm.invoke(
                [HumanMessage(content=_CLASSIFY_PROMPT.format(text=text))]
            )
            label = resp.content.strip().lower().split()[0]
            return label if label in ALLOWED_LABELS else "neutral"
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Sentiment LLM call failed, using heuristic: %s", exc)
            return self._heuristic(text)

    @staticmethod
    def _heuristic(text: str) -> str:
        """Very small fallback classifier for offline/dev use."""
        t = text.lower()
        frustrated = ("frustrat", "angry", "annoy", "useless", "again", "still not")
        confused = ("confus", "don't understand", "unclear", "how do i", "where is")
        negative = ("not work", "broken", "crash", "fail", "error", "can't", "cannot")
        positive = ("thank", "great", "perfect", "works", "helpful", "love")

        if any(w in t for w in frustrated):
            return "frustrated"
        if any(w in t for w in confused):
            return "confused"
        if any(w in t for w in positive):
            return "satisfied"
        if any(w in t for w in negative):
            return "negative"
        return "neutral"


_sentiment_singleton: Optional[SentimentService] = None


def get_sentiment_service() -> SentimentService:
    global _sentiment_singleton
    if _sentiment_singleton is None:
        _sentiment_singleton = SentimentService()
    return _sentiment_singleton
