"""
ServiceNow incident creation client.

Owner: ServiceNow API (Marcos).

Sends a complete incident to the ServiceNow Table API — short description,
description, category, caller, contact type, and impact/urgency. ServiceNow
computes Priority from impact + urgency (the ITIL matrix). Falls back to a mock
when MOCK_MODE is on or credentials are missing.
"""

from __future__ import annotations

import logging
import random
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

# Our app categories -> ServiceNow out-of-the-box incident categories.
CATEGORY_MAP = {
    "software": "software",
    "hardware": "hardware",
    "network": "network",
    "database": "database",
    "access": "inquiry",
    "general": "inquiry",
    "inquiry": "inquiry",
}

# Priority computed from (impact, urgency) on the 1=High..3=Low scale (OOB matrix).
_PRIORITY_MATRIX = {
    (1, 1): 1, (1, 2): 2, (1, 3): 3,
    (2, 1): 2, (2, 2): 3, (2, 3): 4,
    (3, 1): 3, (3, 2): 4, (3, 3): 5,
}
PRIORITY_LABELS = {
    1: "1 - Critical", 2: "2 - High", 3: "3 - Moderate",
    4: "4 - Low", 5: "5 - Planning",
}


def _priority_label(impact: Optional[int], urgency: Optional[int]) -> str:
    if not impact or not urgency:
        return PRIORITY_LABELS[4]
    return PRIORITY_LABELS.get(_PRIORITY_MATRIX.get((impact, urgency), 4), PRIORITY_LABELS[4])


class ServiceNowClient:
    """Create IT incidents in ServiceNow (mock or real depending on config)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._user_cache: dict = {}

    def create_incident(
        self,
        title: str,
        description: str,
        category: str = "general",
        urgency: Optional[int] = None,
        impact: Optional[int] = None,
        caller: Optional[str] = None,
        contact_type: Optional[str] = None,
    ) -> dict:
        """Create an incident; returns {incident_number, status, title, category,
        priority, mock}."""
        if self.settings.mock_mode or not self._real_config_present():
            return self._create_mock(title, description, category, urgency, impact)
        return self._create_real(
            title, description, category, urgency, impact, caller, contact_type
        )

    # ------------------------------------------------------------------
    def _real_config_present(self) -> bool:
        s = self.settings
        return bool(
            s.servicenow_instance_url
            and s.servicenow_username
            and s.servicenow_password
        )

    def _create_mock(self, title, description, category, urgency, impact) -> dict:
        incident_number = "INC" + f"{random.randint(0, 9_999_999):07d}"
        priority = _priority_label(impact, urgency)
        logger.info(
            "[MOCK ServiceNow] %s | cat=%s | urgency=%s impact=%s -> %s | %s",
            incident_number, category, urgency, impact, priority, title,
        )
        return {
            "incident_number": incident_number,
            "status": "created",
            "title": title,
            "category": CATEGORY_MAP.get(category, "inquiry"),
            "priority": priority,
            "mock": True,
        }

    def _resolve_caller(self, caller: str):
        """Best-effort: find a sys_user sys_id by email or name (cached)."""
        if not caller:
            return None
        if caller in self._user_cache:
            return self._user_cache[caller]
        sys_id = None
        try:
            import httpx

            r = httpx.get(
                f"{self.settings.servicenow_instance_url}/api/now/table/sys_user",
                params={
                    "sysparm_query": f"email={caller}^ORname={caller}",
                    "sysparm_fields": "sys_id",
                    "sysparm_limit": 1,
                },
                auth=(self.settings.servicenow_username, self.settings.servicenow_password),
                headers={"Accept": "application/json"},
                timeout=15.0,
            )
            r.raise_for_status()
            results = r.json().get("result", [])
            if results:
                sys_id = results[0].get("sys_id")
        except Exception as exc:  # pragma: no cover - network
            logger.warning("Caller lookup failed for %r: %s", caller, exc)
        self._user_cache[caller] = sys_id
        return sys_id

    def _api_user_sys_id(self):
        """sys_id of the authenticated API user — fallback caller so the field
        is never empty when the reporter isn't a ServiceNow user."""
        key = f"__api__:{self.settings.servicenow_username}"
        if key in self._user_cache:
            return self._user_cache[key]
        sys_id = None
        try:
            import httpx

            r = httpx.get(
                f"{self.settings.servicenow_instance_url}/api/now/table/sys_user",
                params={
                    "sysparm_query": f"user_name={self.settings.servicenow_username}",
                    "sysparm_fields": "sys_id",
                    "sysparm_limit": 1,
                },
                auth=(self.settings.servicenow_username, self.settings.servicenow_password),
                headers={"Accept": "application/json"},
                timeout=15.0,
            )
            r.raise_for_status()
            results = r.json().get("result", [])
            if results:
                sys_id = results[0].get("sys_id")
        except Exception as exc:  # pragma: no cover - network
            logger.warning("API user lookup failed: %s", exc)
        self._user_cache[key] = sys_id
        return sys_id

    def _create_real(
        self, title, description, category, urgency, impact, caller, contact_type
    ) -> dict:
        """Real ServiceNow Table API call."""
        import httpx

        sn_category = CATEGORY_MAP.get(category, "inquiry")
        payload = {
            "short_description": title,
            "description": description,
            "category": sn_category,
            "contact_type": contact_type or "virtual_agent",
        }
        if urgency:
            payload["urgency"] = str(urgency)
        if impact:
            payload["impact"] = str(impact)

        if caller:
            caller_sys_id = self._resolve_caller(caller)
            if not caller_sys_id:
                # Not a ServiceNow user (common in the dev instance): keep the
                # entered value in the description and fall back to the API user
                # so the Caller field isn't left empty.
                payload["description"] = f"{description}\n\nReported by: {caller}"
                caller_sys_id = self._api_user_sys_id()
            if caller_sys_id:
                payload["caller_id"] = caller_sys_id

        try:
            resp = httpx.post(
                f"{self.settings.servicenow_instance_url}/api/now/table/incident",
                json=payload,
                auth=(self.settings.servicenow_username, self.settings.servicenow_password),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=20.0,
            )
            resp.raise_for_status()
            result = resp.json().get("result", {})
            pr = str(result.get("priority", "")) or None
            priority = PRIORITY_LABELS.get(int(pr), _priority_label(impact, urgency)) if pr and pr.isdigit() else _priority_label(impact, urgency)
            return {
                "incident_number": result.get("number", "UNKNOWN"),
                "status": "created",
                "title": title,
                "category": sn_category,
                "priority": priority,
                "mock": False,
            }
        except Exception as exc:  # pragma: no cover - network
            logger.exception("ServiceNow call failed, falling back to mock: %s", exc)
            return self._create_mock(title, description, category, urgency, impact)


_servicenow_singleton: Optional[ServiceNowClient] = None


def get_servicenow_client() -> ServiceNowClient:
    global _servicenow_singleton
    if _servicenow_singleton is None:
        _servicenow_singleton = ServiceNowClient()
    return _servicenow_singleton
