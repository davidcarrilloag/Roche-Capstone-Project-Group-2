"""
Equipment booking endpoints.

GET  /equipment        list bookable equipment
POST /bookings         reserve a piece of equipment
GET  /bookings         list current reservations

Owner: Backend.
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends

from models.schemas import BookingRequest, BookingResponse, EquipmentItem
from services.booking import BookingService, get_booking_service
from services.calendar import CalendarService, get_calendar_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["bookings"])


@router.get("/equipment", response_model=List[EquipmentItem])
def list_equipment(
    booking: BookingService = Depends(get_booking_service),
) -> List[EquipmentItem]:
    return [EquipmentItem(**e) for e in booking.list_equipment()]


@router.post("/bookings", response_model=BookingResponse)
def create_booking(
    request: BookingRequest,
    booking: BookingService = Depends(get_booking_service),
    calendar: CalendarService = Depends(get_calendar_service),
) -> BookingResponse:
    result = booking.create_booking(
        equipment_id=request.equipment_id,
        date=request.date,
        time=request.time,
        duration_minutes=request.duration_minutes,
        user=request.user,
    )

    # On a confirmed booking, write a real Google Calendar event (no-op if
    # Calendar isn't configured — the booking still succeeds).
    if result.get("status") == "confirmed":
        who = result.get("user") or "a scientist"
        link = calendar.create_event(
            summary=f"{result['equipment_name']} — reserved",
            description=(
                f"Equipment reservation {result['reference']}\n"
                f"Booked by: {who}\n"
                f"Location: {result.get('location', '')}"
            ),
            location=result.get("location", ""),
            date=result["date"],
            time=result["time"],
            duration_minutes=result["duration_minutes"],
        )
        if link:
            result["calendar_link"] = link
            booking.set_calendar_link(result["reference"], link)

    return BookingResponse(**result)


@router.get("/bookings", response_model=List[BookingResponse])
def list_bookings(
    booking: BookingService = Depends(get_booking_service),
) -> List[BookingResponse]:
    return [BookingResponse(**b) for b in booking.list_bookings()]
