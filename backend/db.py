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
from datetime import date, datetime, timedelta
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


class AppMeta(SQLModel, table=True):
    """Tiny key/value store for app flags (e.g. whether the demo world is seeded)."""

    key: str = Field(primary_key=True)
    value: str = ""


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
    """Create tables, seed missing roster members, and seed the demo world once."""
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
    seed_demo_world()


def _ts(hours_ago: float) -> str:
    return (datetime.utcnow() - timedelta(hours=hours_ago)).isoformat()


def seed_demo_world() -> None:
    """
    Populate a realistic, lived-in world (bookings, routed questions, IT
    announcements) so the app feels used from any perspective. Runs once,
    guarded by an AppMeta flag, so a user's own activity is never wiped.
    """
    with Session(engine) as session:
        if session.get(AppMeta, "demo_world_v1"):
            return  # already seeded

        # Fresh start for activity tables so the demo is deterministic.
        for model in (Booking, ColleagueRequest, Announcement):
            for row in session.exec(select(model)).all():
                session.delete(row)

        d0 = date.today()
        def day(n):
            return (d0 + timedelta(days=n)).isoformat()

        # Bookings spread across the week (equipment + rooms, various people).
        bookings = [
            ("massspec-01", "Mass Spectrometer (Thermo Q Exactive)", "Analytics Lab C-110", day(0), "09:00", 90, "Dr. Sophie Dubois"),
            ("centrifuge-01", "Centrifuge (Eppendorf 5424R)", "Lab A-101", day(0), "11:00", 30, "Dr. Liam O'Brien"),
            ("thermocycler-01", "PCR Thermocycler (Bio-Rad C1000)", "Lab A-103", day(0), "14:00", 120, "Dr. Marco Rossi"),
            ("confocal-01", "Confocal Microscope (Zeiss LSM 900)", "Imaging Suite C-201", day(1), "10:00", 60, "Dr. Elena Fischer"),
            ("platereader-01", "Plate Reader (Tecan Spark)", "Lab A-105", day(1), "15:00", 90, "Dr. Anna Schmidt"),
            ("room-bsl2-c105", "BSL-2 Lab C-105", "Building C, 1st floor", day(2), "09:00", 180, "Dr. Carla Moreno"),
            ("room-darkroom-c118", "Imaging Dark Room C-118", "Building C, 1st floor", day(2), "13:00", 60, "Dr. Hiroshi Tanaka"),
            ("room-meeting-a200", "Meeting Room A-200", "Building A, 2nd floor", day(3), "11:00", 30, "Dr. Marco Rossi"),
            ("room-cellculture-a108", "Cell Culture Suite A-108", "Building A, 1st floor", day(4), "10:00", 120, "Dr. Sophie Dubois"),
        ]
        for i, (eid, ename, loc, dt, tm, dur, user) in enumerate(bookings):
            session.add(Booking(equipment_id=eid, equipment_name=ename, location=loc, date=dt, time=tm, duration_minutes=dur, user=user, status="confirmed", created_at=_ts(i + 1)))

        # Routed questions — answered (become contributions) + open (inboxes).
        answered = [
            ("Dr. Marco Rossi", "Dr. Hiroshi Tanaka", "How do I align the confocal laser?", "Open ZEN, run the Laser Alignment Wizard, then center the pinhole with auto-align. Recheck weekly."),
            ("Dr. Liam O'Brien", "Dr. Elena Fischer", "Best fixation for immunostaining?", "4% PFA for 15 min at room temperature, then three PBS washes. Avoid over-fixation."),
            ("Dr. Anna Schmidt", "Dr. Sophie Dubois", "Which HPLC column for small peptides?", "Use the C18 with a shallow acetonitrile gradient; keep the flow at 0.3 mL/min."),
        ]
        for i, (frm, to, q, a) in enumerate(answered):
            session.add(ColleagueRequest(from_user=frm, to_member=to, question=q, answer=a, status="answered", created_at=_ts(i * 2 + 1)))

        open_reqs = [
            ("Dr. Sophie Dubois", "Dr. Marco Rossi", "Could you share your qPCR protocol for the new primers?"),
            ("Dr. Carla Moreno", "Priya Nair", "My ELN won't open after last night's update."),
            ("Dr. Elena Fischer", "Tom Becker", "I can't connect to the VPN from home."),
            ("Dr. Marco Rossi", "Sarah Kim", "The lab file share keeps disconnecting."),
        ]
        for i, (frm, to, q) in enumerate(open_reqs):
            session.add(ColleagueRequest(from_user=frm, to_member=to, question=q, status="open", created_at=_ts(i + 1)))

        # IT announcements.
        anns = [
            ("Priya Nair", "ELN maintenance tonight 22:00-23:00", "The ELN will be briefly unavailable for a scheduled update. Please save your work.", "maintenance"),
            ("Sarah Kim", "Intermittent Wi-Fi in Building C", "We're aware of Wi-Fi drops in Building C and are working on a fix. Use the wired ports meanwhile.", "incident"),
            ("Tom Becker", "Reminder: rotate your password every 90 days", "You'll get a prompt when it's due. Contact the Service Desk if you get locked out.", "info"),
        ]
        for i, (author, title, body, cat) in enumerate(anns):
            session.add(Announcement(author=author, title=title, body=body, category=cat, created_at=_ts(i + 1)))

        session.add(AppMeta(key="demo_world_v1", value="seeded"))
        session.commit()
        logger.info("Seeded demo world (bookings, routed questions, announcements).")


def get_session():
    """FastAPI dependency — yields a session."""
    with Session(engine) as session:
        yield session
