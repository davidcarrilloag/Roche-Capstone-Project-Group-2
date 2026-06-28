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
            author: Optional[str] = None,
            team: Optional[str] = None,
            translations: Optional[dict] = None,
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
            "author": author,
            "team": team,
            # Optional {lang: text} map so the dashboard can show the comment in
            # the viewer's language while keeping `language` as the original.
            "translations": translations,
            "seed": seed,
            "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            with self._path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        logger.info("Stored feedback: sentiment=%s session=%s", sentiment, session_id)
        return entry

    def _read_all_unlocked(self) -> list[dict]:
        if not self._path.exists():
            return []
        with self._path.open("r", encoding="utf-8") as fh:
            return [json.loads(line) for line in fh if line.strip()]

    def _write_all_unlocked(self, entries: list[dict]) -> None:
        with self._path.open("w", encoding="utf-8") as fh:
            for e in entries:
                fh.write(json.dumps(e) + "\n")

    def all(self) -> list[dict]:
        with self._lock:
            return self._read_all_unlocked()

    def enrich(self, message_id: str, reason: Optional[str] = None,
               comment: Optional[str] = None,
               language: Optional[str] = None,
               translations: Optional[dict] = None) -> Optional[dict]:
        """Fold a downvote's reason/comment into its existing rated entry.

        The chat UI logs a downvote in two steps: the thumb (carries a rating)
        and then an optional reason chip / free-text comment. To keep the whole
        dashboard honest — one downvote = one entry everywhere (total, sentiment
        split, recent feed, needs-attention) — we merge the second step into the
        original rated row instead of appending a separate one.

        Returns the updated entry, or None when no rated downvote with that
        message_id exists yet (the caller then falls back to a plain add).
        """
        if not message_id:
            return None
        with self._lock:
            entries = self._read_all_unlocked()
            target = None
            for e in reversed(entries):
                if e.get("message_id") == message_id and e.get("rating") is not None:
                    target = e
                    break
            if target is None:
                return None
            if reason:
                target["reason"] = reason
            if comment:
                target["comment"] = comment
            # Surface the most descriptive text as the row's headline: a
            # free-text comment wins, otherwise the reason chip — both read
            # better than the generic "Thumbs down on message X" placeholder.
            if comment:
                target["message"] = comment
            elif reason:
                target["message"] = reason
            if language:
                target["language"] = language
            if translations:
                target["translations"] = translations
            self._write_all_unlocked(entries)
        logger.info("Enriched feedback for message_id=%s", message_id)
        return target

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
                 end: Optional[str] = None,
                 source: Optional[str] = None,
                 sentiment: Optional[str] = None,
                 author: Optional[str] = None,
                 team: Optional[str] = None) -> list[dict]:
        """Entries, optionally narrowed by date range, source, and attributes.

        `source` selects which dataset to return:
          - "live"        → real feedback only (seed flag falsy)
          - "demo"        → seeded demo feedback only
          - None / "all"  → everything
        `sentiment`/`author`/`team` keep only entries matching that exact value
        (None / "" / "all" means no narrowing on that field).
        """
        entries = self.all()
        if start or end:
            entries = [e for e in entries
                       if self._within(e.get("timestamp"), start, end)]
        if source == "live":
            entries = [e for e in entries if not e.get("seed")]
        elif source == "demo":
            entries = [e for e in entries if e.get("seed")]
        if sentiment and sentiment != "all":
            entries = [e for e in entries if e.get("sentiment") == sentiment]
        if author and author != "all":
            entries = [e for e in entries if e.get("author") == author]
        if team and team != "all":
            entries = [e for e in entries if e.get("team") == team]
        return entries

    NEGATIVE_SENTIMENTS = {"negative", "frustrated", "confused"}

    def analytics(self, start: Optional[str] = None,
                  end: Optional[str] = None,
                  source: Optional[str] = None,
                  sentiment: Optional[str] = None,
                  author: Optional[str] = None,
                  team: Optional[str] = None) -> dict:
        """Aggregated view for the Dashboard page.

        Keeps the original keys (total, by_sentiment, average_rating, recent)
        and adds richer aggregates for the analytics dashboard: weekly rating
        trend, per-topic counts with flagged ratios, language and downvote
        reason breakdowns. All additive — older consumers keep working.

        An optional date range (start/end as 'YYYY-MM-DD') limits which
        feedback is aggregated, powering the dashboard's period filter.
        """
        # `scope` = period + source only; it drives the person/team dropdown
        # options so every contributor in the period stays selectable even
        # while a narrow person/team/sentiment filter is active. `entries` is
        # the fully-narrowed set the aggregates are computed from.
        scope = self.filtered(start, end, source)
        entries = self.filtered(start, end, source, sentiment, author, team)
        authors = sorted({e["author"] for e in scope if e.get("author")})
        teams = sorted({e["team"] for e in scope if e.get("team")})
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
            "authors": authors,
            "teams": teams,
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
