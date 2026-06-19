"""
Expert finder — match a question to the colleague most likely to know.

Scores each lab member's expertise/team against the question (keyword + token
overlap). Used by "ask a colleague" when the SOPs don't have the answer.

Owner: Backend.
"""

from __future__ import annotations

import re
from typing import List

from sqlmodel import Session, select

from db import LabMember, engine

# Light synonyms so everyday phrasing reaches the expertise tags.
SYNONYMS = {
    "microscope": "microscopy",
    "microscopy": "confocal",
    "pcr": "pcr",
    "sequencing": "ngs",
    "crispr": "crispr",
    "freezer": "cold",
    "spectrometer": "spectrometry",
    "western": "western",
    "blot": "western",
    "cells": "cell",
    "culture": "culture",
    "protein": "protein",
    "imaging": "image",
}


def _tokens(text: str) -> set:
    return set(re.findall(r"[a-zà-ÿ]{3,}", (text or "").lower()))


def suggest_experts(question: str, limit: int = 2) -> List[dict]:
    q = (question or "").lower()
    q_tokens = _tokens(q)
    # Expand with synonyms.
    for w in list(q_tokens):
        if w in SYNONYMS:
            q_tokens.add(SYNONYMS[w])

    with Session(engine) as session:
        members = session.exec(select(LabMember)).all()

    scored = []
    for m in members:
        tags = [t.strip().lower() for t in (m.expertise or "").split(",") if t.strip()]
        tags_plus = tags + [m.team.lower()] if m.team else tags
        matched = set()
        score = 0.0
        for tag in tags_plus:
            # whole-tag phrase appears in the question → strong signal
            if tag and tag in q:
                score += 3
                matched.add(tag)
            # token overlap on the tag's words
            for w in _tokens(tag):
                if w in q_tokens:
                    score += 1
                    matched.add(tag)
        if score > 0:
            scored.append((score, m, sorted(matched)))

    scored.sort(key=lambda x: (-x[0], x[1].name))
    out = []
    for score, m, matched in scored[:limit]:
        out.append(
            {
                "name": m.name,
                "role": m.role,
                "team": m.team,
                "expertise": m.expertise,
                "matched_on": ", ".join(matched),
            }
        )
    return out
