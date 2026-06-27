"""
Unit tests for IntentClassifier — question vs feedback routing.

The classifier uses a keyword heuristic, so tests are fully deterministic and
require no network access or API keys.

Expected result: ~80% accuracy (16/20).
The four edge cases at the bottom document known heuristic limitations.
"""
from __future__ import annotations

import pytest

from services.classifier import IntentClassifier


@pytest.fixture(scope="module")
def clf():
    return IntentClassifier()


@pytest.mark.parametrize("message,expected", [
    # --- Clear questions: heuristic catches question-word starters and "?" ---
    ("How do I dispose of chemical waste?",           "question"),
    ("What trainings do I need as a new employee?",   "question"),
    ("Where is the cold storage room?",               "question"),
    ("Can I order lab supplies online?",              "question"),
    ("Is there a form for building access?",          "question"),
    ("Which SOP covers waste management?",            "question"),
    ("Should I wear gloves when handling chemicals?", "question"),
    ("Tell me about waste disposal procedures",       "question"),
    ("I need information about the ordering process", "question"),
    ("What is the procedure for calibration drift?",  "question"),
    # --- Clear feedback: heuristic catches strong keywords ---
    ("This process is confusing",                     "feedback"),
    ("The system is really frustrating to use",       "feedback"),
    ("This is terrible, I can't get anything done",   "feedback"),
    ("I can't find the right form anywhere",          "feedback"),
    ("The app is too slow for daily use",             "feedback"),
    ("I hate this interface",                         "feedback"),
    # --- Edge cases: heuristic does NOT catch these (expected failures) ---
    ("I couldn't find any documentation on this",    "feedback"),  # "couldn't find" != "can't find"
    ("Nothing is working anymore",                    "feedback"),  # no keyword matches → defaults to question
    ("Broken again after the update",                "feedback"),  # no keyword matches → defaults to question
    ("The process makes no sense to me",              "feedback"),  # "makes no sense" != "doesn't make sense"
], ids=[
    "q_chemical_waste", "q_trainings", "q_cold_storage", "q_order_online",
    "q_building_access", "q_which_sop", "q_gloves", "q_tell_me",
    "q_need_info", "q_calibration",
    "fb_confusing", "fb_frustrating", "fb_terrible", "fb_cant_find",
    "fb_too_slow", "fb_hate",
    "edge_couldnt_find", "edge_nothing_working",
    "edge_broken_again", "edge_makes_no_sense",
])
def test_intent(clf, message, expected):
    assert clf.classify(message) == expected
