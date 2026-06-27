"""
Triage uplift experiment — keyword heuristic vs Gemini on the SAME 20 cases.

Quantifies what the LLM buys for incident triage: runs the triage test set once
with the heuristic (has_google=False) and once with Gemini (real settings, needs
GOOGLE_API_KEY), and reports category / severity / exact-match accuracy.

Run:  cd backend && python -m eval.triage_uplift
"""

from __future__ import annotations

from unittest.mock import MagicMock

from config import get_settings
from services.triage import TriageService

# (title, description, expected_category, expected_severity) — mirrors tests/test_triage.py
CASES = [
    ("Printer not working", "The office printer is broken", "hardware", "low"),
    ("Cannot connect to WiFi", "WiFi drops every few minutes", "network", "low"),
    ("VPN not connecting", "VPN does not work, urgent fix needed", "network", "high"),
    ("Password reset needed", "I forgot my password and cannot log in", "access", "low"),
    ("ELN crashes on startup", "The ELN app crashes every time it starts", "software", "low"),
    ("Lab-wide network outage", "All users cannot access lab systems", "network", "critical"),
    ("Badge reader broken", "Cannot access the building, badge is not working", "access", "low"),
    ("Laptop running slowly", "My laptop is very slow since the last update", "hardware", "medium"),
    ("LIMS unavailable", "LIMS is down, experiment blocked", "software", "high"),
    ("Monitor flickering", "Screen flickers intermittently", "hardware", "medium"),
    ("Software license expired", "The analysis software license has expired", "software", "low"),
    ("Keyboard not responding", "USB keyboard stopped working after Windows update", "hardware", "low"),
    ("VPN blocking data uploads", "Cannot upload experiment data, VPN is restricting it", "network", "high"),
    ("Application crash on startup", "Analysis application crashes when launched", "software", "low"),
    ("Dual monitor setup request", "Need help setting up dual monitors for workstation", "hardware", "low"),
    ("ELN session timeout", "ELN keeps logging me out, session expires too quickly", "software", "low"),
    # edge cases
    ("Shared folder access denied", "I don't have permission for the network shared drive", "access", "low"),
    ("Mass spectrometer connection issue", "Instrument not connecting to the PC", "hardware", "high"),
    ("Email client not opening", "Outlook won't launch on my workstation", "software", "low"),
    ("Cold storage temperature alarm", "Temperature alarm triggered in cold room, samples at risk", "inquiry", "critical"),
]


def run(name: str, svc: TriageService, delay: float = 0.0) -> dict:
    import time

    cat_ok = sev_ok = both_ok = 0
    rows = []
    for title, desc, exp_cat, exp_sev in CASES:
        r = svc.classify(title, desc)
        if delay:
            time.sleep(delay)  # stay under the free-tier rate limit (15/min)
        c = r["category"] == exp_cat
        s = r["severity"] == exp_sev
        cat_ok += c
        sev_ok += s
        both_ok += c and s
        rows.append((title, exp_cat, exp_sev, r["category"], r["severity"], c and s))
    n = len(CASES)
    print(f"\n=== {name} ===")
    print(f"  category:   {cat_ok}/{n}  ({100*cat_ok/n:.0f}%)")
    print(f"  severity:   {sev_ok}/{n}  ({100*sev_ok/n:.0f}%)")
    print(f"  both (exact): {both_ok}/{n}  ({100*both_ok/n:.0f}%)")
    for title, ec, es, gc, gs, ok in rows:
        if not ok:
            print(f"    [MISS] {title:38} exp={ec}/{es:8} got={gc}/{gs}")
    return {"category": cat_ok, "severity": sev_ok, "both": both_ok, "n": n}


def main() -> None:
    heuristic = TriageService(settings=MagicMock(has_google=False))
    h = run("HEURISTIC (no LLM)", heuristic)

    settings = get_settings()
    if not settings.has_google:
        print("\nGOOGLE_API_KEY not set — skipping the Gemini run.")
        return
    g = run("GEMINI", TriageService(settings=settings), delay=4.5)

    print("\n=== UPLIFT (exact match) ===")
    print(f"  heuristic: {h['both']}/{h['n']}  ({100*h['both']/h['n']:.0f}%)")
    print(f"  gemini:    {g['both']}/{g['n']}  ({100*g['both']/g['n']:.0f}%)")
    print(f"  delta:     {g['both']-h['both']:+d} cases")


if __name__ == "__main__":
    main()
