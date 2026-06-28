"""
Seed the feedback store with realistic demo data for the June 29 delivery.

Owner: Analytics & Feedback (Andrea).

Generates ~107 backdated entries spread over the last 8 weeks, covering the
8 main SOP topics and all 4 supported languages (en/de/fr/it), with a mix of
sentiments, ratings, downvote reasons and free-text comments — so the
analytics dashboard has a full, realistic story to tell during the demo.

Safe to run: if a feedback file already exists with data, it is backed up to
feedback.backup.jsonl before being replaced.

Run (from backend/, with the venv active):
    python scripts/seed_feedback.py             # replace store with demo data
    python scripts/seed_feedback.py --append    # add demo on top, keep live data
    python scripts/seed_feedback.py --clear     # remove demo data, keep real feedback
    python scripts/seed_feedback.py --clear-all # handover: wipe EVERYTHING
                                                # (demo + test), backup first

The dashboard's Live / Demo / All filter reads the `seed` flag, so --append
lets you show real and demo feedback side by side. For the Roche handover,
run --clear (drop demo, keep real) or --clear-all (start fully clean).
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make the backend package + this scripts/ dir importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import SYNTHETIC_MEMBERS  # noqa: E402
from demo_feedback_data import FEEDBACK_ITEMS, ORIG_LANGS, REASONS  # noqa: E402
from services.feedback_store import FeedbackStore  # noqa: E402

random.seed(29)  # deterministic: same demo data on every machine

# Scientists give the feedback (IT teams answer it), so attribute demo
# feedback to the lab scientists and their teams for the person/team filters.
SCIENTISTS = [m for m in SYNTHETIC_MEMBERS if not m["team"].startswith("IT")]


def clear_seeded() -> None:
    """Remove demo entries (seed: true) and keep any real feedback."""
    import json

    store = FeedbackStore()
    if not store._path.exists():
        print("No feedback file found — nothing to clear.")
        return
    entries = store.all()
    real = [e for e in entries if not e.get("seed")]
    removed = len(entries) - len(real)
    with store._path.open("w", encoding="utf-8") as fh:
        for e in real:
            fh.write(json.dumps(e) + "\n")
    print(f"Removed {removed} demo entries; kept {len(real)} real entries.")


def clear_all() -> None:
    """Wipe the whole feedback store (demo + test feedback).

    Use this for the production handover: it backs up the current file to
    feedback.backup.jsonl first, then leaves an empty store so the real
    scientists start from a clean slate.
    """
    store = FeedbackStore()
    if not store._path.exists() or store._path.stat().st_size == 0:
        print("Feedback store is already empty — nothing to clear.")
        return
    backup = store._path.with_name("feedback.backup.jsonl")
    backup.write_bytes(store._path.read_bytes())
    store._path.write_text("")
    print(f"Backed up previous data to {backup}; the feedback store is now empty.")


def main(append: bool = False) -> None:
    """Seed the demo feedback set.

    By default this replaces the store (backing up any existing data first).
    With ``append=True`` the demo entries are added on top of whatever is
    already there, so real (live) feedback is kept alongside the demo — handy
    for showing the dashboard's Live / Demo / All filter.
    """
    store = FeedbackStore()

    if append:
        print("Append mode: keeping existing feedback, adding demo on top.")
    else:
        # Back up any real data before replacing it with the demo set.
        if store._path.exists() and store._path.stat().st_size > 0:
            backup = store._path.with_name("feedback.backup.jsonl")
            backup.write_bytes(store._path.read_bytes())
            print(f"Existing data backed up to {backup}")
        store._path.write_text("")

    now = datetime.now(timezone.utc)
    start = now - timedelta(weeks=8)
    n = 0

    # Slight upward quality trend across the 8 weeks (demo story: answers
    # improve as more SOPs get added).
    for week in range(8):
        week_entries = random.randint(11, 16)
        for _ in range(week_entries):
            topic, sentiment, rating, translations = random.choice(FEEDBACK_ITEMS)
            # Bias toward the better option so the demo average lands ~3.5.
            if random.random() < 0.55:
                alt = random.choice(FEEDBACK_ITEMS)
                if alt[2] > rating:
                    topic, sentiment, rating, translations = alt
            # Improve ratings a bit in later weeks.
            if week >= 5 and rating <= 2 and random.random() < 0.35:
                sentiment, rating = "neutral", 3
            ts = start + timedelta(
                weeks=week,
                days=random.randint(0, 6),
                hours=random.randint(7, 18),
                minutes=random.randint(0, 59),
            )
            reason = None
            if rating <= 2 and random.random() < 0.6:
                reason = random.choice(REASONS)
            # Pick the language this entry was originally written in; the stored
            # message is that language, with the full translation map alongside.
            lang = random.choice(ORIG_LANGS)
            who = random.choice(SCIENTISTS)
            store.add(
                session_id=f"demo-{week}-{n}",
                message=translations[lang],
                sentiment=sentiment,
                rating=rating,
                reason=reason,
                topic=topic,
                language=lang,
                author=who["name"],
                team=who["team"],
                translations=translations,
                timestamp=ts.isoformat(),
                seed=True,
            )
            n += 1

    print(f"Seeded {n} demo feedback entries into {store._path}")
    print("Open the dashboard and hit Refresh to see them.")


if __name__ == "__main__":
    if "--clear-all" in sys.argv:
        clear_all()
    elif "--clear" in sys.argv:
        clear_seeded()
    else:
        main(append="--append" in sys.argv)
