"""
Equipment booking — in-app, self-contained.

A synthetic catalog of bookable lab equipment plus an in-memory reservation
store. No external system or OAuth: reservations live in the backend process
(like the feedback store) and are returned with a BKG-#### reference. Conflicts
(overlapping reservations on the same equipment) are rejected.

This is the "agentic action" the assistant can take on the user's behalf, and a
clean seam to later write reservations to Google Calendar (feature #5).

Owner: Backend.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta
from typing import List, Optional

logger = logging.getLogger(__name__)

# Synthetic but realistic lab equipment.
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


class BookingService:
    """In-memory equipment reservations with overlap checking."""

    def __init__(self) -> None:
        self._bookings: List[dict] = []
        self._counter = 0
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    def list_equipment(self) -> List[dict]:
        return list(EQUIPMENT)

    def list_bookings(self) -> List[dict]:
        return list(self._bookings)

    def _parse_start_end(self, date: str, time: str, duration_minutes: int):
        start = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        return start, start + timedelta(minutes=duration_minutes)

    def _conflict(self, equipment_id: str, start: datetime, end: datetime) -> Optional[dict]:
        for b in self._bookings:
            if b["equipment_id"] != equipment_id or b["status"] != "confirmed":
                continue
            b_start, b_end = self._parse_start_end(b["date"], b["time"], b["duration_minutes"])
            # Overlap if one starts before the other ends.
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

        with self._lock:
            clash = self._conflict(equipment_id, start, end)
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
                        f"{equipment['name']} is already booked on {clash['date']} "
                        f"at {clash['time']} ({clash['duration_minutes']} min). "
                        "Please pick another slot."
                    ),
                }

            self._counter += 1
            reference = f"BKG-{self._counter:04d}"
            booking = {
                "reference": reference,
                "status": "confirmed",
                "equipment_id": equipment_id,
                "equipment_name": equipment["name"],
                "location": equipment["location"],
                "date": date,
                "time": time,
                "duration_minutes": duration_minutes,
                "user": user or "",
                "created_at": datetime.utcnow().isoformat(),
            }
            self._bookings.append(booking)

        logger.info("Booking %s: %s on %s %s (%s)", reference, equipment["name"], date, time, user or "-")
        return {**booking, "message": ""}


_booking_singleton: Optional[BookingService] = None


def get_booking_service() -> BookingService:
    global _booking_singleton
    if _booking_singleton is None:
        _booking_singleton = BookingService()
    return _booking_singleton
