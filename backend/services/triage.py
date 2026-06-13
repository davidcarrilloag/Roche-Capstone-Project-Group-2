"""
Incident triage — classify a problem description into a ServiceNow category and
severity, and derive the impact/urgency that ServiceNow uses to compute Priority.

Uses Gemini when configured, with a keyword heuristic fallback so it always
returns something. ServiceNow Priority = f(Impact, Urgency) (the ITIL matrix),
so we set impact + urgency and let ServiceNow compute the priority.

Owner: Backend / ServiceNow (Marcos).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

CATEGORIES = ["software", "hardware", "network", "access", "inquiry"]
SEVERITIES = ["critical", "high", "medium", "low"]

# severity -> (urgency, impact) on ServiceNow's 1=High .. 3=Low scale.
# Priority is then computed by ServiceNow: (1,1)->P1, (1,2)->P2, (2,2)->P3, (3,3)->P4/5.
SEVERITY_TO_UI = {
    "critical": (1, 1),
    "high": (1, 2),
    "medium": (2, 2),
    "low": (3, 3),
}

PRIORITY_LABEL = {
    "critical": "P1 - Critical",
    "high": "P2 - High",
    "medium": "P3 - Moderate",
    "low": "P4 - Low",
}

_PROMPT = (
    "You triage IT incidents for a Roche laboratory. Given the title and "
    "description, classify it.\n"
    "category: one of software, hardware, network, access, inquiry.\n"
    "severity: one of critical, high, medium, low. Guidance:\n"
    "- critical: lab-wide outage, a safety risk, or many people/experiments blocked.\n"
    "- high: an instrument or PC is down and blocks an active experiment.\n"
    "- medium: a single application issue with a workaround available.\n"
    "- low: minor or cosmetic, a single printer/peripheral, or a routine request.\n"
    'Return ONLY a JSON object: {{"category": "...", "severity": "..."}}\n\n'
    "Title: {title}\nDescription: {description}"
)


class TriageService:
    """Classify an incident's category and severity."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._llm = None

    def _get_llm(self):
        if self._llm is None and self.settings.has_google:
            from langchain_google_genai import ChatGoogleGenerativeAI

            self._llm = ChatGoogleGenerativeAI(
                model=self.settings.gemini_model,
                temperature=0,
                google_api_key=self.settings.google_api_key,
            )
        return self._llm

    def classify(self, title: str, description: str) -> dict:
        """
        Return {category, severity, urgency, impact, priority_label}.
        """
        text = f"{title or ''} {description or ''}".strip()
        category, severity = self._llm_classify(title, description)
        if category is None:
            category, severity = self._heuristic(text)

        urgency, impact = SEVERITY_TO_UI.get(severity, SEVERITY_TO_UI["low"])
        return {
            "category": category,
            "severity": severity,
            "urgency": urgency,
            "impact": impact,
            "priority_label": PRIORITY_LABEL.get(severity, PRIORITY_LABEL["low"]),
        }

    # ------------------------------------------------------------------
    def _llm_classify(self, title: str, description: str):
        llm = self._get_llm()
        if llm is None:
            return None, None
        from langchain_core.messages import HumanMessage

        try:
            resp = llm.invoke(
                [HumanMessage(content=_PROMPT.format(title=title or "", description=description or ""))]
            ).content
            m = re.search(r"\{.*\}", resp, flags=re.S)
            data = json.loads(m.group(0)) if m else {}
            category = str(data.get("category", "")).lower().strip()
            severity = str(data.get("severity", "")).lower().strip()
            if category not in CATEGORIES:
                category = "inquiry"
            if severity not in SEVERITIES:
                severity = "low"
            return category, severity
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Triage LLM failed, using heuristic: %s", exc)
            return None, None

    @staticmethod
    def _heuristic(text: str):
        t = text.lower()
        # category
        if any(w in t for w in ("printer", "scanner", "monitor", "keyboard", "mouse", "cable", "device", "hardware", "laptop")):
            category = "hardware"
        elif any(w in t for w in ("network", "wifi", "vpn", "connect", "internet", "ethernet")):
            category = "network"
        elif any(w in t for w in ("access", "permission", "login", "log in", "password", "account", "badge")):
            category = "access"
        elif any(w in t for w in ("software", "app", "application", "system", "crash", "error", "session", "elN", "lims")):
            category = "software"
        else:
            category = "inquiry"
        # severity
        if any(w in t for w in ("lab-wide", "everyone", "all users", "outage", "safety", "fire", "down for the", "entire")):
            severity = "critical"
        elif any(w in t for w in ("blocked", "cannot work", "experiment", "instrument", "urgent", "asap", "production")):
            severity = "high"
        elif any(w in t for w in ("workaround", "sometimes", "intermittent", "slow")):
            severity = "medium"
        else:
            severity = "low"
        return category, severity


_triage_singleton: Optional[TriageService] = None


def get_triage_service() -> TriageService:
    global _triage_singleton
    if _triage_singleton is None:
        _triage_singleton = TriageService()
    return _triage_singleton
