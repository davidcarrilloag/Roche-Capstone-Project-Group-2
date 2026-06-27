"""
Expert matcher: route a question to the colleague most likely to know.

Scores each member's expertise tags + team against the question (whole-tag
phrase match + token overlap + light synonyms). Driven through /experts/suggest
against the seeded roster. Deterministic, no keys.

Owner: Backend / QA.
"""
from __future__ import annotations

import pytest


def _suggest(client, question):
    r = client.post("/experts/suggest", json={"question": question})
    assert r.status_code == 200
    return r.json()


def _names(experts):
    return [e["name"] for e in experts]


def test_vpn_routes_to_it_network_engineer(client):
    experts = _suggest(client, "I can't connect to the VPN from home")
    assert experts, "should find at least one expert"
    top = experts[0]
    assert top["name"] == "Sarah Kim"           # Network & Systems Engineer
    assert top["team"].startswith("IT")
    assert "vpn" in top["matched_on"].lower()


def test_crispr_routes_to_geneticist(client):
    experts = _suggest(client, "Best way to validate a CRISPR knockout?")
    assert experts[0]["name"] == "Dr. Carla Moreno"
    assert "crispr" in experts[0]["matched_on"].lower()


def test_mass_spec_routes_to_analytics(client):
    experts = _suggest(client, "Which calibration standard for mass spectrometry?")
    assert "Dr. Sophie Dubois" in _names(experts)  # Mass spectrometry, HPLC


def test_western_blot_routes_to_biochemist(client):
    experts = _suggest(client, "Why is my western blot background so high?")
    assert "Dr. Anna Schmidt" in _names(experts)  # Protein purification, Western blot


def test_confocal_routes_to_imaging_experts(client):
    experts = _suggest(client, "How do I reduce photobleaching on the confocal microscope?")
    names = _names(experts)
    # Both Elena Fischer and Hiroshi Tanaka list confocal microscopy.
    assert any(n in names for n in ("Dr. Elena Fischer", "Dr. Hiroshi Tanaka"))


def test_no_match_returns_empty(client):
    # A question with no overlap with any expertise tag yields no suggestion,
    # so the UI can fall back to a general route instead of a bad guess.
    experts = _suggest(client, "What time is lunch in the cafeteria today?")
    assert experts == []


def test_limit_is_respected(client):
    # /experts/suggest returns at most 2 (the default top-N).
    experts = _suggest(client, "PCR primers cloning microscopy VPN CRISPR")
    assert len(experts) <= 2
