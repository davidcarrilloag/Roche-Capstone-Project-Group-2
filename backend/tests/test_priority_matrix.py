"""
ITIL priority matrix: severity -> (impact, urgency) -> ServiceNow Priority.

Two layers, both deterministic and key-free:
  1. The triage mapping (severity -> impact/urgency + P-label).
  2. ServiceNow's OOB priority matrix (impact x urgency -> P1..P5) and the
     end-to-end /incidents result.

Design intent (documented in services/triage.py): the four severities are mapped
so ServiceNow computes exactly P1..P4 and *never* P5 "Planning" — a P5 incident
would mean a real problem was filed as deferrable backlog.

Owner: Backend / ServiceNow.
"""
from __future__ import annotations

import pytest

from services.triage import SEVERITY_TO_UI, PRIORITY_LABEL, TriageService
from services.servicenow import _PRIORITY_MATRIX, _priority_label


# --- 1. Triage mapping is exhaustive and never deferrable -------------------
@pytest.mark.parametrize("severity,exp_label", [
    ("critical", "P1 - Critical"),
    ("high", "P2 - High"),
    ("medium", "P3 - Moderate"),
    ("low", "P4 - Low"),
])
def test_severity_to_priority_label(severity, exp_label):
    assert PRIORITY_LABEL[severity] == exp_label


def test_every_severity_maps_to_impact_urgency():
    for severity in ("critical", "high", "medium", "low"):
        urgency, impact = SEVERITY_TO_UI[severity]
        assert 1 <= urgency <= 3 and 1 <= impact <= 3


# --- 2. ServiceNow matrix: critical -> P1, low -> P4, never P5 --------------
@pytest.mark.parametrize("severity,exp_priority_num", [
    ("critical", 1),
    ("high", 2),
    ("medium", 3),
    ("low", 4),
])
def test_matrix_yields_expected_priority(severity, exp_priority_num):
    urgency, impact = SEVERITY_TO_UI[severity]
    assert _PRIORITY_MATRIX[(impact, urgency)] == exp_priority_num


def test_no_severity_produces_planning_p5():
    for severity in ("critical", "high", "medium", "low"):
        urgency, impact = SEVERITY_TO_UI[severity]
        assert _PRIORITY_MATRIX[(impact, urgency)] != 5


def test_priority_label_helper():
    # critical = impact 1 / urgency 1 -> "1 - Critical"
    assert _priority_label(1, 1).startswith("1 -")
    # low = impact 2 / urgency 3 -> "4 - Low"
    assert _priority_label(2, 3).startswith("4 -")
    # missing inputs fall back to Low, never crash.
    assert _priority_label(None, None).startswith("4 -")


# --- 3. End-to-end through triage + incident creation -----------------------
def test_triage_classify_full_shape():
    svc = TriageService()  # has_google False in tests -> pure heuristic
    out = svc.classify("Lab-wide outage", "All users blocked, safety at risk")
    assert out["severity"] == "critical"
    assert out["priority_label"] == "P1 - Critical"
    assert (out["impact"], out["urgency"]) == (1, 1)


def test_incident_endpoint_computes_priority_from_severity(client):
    # A clearly critical incident, no explicit impact/urgency -> auto-triaged P1.
    r = client.post(
        "/incidents",
        json={
            "title": "Lab-wide network outage",
            "description": "All users cannot access lab systems, experiments at risk",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["incident_number"].startswith("INC")
    assert body["priority"].startswith("1 -")  # P1 Critical
    assert body["mock"] is True


def test_incident_endpoint_low_severity_is_p4(client):
    r = client.post(
        "/incidents",
        json={"title": "Dual monitor setup request", "description": "Need a second monitor"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["priority"].startswith("4 -")  # P4 Low, not P5
