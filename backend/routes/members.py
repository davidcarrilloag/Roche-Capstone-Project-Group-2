"""
Lab members — the synthetic identity roster.

GET /members  list the scientists you can "act as" (no auth; synthetic).

Owner: Backend.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from db import LabMember, get_session

router = APIRouter(tags=["members"])


@router.get("/members", response_model=List[LabMember])
def list_members(session: Session = Depends(get_session)) -> List[LabMember]:
    return session.exec(select(LabMember).order_by(LabMember.name)).all()
