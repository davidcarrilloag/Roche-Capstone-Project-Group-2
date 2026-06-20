"""
Persistence layer — SQLite via SQLModel.

This is the foundation that makes collaboration real: durable storage (data
survives restarts) plus a lightweight synthetic identity (a roster of lab
members you can "act as", no passwords). Bookings live here so they no longer
vanish on restart, and future collaboration data (announcements, etc.) can use
the same store.

Owner: Backend.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlmodel import Field, Session, SQLModel, create_engine, select

from config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
# check_same_thread=False so FastAPI's threadpool can share the SQLite engine.
engine = create_engine(
    _settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {},
)


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
class LabMember(SQLModel, table=True):
    """A scientist in the lab — the synthetic identity you act as."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str = ""
    team: str = ""
    expertise: str = ""  # comma-separated tags


class Booking(SQLModel, table=True):
    """A persisted equipment reservation."""

    id: Optional[int] = Field(default=None, primary_key=True)
    equipment_id: str
    equipment_name: str = ""
    location: str = ""
    date: str = ""
    time: str = ""
    duration_minutes: int = 60
    user: str = ""
    status: str = "confirmed"
    calendar_link: str = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ColleagueRequest(SQLModel, table=True):
    """A question routed from one scientist to a colleague (expert)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    from_user: str = ""
    to_member: str = ""
    question: str = ""
    answer: str = ""
    status: str = "open"  # open | answered
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class Announcement(SQLModel, table=True):
    """A broadcast from IT to scientists (maintenance, known issue, tip)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    author: str = ""
    title: str = ""
    body: str = ""
    category: str = "info"  # info | maintenance | incident
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ---------------------------------------------------------------------------
# Synthetic roster — seeded once into an empty database.
# ---------------------------------------------------------------------------
SYNTHETIC_MEMBERS = [
    # --- Scientists ---
    {"name": "Dr. Elena Fischer", "role": "Senior Scientist", "team": "Oncology", "expertise": "Confocal microscopy, Immunostaining"},
    {"name": "Dr. Marco Rossi", "role": "Research Scientist", "team": "Molecular Biology", "expertise": "PCR, qPCR, Cloning"},
    {"name": "Dr. Sophie Dubois", "role": "Lab Manager", "team": "Analytics", "expertise": "Mass spectrometry, HPLC"},
    {"name": "Dr. Liam O'Brien", "role": "Postdoc", "team": "Cell Biology", "expertise": "Cell culture, Flow cytometry"},
    {"name": "Dr. Anna Schmidt", "role": "Research Scientist", "team": "Biochemistry", "expertise": "Protein purification, Western blot"},
    {"name": "Dr. Hiroshi Tanaka", "role": "Senior Scientist", "team": "Imaging", "expertise": "Confocal microscopy, Image analysis"},
    {"name": "Dr. Carla Moreno", "role": "Postdoc", "team": "Genetics", "expertise": "CRISPR, NGS"},
    {"name": "Dr. James Patel", "role": "Lab Technician", "team": "Operations", "expertise": "Equipment maintenance, Inventory"},
    # --- IT team (team starts with "IT" → flagged as IT in the app) ---
    {"name": "Tom Becker", "role": "IT Service Desk", "team": "IT Support", "expertise": "Password reset, VPN, Account access, Login issues, Email"},
    {"name": "Priya Nair", "role": "ELN/LIMS Specialist", "team": "IT Lab Systems", "expertise": "ELN, LIMS, Sample management software, Data export"},
    {"name": "Diego Fernández", "role": "Instrumentation IT", "team": "IT Lab Systems", "expertise": "Instrument PCs, Software installation, Drivers, Acquisition software"},
    {"name": "Sarah Kim", "role": "Network & Systems Engineer", "team": "IT Infrastructure", "expertise": "Network, Wi-Fi, VPN, File shares, Remote access, Storage"},
]


def init_db() -> None:
    """Create tables and seed any missing roster members. Safe to call repeatedly."""
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        existing_names = {m.name for m in session.exec(select(LabMember)).all()}
        added = 0
        for m in SYNTHETIC_MEMBERS:
            if m["name"] not in existing_names:
                session.add(LabMember(**m))
                added += 1
        if added:
            session.commit()
            logger.info("Seeded %d lab member(s).", added)


def get_session():
    """FastAPI dependency — yields a session."""
    with Session(engine) as session:
        yield session
