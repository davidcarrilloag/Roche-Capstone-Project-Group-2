"""
Ask a colleague — expert finder + routed questions.

POST /experts/suggest          best-matching colleague(s) for a question
POST /colleague-requests       send a question to a colleague (persisted)
GET  /colleague-requests       inbox: open questions for a member
POST /colleague-requests/{id}/answer   the colleague answers

Owner: Backend.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from db import ColleagueRequest, get_session
from models.schemas import (
    ColleagueRequestAnswer,
    ColleagueRequestCreate,
    ExpertOut,
    ExpertSuggestRequest,
    MeetingRequest,
    MeetingResponse,
)
from services.calendar import CalendarService, get_calendar_service
from services.experts import suggest_experts

router = APIRouter(tags=["experts"])


@router.post("/meetings", response_model=MeetingResponse)
def schedule_meeting(
    request: MeetingRequest,
    calendar: CalendarService = Depends(get_calendar_service),
) -> MeetingResponse:
    who = request.from_user or "You"
    summary = f"Meeting: {who} & {request.with_member}"
    description = request.topic or "Discussion"
    link = calendar.create_event(
        summary=summary,
        description=description,
        location="",
        date=request.date,
        time=request.time,
        duration_minutes=request.duration_minutes,
    )
    return MeetingResponse(
        status="scheduled" if link else "no_calendar",
        summary=summary,
        with_member=request.with_member,
        date=request.date,
        time=request.time,
        duration_minutes=request.duration_minutes,
        calendar_link=link or "",
    )


@router.post("/experts/suggest", response_model=List[ExpertOut])
def experts_suggest(request: ExpertSuggestRequest) -> List[ExpertOut]:
    return [ExpertOut(**e) for e in suggest_experts(request.question)]


@router.post("/colleague-requests", response_model=ColleagueRequest)
def create_request(
    request: ColleagueRequestCreate,
    session: Session = Depends(get_session),
) -> ColleagueRequest:
    req = ColleagueRequest(
        from_user=request.from_user or "",
        to_member=request.to_member,
        question=request.question,
    )
    session.add(req)
    session.commit()
    session.refresh(req)
    return req


@router.get("/colleague-requests", response_model=List[ColleagueRequest])
def list_requests(
    member: Optional[str] = None,
    from_user: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
) -> List[ColleagueRequest]:
    stmt = select(ColleagueRequest)
    if member:
        stmt = stmt.where(ColleagueRequest.to_member == member)
    if from_user:
        stmt = stmt.where(ColleagueRequest.from_user == from_user)
    if status:
        stmt = stmt.where(ColleagueRequest.status == status)
    return session.exec(stmt.order_by(ColleagueRequest.created_at.desc())).all()


@router.post("/colleague-requests/{request_id}/answer", response_model=ColleagueRequest)
def answer_request(
    request_id: int,
    body: ColleagueRequestAnswer,
    session: Session = Depends(get_session),
) -> ColleagueRequest:
    req = session.get(ColleagueRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.answer = body.answer
    req.status = "answered"
    session.add(req)
    session.commit()
    session.refresh(req)

    # Living knowledge base: index this Q&A so the assistant learns it for next
    # time (best-effort — never fail the reply if the RAG isn't available).
    try:
        from services.ingest import add_community_answer

        add_community_answer(
            question=req.question,
            answer=req.answer,
            author=req.to_member,
            doc_id=f"COMMUNITY-{req.id}",
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not index community answer: %s", exc)

    return req
