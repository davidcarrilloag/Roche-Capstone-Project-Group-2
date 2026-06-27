"""
Multilingual behaviour of the intent classifier and sentiment heuristics
(DE / FR / IT) — the "⚠️ ojo" row.

IMPORTANT distinction (see docs/multilingual-insights.md):
  * The assistant's *answers* are fully multilingual — that is the RAG, verified
    separately at 100% by `eval/multilingual.py` (needs a Gemini key).
  * The intent classifier and sentiment detector, however, are deterministic
    *English-keyword* heuristics. This file measures, honestly, how far they
    carry into other languages with NO keys.

The headline finding: question detection is language-agnostic (it keys off the
"?"), and a *few* sentiment cues survive into Romance languages purely because
they share a Latin root with the English keyword (urgent/urgente, confus/confuso,
and Italian "frustrato" which happens to contain the marker "frustrat"). But the
coverage is coincidental, not real i18n — German (a Germanic language) barely
registers, and even French "frustré" slips through because the marker is the
full stem "frustrat".

Two groups:
  A. What genuinely works today (asserted to pass).
  B. Known gaps (marked xfail, so they document the limitation honestly without
     pretending it is solved).

Owner: Backend / QA.
"""
from __future__ import annotations

import pytest

from services.classifier import IntentClassifier
from services.sentiment import SentimentService

clf = IntentClassifier()
snt = SentimentService()


# === GROUP A — works cross-language (deterministic, passes) =================

@pytest.mark.parametrize("text", [
    "Wie kalibriere ich das Mikroskop?",        # DE
    "Comment nettoyer la centrifugeuse ?",      # FR
    "Come faccio a prenotare il microscopio?",  # IT
    "¿Cómo reservo la centrifugadora?",         # ES bonus
])
def test_question_detection_is_language_agnostic(text):
    # A trailing "?" is recognised as a question regardless of language.
    assert clf.classify(text) == "question"


@pytest.mark.parametrize("text,expected", [
    # Romance "urgent/urgente" matches the English "urgent" frustration cue.
    ("C'est urgent, je ne peux pas travailler", "frustrated"),  # FR
    ("È urgente, sono bloccato", "frustrated"),                 # IT
    # Romance "confus/confuso" matches the "confus" confusion cue.
    ("Je suis confus avec cette procédure", "confused"),        # FR
    ("Sono confuso con questa procedura", "confused"),          # IT
    # Italian "frustrato" coincidentally contains the marker "frustrat".
    ("Sono frustrato, non funziona", "frustrated"),             # IT
])
def test_romance_sentiment_cues_survive_by_shared_root(text, expected):
    assert snt.analyze(text) == expected


# === GROUP B — known gaps (xfail: documents the limitation) =================

@pytest.mark.xfail(reason="marker is the full stem 'frustrat'; DE 'frustriert' "
                          "and FR 'frustré' don't contain it -> read as neutral",
                   strict=False)
@pytest.mark.parametrize("text", [
    "Ich bin frustriert mit diesem System",  # DE
    "Je suis frustré par cet outil",         # FR
])
def test_germanic_and_french_frustration_is_missed(text):
    assert snt.analyze(text) == "frustrated"


@pytest.mark.xfail(reason="classifier keywords are English-only; German feedback "
                          "without a '?' is misread as a question", strict=False)
@pytest.mark.parametrize("text", [
    "Das System ist sehr verwirrend",  # DE: 'verwirrend' = confusing
    "Diese Anwendung ist nutzlos",     # DE: 'nutzlos' = useless
])
def test_german_feedback_without_question_mark(text):
    assert clf.classify(text) == "feedback"


@pytest.mark.xfail(reason="sentiment keywords are English-only; German uses "
                          "Germanic words (verwirrt, Fehler) the heuristic misses",
                   strict=False)
@pytest.mark.parametrize("text,expected", [
    ("Das ist sehr verwirrend", "confused"),          # DE 'verwirrend'
    ("Es gibt einen Fehler im System", "negative"),   # DE 'Fehler' = error
])
def test_german_specific_sentiment_words(text, expected):
    assert snt.analyze(text) == expected
