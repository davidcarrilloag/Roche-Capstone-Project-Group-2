"""
API integration tests (FastAPI TestClient).

Exercises the real HTTP layer end-to-end against an isolated SQLite database
seeded with the demo world. Fully deterministic and key-free: MOCK_MODE is on
and no Gemini key is configured (see conftest.py), so every route returns from
the heuristic/mock paths with no network access.

What we assert is the *contract*: status codes, response shapes and the field
names the frontend depends on — not the AI content.

Owner: Backend / QA.
"""
from __future__ import annotations


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_members_contract(client):
    r = client.get("/members")
    assert r.status_code == 200
    members = r.json()
    assert isinstance(members, list) and len(members) >= 12  # synthetic roster
    sample = members[0]
    for key in ("id", "name", "role", "team", "expertise"):
        assert key in sample
    # The IT team is present (drives the IT Console / directory split).
    assert any((m["team"] or "").startswith("IT") for m in members)


def test_members_directory_has_stats(client):
    r = client.get("/members/directory")
    assert r.status_code == 200
    rows = r.json()
    assert rows, "directory should not be empty"
    row = rows[0]
    for key in ("id", "name", "answers", "open_questions", "bookings"):
        assert key in row
        if key in ("answers", "open_questions", "bookings"):
            assert isinstance(row[key], int)


def test_bookings_list_contract(client):
    r = client.get("/bookings")
    assert r.status_code == 200
    bookings = r.json()
    assert isinstance(bookings, list) and bookings, "demo world seeds bookings"
    b = bookings[0]
    for key in ("reference", "status", "equipment_name", "date", "time", "user"):
        assert key in b
    assert all(x["status"] == "confirmed" for x in bookings)


def test_equipment_catalog(client):
    r = client.get("/equipment")
    assert r.status_code == 200
    items = r.json()
    assert any(i["type"] == "equipment" for i in items)
    assert any(i["type"] == "room" for i in items)  # rooms bookable like resources


def test_experts_suggest_contract(client):
    r = client.post("/experts/suggest", json={"question": "How do I run a PCR?"})
    assert r.status_code == 200
    experts = r.json()
    assert isinstance(experts, list) and experts
    e = experts[0]
    for key in ("name", "role", "team", "expertise", "matched_on"):
        assert key in e


def test_announcements_contract(client):
    r = client.get("/announcements")
    assert r.status_code == 200
    anns = r.json()
    assert isinstance(anns, list) and anns, "demo world seeds IT announcements"
    a = anns[0]
    for key in ("id", "title", "category", "author", "active"):
        assert key in a
    assert all(x["active"] for x in anns)


def test_it_questions_contract(client):
    r = client.get("/it/questions")
    assert r.status_code == 200
    data = r.json()
    for key in ("open", "answered", "count_open", "count_total"):
        assert key in data
    assert isinstance(data["open"], list)
    # Demo world routes several scientist questions to the IT team.
    assert data["count_total"] >= 1


def test_activity_feed_contract(client):
    r = client.get("/activity?limit=10")
    assert r.status_code == 200
    events = r.json()
    assert isinstance(events, list) and 0 < len(events) <= 10
    types = {e["type"] for e in events}
    assert types <= {"booking", "question", "answer", "announcement"}
    for e in events:
        for key in ("type", "actor", "text", "ts"):
            assert key in e
    # Sorted newest-first by timestamp.
    ts = [e["ts"] for e in events]
    assert ts == sorted(ts, reverse=True)


def test_incidents_triage_contract(client):
    r = client.post(
        "/incidents/triage",
        json={"title": "VPN down", "description": "VPN not connecting, urgent"},
    )
    assert r.status_code == 200
    data = r.json()
    for key in ("category", "severity", "urgency", "impact", "priority_label"):
        assert key in data
    assert data["category"] in ("software", "hardware", "network", "access", "inquiry")
    assert data["severity"] in ("critical", "high", "medium", "low")
    assert 1 <= data["urgency"] <= 3 and 1 <= data["impact"] <= 3
