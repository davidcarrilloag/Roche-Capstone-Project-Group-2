"""
Intent classifier: decides whether a scientist's message is a knowledge
QUESTION (route to RAG) or FEEDBACK (route to the feedback service).

Owner: shared (used by the chat route).

Uses a fast keyword heuristic — deterministic, offline, and good enough for the
clear majority of messages (see backend/tests).

Examples
--------
Question : "How do I clean my centrifuge?"  -> "question"
Feedback : "This process is confusing."      -> "feedback"
           "I can't find the right app."      -> "feedback"
"""

from __future__ import annotations

from typing import Optional

from config import Settings, get_settings


class IntentClassifier:
    """Question vs feedback classification with a keyword heuristic."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def classify(self, text: str) -> str:
        """Return 'question' or 'feedback'."""
        if not text or not text.strip():
            return "question"
        quick = self._quick(text)
        if quick is not None:
            return quick
        return self._heuristic(text)

    @staticmethod
    def _quick(text: str) -> Optional[str]:
        """Confident classification for clear cases; None if ambiguous."""
        t = text.lower().strip()
        if t.endswith("?"):
            return "question"
        if t.split(" ", 1)[0] in {
            "how", "what", "where", "when", "who", "which", "can",
            "is", "are", "do", "does", "why", "should", "could",
        }:
            return "question"
        strong_feedback = (
            "confusing", "frustrat", "useless", "annoying", "hate",
            "too slow", "doesn't make sense", "makes no sense", "not helpful",
            "this is terrible", "couldn't find", "couldnt find",
            "nothing is working", "nothing works", "not working anymore",
            "broken again",
        )
        if any(m in t for m in strong_feedback):
            return "feedback"
        return None

    @staticmethod
    def _heuristic(text: str) -> str:
        t = text.lower().strip()
        # Clear question markers.
        if t.endswith("?") or t.split(" ", 1)[0] in {
            "how",
            "what",
            "where",
            "when",
            "who",
            "which",
            "can",
            "is",
            "do",
            "does",
        }:
            return "question"
        feedback_markers = (
            "confusing",
            "frustrat",
            "annoying",
            "useless",
            "i can't find",
            "i cannot find",
            "couldn't find",
            "couldnt find",
            "this is",
            "too slow",
            "doesn't make sense",
            "makes no sense",
            "nothing is working",
            "nothing works",
            "not working anymore",
            "broken again",
            "hate",
            "love",
            "great tool",
        )
        if any(m in t for m in feedback_markers):
            return "feedback"
        return "question"


_classifier_singleton: Optional[IntentClassifier] = None


def get_intent_classifier() -> IntentClassifier:
    global _classifier_singleton
    if _classifier_singleton is None:
        _classifier_singleton = IntentClassifier()
    return _classifier_singleton
