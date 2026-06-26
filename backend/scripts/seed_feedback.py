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
    python scripts/seed_feedback.py             # load demo data
    python scripts/seed_feedback.py --clear     # remove demo data, keep real feedback
    python scripts/seed_feedback.py --clear-all # handover: wipe EVERYTHING
                                                # (demo + test), backup first
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make the backend package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.feedback_store import FeedbackStore  # noqa: E402

random.seed(29)  # deterministic: same demo data on every machine

LANGUAGES = ["en", "en", "en", "en", "de", "de", "fr", "it"]  # weighted

REASONS = [
    "Wrong information",
    "Source not relevant",
    "Answer too vague",
    "Wrong language",
]

# (topic, [(sentiment, rating, message)]) — messages stay short and plausible.
TOPICS = {
    "Material return": [
        ("confused", 2, "What form do I need to send samples back?"),
        ("satisfied", 5, "Found the return form straight away, thanks."),
        ("frustrated", 1, "The return process described does not match the portal."),
        ("neutral", 3, "OK but I had to ask twice."),
        ("confused", 2, "Unclear who signs off the material return."),
    ],
    "Lab sharing": [
        ("confused", 2, "Can two teams share the fume hood?"),
        ("satisfied", 4, "Booking rules were explained clearly."),
        ("negative", 2, "Answer contradicted what my team lead told me."),
        ("neutral", 3, "Partially useful, missing the weekend rules."),
    ],
    "Onboarding": [
        ("confused", 2, "Who approves my safety training?"),
        ("satisfied", 5, "Onboarding checklist was exactly what I needed."),
        ("frustrated", 1, "This onboarding process is really confusing."),
        ("satisfied", 4, "Clear steps for the first week."),
    ],
    "Building access": [
        ("confused", 2, "Weekend access to the lab?"),
        ("satisfied", 5, "Badge request answered perfectly."),
        ("neutral", 3, "Got the info but the SOP link was slow."),
        ("satisfied", 4, "Saved me a trip to the office."),
    ],
    "Device cleaning": [
        ("confused", 2, "What solution for the analyzer surface?"),
        ("satisfied", 5, "Cleaning steps for the HP device were spot on."),
        ("negative", 1, "Pointed me to the wrong device SOP."),
    ],
    "Calibration": [
        ("frustrated", 1, "Calibration drift steps did not work for my unit."),
        ("satisfied", 4, "Drift troubleshooting was helpful."),
        ("confused", 2, "When is recalibration mandatory vs optional?"),
        ("neutral", 3, "Found it, but the German version is outdated."),
    ],
    "Waste disposal": [
        ("frustrated", 1, "Waste categories explanation was wrong for solvents."),
        ("confused", 2, "Where do biohazard sharps go?"),
        ("negative", 2, "Answer too vague to act on."),
        ("satisfied", 4, "Clear disposal chart, thanks."),
    ],
    "Ordering supplies": [
        ("confused", 2, "How do I order reagents under 500 CHF?"),
        ("satisfied", 5, "Ordering steps matched the new portal."),
        ("satisfied", 4, "Quick and correct."),
        ("neutral", 3, "Fine, though approval limits were missing."),
    ],
}

COMMENTS = {
    "Wrong information": [
        "The SOP link was outdated.",
        "Steps 3 and 4 are in the wrong order.",
        "Contact number listed is no longer valid.",
    ],
    "Answer too vague": [
        "Too short, I needed the actual form name.",
        "It just repeated my question back.",
    ],
    "Source not relevant": [
        "It quoted the cleaning SOP for a calibration question.",
    ],
    "Wrong language": [
        "I asked in German and got English.",
    ],
}


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


def main() -> None:
    store = FeedbackStore()

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
            topic = random.choice(list(TOPICS))
            sentiment, rating, message = random.choice(TOPICS[topic])
            # Bias toward the better option so the demo average lands ~3.5.
            if random.random() < 0.55:
                alt = random.choice(TOPICS[topic])
                if alt[1] > rating:
                    sentiment, rating, message = alt
            # Improve ratings a bit in later weeks.
            if week >= 5 and rating <= 2 and random.random() < 0.35:
                sentiment, rating = "neutral", 3
            ts = start + timedelta(
                weeks=week,
                days=random.randint(0, 6),
                hours=random.randint(7, 18),
                minutes=random.randint(0, 59),
            )
            reason = comment = None
            if rating <= 2 and random.random() < 0.6:
                reason = random.choice(REASONS)
                if random.random() < 0.5:
                    comment = random.choice(
                        COMMENTS.get(reason, ["No further detail."])
                    )
            store.add(
                session_id=f"demo-{week}-{n}",
                message=message,
                sentiment=sentiment,
                rating=rating,
                reason=reason,
                comment=comment,
                topic=topic,
                language=random.choice(LANGUAGES),
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
        main()
