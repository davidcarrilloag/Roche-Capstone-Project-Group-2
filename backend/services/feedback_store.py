"""
Lightweight feedback store + analytics.

Owner: Feedback analytics.

Persists feedback entries to a local JSON-lines file so the Dashboard has data
to aggregate. In production this would be a database; the interface is kept
small so swapping the backend is trivial.
"""

from __future__ import annotations

import json
import logging
import threading
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import REPO_ROOT, Settings, get_settings

logger = logging.getLogger(__name__)


class FeedbackStore:
    """Append-only feedback log with simple aggregation for the dashboard."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._path = REPO_ROOT / "backend" / "data" / "feedback.jsonl"
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def add(self, session_id: str, message: str, sentiment: str,
            rating: Optional[int] = None) -> dict:
        entry = {
            "session_id": session_id,
            "message": message,
            "sentiment": sentiment,
            "rating": rating,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            with self._path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        logger.info("Stored feedback: sentiment=%s session=%s", sentiment, session_id)
        return entry

    def all(self) -> list[dict]:
        if not self._path.exists():
            return []
        with self._lock:
            with self._path.open("r", encoding="utf-8") as fh:
                return [json.loads(line) for line in fh if line.strip()]

    def analytics(self) -> dict:
        """Aggregated view for the Dashboard page."""
        entries = self.all()
        sentiments = Counter(e["sentiment"] for e in entries)
        ratings = [e["rating"] for e in entries if e.get("rating") is not None]
        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
        return {
            "total": len(entries),
            "by_sentiment": dict(sentiments),
            "average_rating": avg_rating,
            "recent": entries[-10:][::-1],
        }


_feedback_singleton: Optional[FeedbackStore] = None


def get_feedback_store() -> FeedbackStore:
    global _feedback_singleton
    if _feedback_singleton is None:
        _feedback_singleton = FeedbackStore()
    return _feedback_singleton
