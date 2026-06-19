"""
Equipment booking — persisted in the database.

A synthetic catalog of bookable lab equipment plus reservations stored in the
SQLite database (so they survive restarts). Conflicts (overlapping reservations
on the same equipment) are rejected. Each booking records who made it (the
synthetic identity), enabling the shared/team views.

Owner: Backend.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta
from typing import List, Optional

from sqlmodel import Session, select

from db import Booking, engine

logger = logging.getLogger(__name__)

# Synthetic but realistic lab equipment (static catalog, not in the DB).
EQUIPMENT: List[dict] = [
    {"id": "centrifuge-01", "name": "Centrifuge (Eppendorf 5424R)", "category": "Sample prep", "location": "Lab A-101"},
    {"id": "freezer-80", "name": "-80 °C Freezer (Unit B-3)", "category": "Cold storage", "location": "Cold Room B-012"},
    {"id": "thermocycler-01", "name": "PCR Thermocycler (Bio-Rad C1000)", "category": "Molecular biology", "location": "Lab A-103"},
    {"id": "confocal-01", "name": "Confocal Microscope (Zeiss LSM 900)", "category": "Imaging", "location": "Imaging Suite C-201"},
    {"id": "platereader-01", "name": "Plate Reader (Tecan Spark)", "category": "Analytics", "location": "Lab A-105"},
    {"id": "fumehood-02", "name": "Fume Hood #2", "category": "Chemistry", "location": "Lab A-101"},
    {"id": "autoclave-01", "name": "Autoclave (Tuttnauer 3870)", "category": "Sterilization", "location": "Sterilization Room A-010"},
    {"id": "massspec-01", "name": "Mass Spectrometer (Thermo Q Exactive)", "category": "Analytics", "location": "Analytics Lab C-110"},
]

_EQUIPMENT_BY_ID = {e["id"]: e for e in EQUIPMENT}


def _reference(booking_id: int) -> str:
    return f"BKG-{booking_id:04d}"


def _to_dict(b: Booking) -> dict:
    return {
        "reference": _reference(b.id),
        "status": b.status,
        "equipment_id": b.equipment_id,
        "equipment_name": b.equipment_name,
        "location": b.location,
        "date": b.date,
        "time": b.time,
        "duration_minutes": b.duration_minutes,
        "user": b.user,
        "calendar_link": b.calendar_link,
        "message": "",
    }


class BookingService:
    """Persisted equipment reservations with overlap checking."""

    def __init__(self) -> None:
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    def list_equipment(self) -> List[dict]:
        return list(EQUIPMENT)

    def list_bookings(self) -> List[dict]:
        with Session(engine) as session:
            rows = session.exec(
                select(Booking).where(Booking.status == "confirmed").order_by(Booking.date, Booking.time)
            ).all()
            return [_to_dict(b) for b in rows]

    def _parse_start_end(self, date: str, time: str, duration_minutes: int):
        start = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        return start, start + timedelta(minutes=duration_minutes)

    def _conflict(self, session: Session, equipment_id: str, start: datetime, end: datetime) -> Optional[Booking]:
        rows = session.exec(
            select(Booking).where(
                Booking.equipment_id == equipment_id, Booking.status == "confirmed"
            )
        ).all()
        for b in rows:
            try:
                b_start, b_end = self._parse_start_end(b.date, b.time, b.duration_minutes)
            except ValueError:
                continue
            if start < b_end and b_start < end:
                return b
        return None

    def create_booking(
        self,
        equipment_id: str,
        date: str,
        time: str,
        duration_minutes: int = 60,
        user: Optional[str] = None,
    ) -> dict:
        equipment = _EQUIPMENT_BY_ID.get(equipment_id)
        if not equipment:
            return {"status": "conflict", "message": f"Unknown equipment '{equipment_id}'."}

        try:
            start, end = self._parse_start_end(date, time, duration_minutes)
        except ValueError:
            return {"status": "conflict", "message": "Invalid date or time format."}

        with self._lock, Session(engine) as session:
            clash = self._conflict(session, equipment_id, start, end)
            if clash:
                return {
                    "status": "conflict",
                    "equipment_id": equipment_id,
                    "equipment_name": equipment["name"],
                    "location": equipment["location"],
                    "date": date,
                    "time": time,
                    "duration_minutes": duration_minutes,
                    "user": user or "",
                    "message": (
                        f"{equipment['name']} is already booked on {clash.date} "
                        f"at {clash.time} ({clash.duration_minutes} min). "
                        "Please pick another slot."
                    ),
                }

            booking = Booking(
                equipment_id=equipment_id,
                equipment_name=equipment["name"],
                location=equipment["location"],
                date=date,
                time=time,
                duration_minutes=duration_minutes,
                user=user or "",
                status="confirmed",
            )
            session.add(booking)
            session.commit()
            session.refresh(booking)
            logger.info("Booking %s: %s on %s %s (%s)", _reference(booking.id), equipment["name"], date, time, user or "-")
            return _to_dict(booking)

    def set_calendar_link(self, reference: str, link: str) -> None:
        """Persist the Calendar event link after the booking is created."""
        try:
            booking_id = int(reference.split("-")[-1])
        except (ValueError, IndexError):
            return
        with Session(engine) as session:
            b = session.get(Booking, booking_id)
            if b:
                b.calendar_link = link
                session.add(b)
                session.commit()


_booking_singleton: Optional[BookingService] = None


def get_booking_service() -> BookingService:
    global _booking_singleton
    if _booking_singleton is None:
        _booking_singleton = BookingService()
    return _booking_singleton
