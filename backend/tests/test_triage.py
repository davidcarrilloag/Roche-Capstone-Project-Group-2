"""
Unit tests for TriageService — incident category and severity classification.

Uses the keyword heuristic fallback (no Google/Gemini key) so tests are
fully deterministic and require no network access or API keys.

Expected result: ~80% accuracy (16/20).
Failures occur where multiple categories share keywords (e.g. network vs
access) or where severity requires contextual judgement beyond keywords.
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from services.triage import TriageService


@pytest.fixture(scope="module")
def svc():
    settings = MagicMock()
    settings.has_google = False
    return TriageService(settings=settings)


@pytest.mark.parametrize("title,description,exp_category,exp_severity", [
    # --- Clear cases: heuristic handles these correctly ---
    (
        "Printer not working",
        "The office printer is broken",
        "hardware", "low",
    ),
    (
        "Cannot connect to WiFi",
        "WiFi drops every few minutes",
        "network", "low",
    ),
    (
        "VPN not connecting",
        "VPN does not work, urgent fix needed",
        "network", "high",
    ),
    (
        "Password reset needed",
        "I forgot my password and cannot log in",
        "access", "low",
    ),
    (
        "ELN crashes on startup",
        "The ELN app crashes every time it starts",
        "software", "low",
    ),
    (
        "Lab-wide network outage",
        "All users cannot access lab systems",
        "network", "critical",
    ),
    (
        "Badge reader broken",
        "Cannot access the building, badge is not working",
        "access", "low",
    ),
    (
        "Laptop running slowly",
        "My laptop is very slow since the last update",
        "hardware", "medium",
    ),
    (
        "LIMS unavailable",
        "LIMS is down, experiment blocked",
        "software", "high",
    ),
    (
        "Monitor flickering",
        "Screen flickers intermittently",
        "hardware", "medium",
    ),
    (
        "Software license expired",
        "The analysis software license has expired",
        "software", "low",
    ),
    (
        "Keyboard not responding",
        "USB keyboard stopped working after Windows update",
        "hardware", "low",
    ),
    (
        "VPN blocking data uploads",
        "Cannot upload experiment data, VPN is restricting it",
        "network", "high",
    ),
    (
        "Application crash on startup",
        "Analysis application crashes when launched",
        "software", "low",
    ),
    (
        "Dual monitor setup request",
        "Need help setting up dual monitors for workstation",
        "hardware", "low",
    ),
    (
        "ELN session timeout",
        "ELN keeps logging me out, session expires too quickly",
        "software", "low",
    ),
    # --- Edge cases: heuristic does NOT classify correctly (expected failures) ---
    (
        "Shared folder access denied",
        "I don't have permission for the network shared drive",
        "access", "low",      # actual: network/low — "network" keyword matched before "access"
    ),
    (
        "Mass spectrometer connection issue",
        "Instrument not connecting to the PC",
        "hardware", "high",   # actual: network/high — "connect" triggers network before hardware
    ),
    (
        "Email client not opening",
        "Outlook won't launch on my workstation",
        "software", "low",    # actual: inquiry/low — no software keywords in description
    ),
    (
        "Cold storage temperature alarm",
        "Temperature alarm triggered in cold room, samples at risk",
        "inquiry", "critical", # actual: inquiry/low — "safety" keyword missing, risk not detected
    ),
], ids=[
    "printer_low", "wifi_low", "vpn_urgent_high", "password_low",
    "eln_crash_low", "labwide_critical", "badge_low", "laptop_medium",
    "lims_experiment_high", "monitor_intermittent", "license_low",
    "keyboard_low", "vpn_upload_high", "app_crash_low",
    "dual_monitor_low", "eln_session_low",
    "edge_network_vs_access", "edge_connect_vs_hardware",
    "edge_email_no_keyword", "edge_cold_storage_critical",
])
def test_triage(svc, title, description, exp_category, exp_severity):
    result = svc.classify(title, description)
    assert result["category"] == exp_category, (
        f"category: expected '{exp_category}', got '{result['category']}'"
    )
    assert result["severity"] == exp_severity, (
        f"severity: expected '{exp_severity}', got '{result['severity']}'"
    )
