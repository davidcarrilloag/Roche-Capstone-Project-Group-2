"""
Sentiment detection.

Owner: Sentiment, feedback analytics.

Uses a small keyword heuristic — deterministic and offline. Labels feed the
feedback analytics dashboard.
"""

from __future__ import annotations

from typing import Optional

from config import Settings, get_settings

ALLOWED_LABELS = {
    "positive",
    "negative",
    "neutral",
    "frustrated",
    "confused",
    "satisfied",
}


class SentimentService:
    """Classify the emotional tone of a scientist's message."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def analyze(self, text: str) -> str:
        """Return one of ALLOWED_LABELS for the given text."""
        if not text or not text.strip():
            return "neutral"
        return self._heuristic(text)

    @staticmethod
    def _heuristic(text: str) -> str:
        """Keyword tone classifier."""
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
