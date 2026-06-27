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
        """Keyword tone classifier (with a small sarcasm guard)."""
        t = text.lower()
        strong_negative = (
            "error", "broken", "crash", "fail", "ruined", "lost", "destroyed",
            "not work", "doesn't work",
        )
        positive = ("thank", "great", "perfect", "works", "helpful", "love")

        # Sarcasm guard: a clear complaint dressed up with a positive word
        # ("Another error, great." / "Everything is broken, thanks a lot") is
        # negative, not satisfied — check this before the positive keywords.
        if any(w in t for w in strong_negative) and any(w in t for w in positive):
            return "negative"

        frustrated = (
            "frustrat", "angry", "annoy", "useless", "again", "still not",
            "immediately", "urgent", "asap", "unable",
        )
        confused = ("confus", "don't understand", "unclear", "how do i", "where is")
        negative = strong_negative + ("can't", "cannot", "inaccessible", "unavailable")

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
