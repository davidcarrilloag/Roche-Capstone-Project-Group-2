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
from datetime import date, datetime, timezone
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
            rating: Optional[int] = None, reason: Optional[str] = None,
            comment: Optional[str] = None,
            message_id: Optional[str] = None,
            topic: Optional[str] = None,
            language: Optional[str] = None,
            timestamp: Optional[str] = None,
            seed: bool = False) -> dict:
        entry = {
            "session_id": session_id,
            "message": message,
            "sentiment": sentiment,
            "rating": rating,
            "reason": reason,
            "comment": comment,
            "message_id": message_id,
            "topic": topic,
            "language": language,
            "seed": seed,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
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

    @staticmethod
    def _within(ts: Optional[str], start: Optional[str], end: Optional[str]) -> bool:
        """True if the entry timestamp falls inside [start, end] (inclusive).

        start/end are 'YYYY-MM-DD' strings; either may be None (open-ended).
        """
        if not ts:
            return False
        try:
            d = datetime.fromisoformat(ts).date()
        except ValueError:
            return False
        if start and d < date.fromisoformat(start):
            return False
        if end and d > date.fromisoformat(end):
            return False
        return True

    def filtered(self, start: Optional[str] = None,
                 end: Optional[str] = None) -> list[dict]:
        """All entries, optionally limited to a date range (inclusive)."""
        entries = self.all()
        if not start and not end:
            return entries
        return [e for e in entries if self._within(e.get("timestamp"), start, end)]

    NEGATIVE_SENTIMENTS = {"negative", "frustrated", "confused"}

    def analytics(self, start: Optional[str] = None,
                  end: Optional[str] = None) -> dict:
        """Aggregated view for the Dashboard page.

        Keeps the original keys (total, by_sentiment, average_rating, recent)
        and adds richer aggregates for the analytics dashboard: weekly rating
        trend, per-topic counts with flagged ratios, language and downvote
        reason breakdowns. All additive — older consumers keep working.

        An optional date range (start/end as 'YYYY-MM-DD') limits which
        feedback is aggregated, powering the dashboard's period filter.
        """
        entries = self.filtered(start, end)
        sentiments = Counter(e["sentiment"] for e in entries)
        ratings = [e["rating"] for e in entries if e.get("rating") is not None]
        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

        # --- Weekly rating trend (ISO week buckets, chronological) ---
        weeks: dict[str, list[dict]] = {}
        timestamps: list[str] = []
        for e in entries:
            ts = e.get("timestamp")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts)
            except ValueError:
                continue
            timestamps.append(ts)
            weeks.setdefault(dt.strftime("%G-W%V"), []).append(e)
        weekly = []
        for key in sorted(weeks):
            wk = weeks[key]
            wk_ratings = [x["rating"] for x in wk if x.get("rating") is not None]
            weekly.append({
                "week": key,
                "avg_rating": round(sum(wk_ratings) / len(wk_ratings), 2)
                if wk_ratings else None,
                "count": len(wk),
            })

        # --- Per-topic counts + flagged (negative/confused/frustrated or <=2) ---
        topics: dict[str, dict] = {}
        for e in entries:
            t = e.get("topic")
            if not t:
                continue
            d = topics.setdefault(t, {"topic": t, "count": 0, "flagged": 0,
                                      "example": None})
            d["count"] += 1
            low_rating = e.get("rating") is not None and e["rating"] <= 2
            if e.get("sentiment") in self.NEGATIVE_SENTIMENTS or low_rating:
                d["flagged"] += 1
            if d["example"] is None and e.get("message"):
                d["example"] = e["message"]
        topic_list = sorted(topics.values(), key=lambda d: -d["count"])
        confusion = sorted(
            (d for d in topic_list if d["count"] >= 3 and d["flagged"] > 0),
            key=lambda d: -(d["flagged"] / d["count"]),
        )

        # --- Languages, downvote reasons, attention counter ---
        by_language = Counter(e["language"] for e in entries if e.get("language"))
        by_reason = Counter(e["reason"] for e in entries if e.get("reason"))
        # Count one attention item per actual rated downvote. The reason/comment
        # enrichment is stored as a separate negative entry with no rating, so we
        # skip those here to avoid counting a single downvote twice.
        needs_attention = sum(
            1 for e in entries
            if e.get("sentiment") in self.NEGATIVE_SENTIMENTS
            and e.get("rating") is not None
        )

        return {
            "total": len(entries),
            "by_sentiment": dict(sentiments),
            "average_rating": avg_rating,
            "recent": entries[-10:][::-1],
            "weekly": weekly,
            "topics": topic_list[:8],
            "confusion": confusion[:8],
            "by_language": dict(by_language),
            "by_reason": dict(by_reason),
            "needs_attention": needs_attention,
            "first_date": min(timestamps) if timestamps else None,
            "last_date": max(timestamps) if timestamps else None,
            "demo": any(e.get("seed") for e in entries),
        }


_feedback_singleton: Optional[FeedbackStore] = None


def get_feedback_store() -> FeedbackStore:
    global _feedback_singleton
    if _feedback_singleton is None:
        _feedback_singleton = FeedbackStore()
    return _feedback_singleton
