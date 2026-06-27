"""
Unit tests for SentimentService — emotional tone classification.

The service uses a keyword heuristic, so tests are fully deterministic and
require no network access or API keys.

Labels: positive, negative, neutral, frustrated, confused, satisfied
Expected result: ~70% accuracy (14/20).
Edge cases expose sarcasm and implicit frustration the heuristic misses.
"""
from __future__ import annotations

import pytest

from services.sentiment import SentimentService


@pytest.fixture(scope="module")
def svc():
    return SentimentService()


@pytest.mark.parametrize("message,expected", [
    # --- Clear cases: heuristic handles these correctly ---
    ("Thank you, this works perfectly!",               "satisfied"),
    ("I'm so frustrated with this system",             "frustrated"),
    ("I don't understand the calibration process",     "confused"),
    ("The app keeps crashing",                         "negative"),
    ("Great, very helpful tool!",                      "satisfied"),
    ("I cannot access the building",                   "negative"),
    ("Still not working after the update",             "frustrated"),
    ("This process is really annoying",                "frustrated"),
    ("The system failed during my experiment",         "negative"),
    ("Perfect, exactly what I needed",                 "satisfied"),
    ("Where is the waste disposal area?",              "confused"),
    ("It worked once but now it fails every time",     "negative"),
    ("Thanks for the quick response!",                 "satisfied"),
    ("The error keeps appearing on every login",       "negative"),
    # --- Edge cases: heuristic does NOT handle these (expected failures) ---
    ("Another error, great.",                          "negative"),   # sarcasm: "great" keyword → satisfied
    ("I need this fixed immediately",                  "frustrated"), # no keywords → neutral
    ("Everything is broken, thanks a lot",             "negative"),   # "thank" keyword → satisfied
    ("The lab is inaccessible for everyone right now", "negative"),   # no keywords → neutral
    ("My samples are all ruined",                      "negative"),   # no keywords → neutral
    ("I've been unable to get in for 30 minutes",      "frustrated"), # no keywords → neutral
], ids=[
    "satisfied_thanks_works", "frustrated_explicit", "confused_dont_understand",
    "negative_crash", "satisfied_great_helpful", "negative_cannot",
    "frustrated_still_not", "frustrated_annoying", "negative_failed",
    "satisfied_perfect", "confused_where_is", "negative_fails_everytime",
    "satisfied_thanks_response", "negative_error_login",
    "edge_sarcasm_great", "edge_urgent_no_keyword",
    "edge_broken_thanks", "edge_inaccessible", "edge_ruined", "edge_unable",
])
def test_sentiment(svc, message, expected):
    assert svc.analyze(message) == expected
