"""
Conversation title generator — produces a short title from the first user
message (keyword heuristic, no LLM).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from config import Settings, get_settings


class TitleService:
    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def generate(self, messages: List[Dict[str, Any]]) -> str:
        relevant = [
            m for m in messages
            if m.get("role") in ("user", "assistant") and str(m.get("text", "")).strip()
        ][:6]

        if not relevant:
            return "New chat"
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
