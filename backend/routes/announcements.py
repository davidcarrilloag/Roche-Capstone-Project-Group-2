"""
Announcements — IT broadcasts to scientists (maintenance, known issues, tips).

GET  /announcements             active announcements (newest first)
POST /announcements             post one (IT)
POST /announcements/{id}/retire deactivate one

Owner: Backend.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import Announcement, get_session
from models.schemas import AnnouncementCreate

router = APIRouter(tags=["announcements"])


@router.get("/announcements", response_model=List[Announcement])
def list_announcements(session: Session = Depends(get_session)) -> List[Announcement]:
    return session.exec(
        select(Announcement)
        .where(Announcement.active == True)  # noqa: E712
        .order_by(Announcement.created_at.desc())
    ).all()


@router.post("/announcements", response_model=Announcement)
def create_announcement(
    request: AnnouncementCreate,
    session: Session = Depends(get_session),
) -> Announcement:
    a = Announcement(
        author=request.author or "IT",
        title=request.title,
        body=request.body,
        category=request.category or "info",
    )
    session.add(a)
    session.commit()
    session.refresh(a)
    return a


@router.post("/announcements/{announcement_id}/retire", response_model=Announcement)
def retire_announcement(
    announcement_id: int,
    session: Session = Depends(get_session),
) -> Announcement:
    a = session.get(Announcement, announcement_id)
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    a.active = False
    session.add(a)
    session.commit()
    session.refresh(a)
    return a
