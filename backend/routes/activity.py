"""
Activity feed — a unified timeline of what the team has been doing.

Aggregates bookings, routed colleague questions/answers and IT announcements
into one recent-activity stream, so the app feels lived-in. Read-only; no new
storage (reads the existing tables).

Owner: Backend.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from db import Announcement, Booking, ColleagueRequest, get_session

router = APIRouter(tags=["activity"])


@router.get("/activity")
def activity(
    limit: int = 25,
    session: Session = Depends(get_session),
) -> List[dict]:
    events: List[dict] = []

    for b in session.exec(select(Booking).where(Booking.status == "confirmed")).all():
        events.append({
            "type": "booking",
            "actor": b.user or "Someone",
            "text": f"booked {b.equipment_name}",
            "detail": f"{b.date} · {b.time}",
            "ts": b.created_at,
        })

    for r in session.exec(select(ColleagueRequest)).all():
        events.append({
            "type": "question",
            "actor": r.from_user or "Someone",
            "text": f"asked {r.to_member} a question",
            "detail": r.question,
            "ts": r.created_at,
        })
        if r.status == "answered":
            events.append({
                "type": "answer",
                "actor": r.to_member,
                "text": f"answered {r.from_user}",
                "detail": r.question,
                "ts": r.created_at,
            })

    for a in session.exec(select(Announcement).where(Announcement.active == True)).all():  # noqa: E712
        events.append({
            "type": "announcement",
            "actor": a.author or "IT",
            "text": f"posted an update: {a.title}",
            "detail": a.body,
            "ts": a.created_at,
        })

    events.sort(key=lambda e: e["ts"] or "", reverse=True)
    return events[:limit]
