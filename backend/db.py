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


def team_for_member(name: Optional[str]) -> Optional[str]:
    """Resolve a member's team from their name (DB first, static roster fallback).

    Used to tag incoming feedback with the author's team so the dashboard can
    filter feedback by team (e.g. 'Imaging'). Returns None if unknown.
    """
    if not name:
        return None
    try:
        with Session(engine) as session:
            m = session.exec(select(LabMember).where(LabMember.name == name)).first()
            if m:
                return m.team
    except Exception:  # never let a lookup break feedback storage
        pass
    for m in SYNTHETIC_MEMBERS:
        if m["name"] == name:
            return m["team"]
    return None


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
    Populate a rich, lived-in world (bookings across the week, realistic routed
    questions, IT announcements) so the app feels genuinely used from any
    perspective. Answered questions are also indexed into the RAG (community
    knowledge), so the assistant actually knows them. Runs once, guarded by an
    AppMeta flag, so a user's own activity is never wiped.
    """
    seed_community: list = []
    with Session(engine) as session:
        if session.get(AppMeta, "demo_world_v2"):
            return  # already seeded

        # Fresh start for activity tables so the demo is deterministic.
        for model in (Booking, ColleagueRequest, Announcement):
            for row in session.exec(select(model)).all():
                session.delete(row)

        from services.booking import EQUIPMENT
        eq = {e["id"]: e for e in EQUIPMENT}
        d0 = date.today()
        counter = {"i": 0}

        def nts() -> str:
            counter["i"] += 1
            return _ts(counter["i"] * 2)  # stagger every ~2h into the past

        def day(n):
            return (d0 + timedelta(days=n)).isoformat()

        # Bookings: matched to each person's domain, spread past + upcoming.
        # (day_offset, equipment_id, time, duration_min, user)
        bookings = [
            (-3, "confocal-01", "09:00", 60, "Dr. Elena Fischer"),
            (-3, "thermocycler-01", "11:00", 120, "Dr. Marco Rossi"),
            (-3, "massspec-01", "14:00", 90, "Dr. Sophie Dubois"),
            (-2, "platereader-01", "10:00", 60, "Dr. Anna Schmidt"),
            (-2, "room-bsl2-c105", "13:00", 180, "Dr. Carla Moreno"),
            (-2, "centrifuge-01", "16:00", 30, "Dr. Liam O'Brien"),
            (-1, "confocal-01", "09:00", 90, "Dr. Hiroshi Tanaka"),
            (-1, "room-cellculture-a108", "11:00", 120, "Dr. Liam O'Brien"),
            (-1, "fumehood-02", "15:00", 60, "Dr. James Patel"),
            (0, "massspec-01", "09:00", 90, "Dr. Sophie Dubois"),
            (0, "centrifuge-01", "11:00", 30, "Dr. Liam O'Brien"),
            (0, "thermocycler-01", "14:00", 120, "Dr. Marco Rossi"),
            (0, "room-darkroom-c118", "16:00", 60, "Dr. Elena Fischer"),
            (1, "confocal-01", "10:00", 60, "Dr. Elena Fischer"),
            (1, "platereader-01", "13:00", 90, "Dr. Anna Schmidt"),
            (1, "room-meeting-a200", "15:00", 30, "Dr. Marco Rossi"),
            (2, "room-bsl2-c105", "09:00", 180, "Dr. Carla Moreno"),
            (2, "autoclave-01", "13:00", 45, "Dr. James Patel"),
            (2, "room-tissue-a112", "15:00", 60, "Dr. Liam O'Brien"),
            (3, "thermocycler-01", "10:00", 120, "Dr. Carla Moreno"),
            (3, "room-conference-g01", "14:00", 60, "Dr. Sophie Dubois"),
            (4, "confocal-01", "09:00", 90, "Dr. Hiroshi Tanaka"),
            (4, "room-cellculture-a108", "11:00", 120, "Dr. Liam O'Brien"),
            (5, "massspec-01", "10:00", 90, "Dr. Sophie Dubois"),
        ]
        for off, eid, tm, dur, user in bookings:
            e = eq.get(eid, {})
            session.add(Booking(
                equipment_id=eid, equipment_name=e.get("name", eid), location=e.get("location", ""),
                date=day(off), time=tm, duration_minutes=dur, user=user, status="confirmed", created_at=nts(),
            ))

        # Answered questions (scientist <-> scientist): contributions + community knowledge.
        answered = [
            ("Dr. Marco Rossi", "Dr. Hiroshi Tanaka", "How do I align the confocal laser?", "Open ZEN, run the Laser Alignment Wizard, then center the pinhole with auto-align. Recheck collimation weekly."),
            ("Dr. Liam O'Brien", "Dr. Elena Fischer", "What is the best fixation for immunostaining?", "4% PFA for 15 min at room temperature, then three PBS washes. Avoid over-fixation, it can mask epitopes."),
            ("Dr. Anna Schmidt", "Dr. Sophie Dubois", "Which HPLC column should I use for small peptides?", "A C18 with a shallow acetonitrile gradient; keep the flow at 0.3 mL/min and the column at 30 C."),
            ("Dr. Carla Moreno", "Dr. Marco Rossi", "What annealing temperature should I use for new primers?", "Start about 3 C below the lower primer Tm and run a 55-65 C gradient to optimise. Check for primer dimers first."),
            ("Dr. Elena Fischer", "Dr. Hiroshi Tanaka", "How do I reduce photobleaching on the confocal?", "Lower the laser power and raise the gain, use an anti-fade mounting medium, and minimise exposure between captures."),
            ("Dr. James Patel", "Dr. Sophie Dubois", "Which calibration standard for the mass spectrometer?", "Use the manufacturer tune mix weekly, log results in LEMS, and flag any drift above 5 ppm."),
            ("Dr. Liam O'Brien", "Dr. Anna Schmidt", "Why is my Western blot background so high?", "Increase blocking to 5% milk, dilute the primary antibody further, and add 0.1% Tween to the wash buffer."),
            ("Dr. Marco Rossi", "Dr. Carla Moreno", "Best way to validate a CRISPR knockout?", "Do a quick T7E1 mismatch assay, then confirm with Sanger sequencing across the cut site."),
        ]
        for frm, to, q, a in answered:
            session.add(ColleagueRequest(from_user=frm, to_member=to, question=q, answer=a, status="answered", created_at=nts()))
            seed_community.append((q, a, to))

        # Open questions (inboxes): scientist <-> scientist + scientist -> IT.
        open_reqs = [
            ("Dr. Sophie Dubois", "Dr. Marco Rossi", "Could you share your qPCR protocol for the new primers?"),
            ("Dr. Anna Schmidt", "Dr. Elena Fischer", "Do you have a spare confocal slot this week?"),
            ("Dr. Carla Moreno", "Priya Nair", "My ELN won't open after last night's update."),
            ("Dr. Elena Fischer", "Tom Becker", "I can't connect to the VPN from home."),
            ("Dr. Marco Rossi", "Sarah Kim", "The lab file share keeps disconnecting."),
            ("Dr. Liam O'Brien", "Diego Fernández", "The flow cytometer PC won't recognise the new software license."),
        ]
        for frm, to, q in open_reqs:
            session.add(ColleagueRequest(from_user=frm, to_member=to, question=q, status="open", created_at=nts()))

        # IT announcements.
        anns = [
            ("Priya Nair", "ELN maintenance tonight 22:00-23:00", "The ELN will be briefly unavailable for a scheduled update. Please save your work beforehand.", "maintenance"),
            ("Sarah Kim", "Intermittent Wi-Fi in Building C", "We are aware of Wi-Fi drops in Building C and are working on a fix. Use the wired ports meanwhile.", "incident"),
            ("Diego Fernández", "Instrument PC updates this Friday 18:00", "Acquisition PCs in Lab A will reboot for updates. Please log out and save your data by 17:45.", "maintenance"),
            ("Tom Becker", "Reminder: rotate your password every 90 days", "You will get a prompt when it is due. Contact the Service Desk if you get locked out.", "info"),
            ("Priya Nair", "New LIMS CSV export is live", "You can now export sample batches to CSV directly from the LIMS dashboard.", "info"),
        ]
        for author, title, body, cat in anns:
            session.add(Announcement(author=author, title=title, body=body, category=cat, created_at=nts()))

        session.add(AppMeta(key="demo_world_v2", value="seeded"))
        session.commit()
        logger.info("Seeded rich demo world (%d bookings, %d answered, %d open, %d announcements).",
                    len(bookings), len(answered), len(open_reqs), len(anns))

    # Index the answered questions into the RAG so the assistant knows them
    # (best-effort: needs a Gemini key; never blocks startup).
    try:
        from services.ingest import add_community_answer

        for i, (q, a, author) in enumerate(seed_community):
            try:
                add_community_answer(question=q, answer=a, author=author, doc_id=f"COMMUNITY-SEED-{i}")
            except Exception:  # pragma: no cover - per-item resilience
                pass
        logger.info("Indexed %d community answers into the RAG.", len(seed_community))
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Community seed indexing skipped: %s", exc)


def get_session():
    """FastAPI dependency — yields a session."""
    with Session(engine) as session:
        yield session
