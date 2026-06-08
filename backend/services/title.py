"""
Conversation title generator — produces a short (3–7 word) title from the
first few message exchanges, using Groq when available.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

_PROMPT = (
    "Generate a short title (3–7 words) for this lab assistant conversation.\n"
    "Focus on the main topic discussed. Return ONLY the title, no quotes or trailing punctuation.\n\n"
    "Conversation:\n{conversation}"
)


class TitleService:
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

    def generate(self, messages: List[Dict[str, Any]]) -> str:
        relevant = [
            m for m in messages
            if m.get("role") in ("user", "assistant") and str(m.get("text", "")).strip()
        ][:6]

        if not relevant:
            return "New chat"

        conversation = "\n".join(
            f"{m['role'].capitalize()}: {str(m['text'])[:200]}"
            for m in relevant
        )

        llm = self._get_llm()
        if llm is None:
            return self._heuristic(relevant)

        from langchain_core.messages import HumanMessage

        try:
            resp = llm.invoke([HumanMessage(content=_PROMPT.format(conversation=conversation))])
            title = resp.content.strip().strip("\"'").rstrip(".")
            return title[:60] if title else self._heuristic(relevant)
        except Exception as exc:
            logger.exception("Title generation failed: %s", exc)
            return self._heuristic(relevant)

    @staticmethod
    def _heuristic(messages: List[Dict[str, Any]]) -> str:
        first = next(
            (str(m["text"]) for m in messages if m.get("role") == "user"),
            "New chat",
        )
        return first[:45] + "..." if len(first) > 45 else first


_title_singleton: Optional[TitleService] = None


def get_title_service() -> TitleService:
    global _title_singleton
    if _title_singleton is None:
        _title_singleton = TitleService()
    return _title_singleton
