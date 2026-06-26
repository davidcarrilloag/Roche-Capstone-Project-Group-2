"""
Lab members — the synthetic identity roster, profiles and contributions.

GET /members                     list members (for the identity picker)
GET /members/directory           members enriched with contribution stats
GET /members/{member_id}/profile a member's profile + their contributions

Owner: Backend.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import Booking, ColleagueRequest, LabMember, get_session

router = APIRouter(tags=["members"])


@router.get("/members", response_model=List[LabMember])
def list_members(session: Session = Depends(get_session)) -> List[LabMember]:
    return session.exec(select(LabMember).order_by(LabMember.name)).all()


@router.get("/members/directory")
def members_directory(session: Session = Depends(get_session)) -> List[dict]:
    """Members enriched with contribution counts (answers given, bookings made)."""
    members = session.exec(select(LabMember).order_by(LabMember.name)).all()

    # Aggregate once, then count per member by name.
    answered = session.exec(
        select(ColleagueRequest).where(ColleagueRequest.status == "answered")
    ).all()
    open_reqs = session.exec(
        select(ColleagueRequest).where(ColleagueRequest.status == "open")
    ).all()
    bookings = session.exec(
        select(Booking).where(Booking.status == "confirmed")
    ).all()

    out = []
    for m in members:
        out.append(
            {
                "id": m.id,
                "name": m.name,
                "role": m.role,
                "team": m.team,
                "expertise": m.expertise,
                "answers": sum(1 for r in answered if r.to_member == m.name),
                "open_questions": sum(1 for r in open_reqs if r.to_member == m.name),
                "bookings": sum(1 for b in bookings if b.user == m.name),
            }
        )
    return out


@router.get("/it/questions")
def it_questions(session: Session = Depends(get_session)) -> dict:
    """Everything scientists have routed to the IT team — so IT sees the demand."""
    it_names = {m.name for m in session.exec(select(LabMember)).all() if (m.team or "").startswith("IT")}
    reqs = session.exec(
        select(ColleagueRequest).order_by(ColleagueRequest.created_at.desc())
    ).all()
    to_it = [r for r in reqs if r.to_member in it_names]

    def ser(r):
        return {
            "id": r.id, "from_user": r.from_user, "to_member": r.to_member,
            "question": r.question, "answer": r.answer, "status": r.status,
            "created_at": r.created_at,
        }

    open_items = [ser(r) for r in to_it if r.status == "open"]
    answered_items = [ser(r) for r in to_it if r.status == "answered"]
    return {
        "open": open_items,
        "answered": answered_items,
        "count_open": len(open_items),
        "count_total": len(to_it),
    }


@router.get("/members/{member_id}/profile")
def member_profile(member_id: int, session: Session = Depends(get_session)) -> dict:
    member = session.get(LabMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    answered = session.exec(
        select(ColleagueRequest)
        .where(ColleagueRequest.to_member == member.name, ColleagueRequest.status == "answered")
        .order_by(ColleagueRequest.created_at.desc())
    ).all()
    bookings = session.exec(
        select(Booking)
        .where(Booking.user == member.name, Booking.status == "confirmed")
        .order_by(Booking.date, Booking.time)
    ).all()

    return {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "team": member.team,
        "expertise": member.expertise,
        "stats": {"answers": len(answered), "bookings": len(bookings)},
        "contributions": [
            {"question": r.question, "answer": r.answer, "from_user": r.from_user, "created_at": r.created_at}
            for r in answered
        ],
        "bookings": [
            {"equipment_name": b.equipment_name, "location": b.location, "date": b.date, "time": b.time, "duration_minutes": b.duration_minutes}
            for b in bookings
        ],
    }
