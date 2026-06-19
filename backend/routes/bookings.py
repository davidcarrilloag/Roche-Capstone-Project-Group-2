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
) -> BookingResponse:
    result = booking.create_booking(
        equipment_id=request.equipment_id,
        date=request.date,
        time=request.time,
        duration_minutes=request.duration_minutes,
        user=request.user,
    )
    return BookingResponse(**result)


@router.get("/bookings", response_model=List[BookingResponse])
def list_bookings(
    booking: BookingService = Depends(get_booking_service),
) -> List[BookingResponse]:
    return [BookingResponse(**b, message="") for b in booking.list_bookings()]
