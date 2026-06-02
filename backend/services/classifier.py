"""
Intent classifier: decides whether a scientist's message is a knowledge
QUESTION (route to RAG) or FEEDBACK (route to the feedback service).

Owner: shared (used by the chat route). The AI/analytics owners can tune the prompt.

Examples
--------
Question : "How do I clean my centrifuge?"  -> "question"
Feedback : "This process is confusing."      -> "feedback"
           "I can't find the right app."      -> "feedback"
"""

from __future__ import annotations

import logging
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

_PROMPT = (
    "Classify the scientist's message as either 'question' or 'feedback'.\n"
    "- 'question' = they want information or how-to help from documentation.\n"
    "- 'feedback' = they are expressing an opinion, complaint, frustration, "
    "or comment about a tool/process rather than asking for information.\n"
    "Respond with ONLY one word: question or feedback.\n\n"
    "Message: {text}"
)


class IntentClassifier:
    """Question vs feedback classification, Groq-backed with a heuristic fallback."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._llm = None

    def _get_llm(self):
        if self._llm is None and self.settings.has_groq:
            from langchain_groq import ChatGroq

            self._llm = ChatGroq(
                api_key=self.settings.groq_api_key,
                model=self.settings.groq_model,
                temperature=0.0,
            )
        return self._llm

    def classify(self, text: str) -> str:
        """Return 'question' or 'feedback'."""
        if not text or not text.strip():
            return "question"

        llm = self._get_llm()
        if llm is None:
            return self._heuristic(text)

        from langchain_core.messages import HumanMessage

        try:
            resp = llm.invoke([HumanMessage(content=_PROMPT.format(text=text))])
            label = resp.content.strip().lower()
            return "feedback" if "feedback" in label else "question"
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Intent LLM call failed, using heuristic: %s", exc)
            return self._heuristic(text)

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
            "this is",
            "too slow",
            "doesn't make sense",
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
