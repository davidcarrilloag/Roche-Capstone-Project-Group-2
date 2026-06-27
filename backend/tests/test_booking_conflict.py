"""
Booking conflict / overlap logic.

Reserving a resource that overlaps an existing confirmed reservation must be
rejected; adjacent (back-to-back) and same-time-different-resource bookings must
succeed. Driven through the real /bookings endpoint against the isolated test DB.

All bookings here use a far-future date so they never collide with the seeded
demo world. Deterministic, no keys.

Owner: Backend / QA.
"""
from __future__ import annotations

import pytest

FUTURE = "2030-03-15"  # far enough that the demo seed never touches it


def _book(client, equipment_id, time, duration, user="Tester"):
    return client.post(
        "/bookings",
        json={
            "equipment_id": equipment_id,
            "date": FUTURE,
            "time": time,
            "duration_minutes": duration,
            "user": user,
        },
    )


def test_first_booking_confirms(client):
    r = _book(client, "centrifuge-01", "10:00", 60)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "confirmed"
    assert body["reference"].startswith("BKG-")
    assert body["equipment_name"]  # resolved from the catalog


def test_overlapping_booking_conflicts(client):
    # 09:00-10:00 confirmed, then 09:30 (overlaps) must clash.
    assert _book(client, "freezer-80", "09:00", 60).json()["status"] == "confirmed"
    clash = _book(client, "freezer-80", "09:30", 60)
    assert clash.status_code == 200
    body = clash.json()
    assert body["status"] == "conflict"
    assert "already booked" in body["message"].lower()


def test_adjacent_booking_is_allowed(client):
    # Back-to-back slots must NOT be treated as overlapping (end == start).
    assert _book(client, "platereader-01", "08:00", 60).json()["status"] == "confirmed"
    nxt = _book(client, "platereader-01", "09:00", 60)
    assert nxt.json()["status"] == "confirmed"


def test_same_time_different_resource_is_allowed(client):
    assert _book(client, "thermocycler-01", "14:00", 60).json()["status"] == "confirmed"
    other = _book(client, "autoclave-01", "14:00", 60)
    assert other.json()["status"] == "confirmed"


def test_fully_contained_booking_conflicts(client):
    # A short booking entirely inside a longer one is still a clash.
    assert _book(client, "massspec-01", "11:00", 120).json()["status"] == "confirmed"
    inside = _book(client, "massspec-01", "11:30", 30)
    assert inside.json()["status"] == "conflict"


def test_unknown_equipment_is_rejected(client):
    r = _book(client, "does-not-exist", "10:00", 60)
    assert r.json()["status"] == "conflict"
    assert "unknown" in r.json()["message"].lower()
