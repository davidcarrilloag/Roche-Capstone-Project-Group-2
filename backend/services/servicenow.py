"""
ServiceNow incident creation client.

Owner: ServiceNow API.

Currently runs in MOCK mode: create_incident() returns a fake incident number
and logs the payload. The real REST integration only needs to replace the body
of `_create_real` — the public interface stays identical, so nothing else in
the app changes when we go live.
"""

from __future__ import annotations

import logging
import random
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)


class ServiceNowClient:
    """Create IT incidents in ServiceNow (mock or real depending on config)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def create_incident(
        self, title: str, description: str, category: str = "general"
    ) -> dict:
        """
        Create an incident and return a dict:
        {incident_number, status, title, category, mock}.
        """
        if self.settings.mock_mode or not self._real_config_present():
            return self._create_mock(title, description, category)
        return self._create_real(title, description, category)

    # ------------------------------------------------------------------
    def _real_config_present(self) -> bool:
        s = self.settings
        return bool(
            s.servicenow_instance_url
            and s.servicenow_username
            and s.servicenow_password
        )

    def _create_mock(self, title: str, description: str, category: str) -> dict:
        incident_number = f"INC{random.randint(10_000, 99_999):07d}"[:10]
        # Normalise to the INCxxxxxxx shape (INC + 7 digits).
        incident_number = "INC" + f"{random.randint(0, 9_999_999):07d}"
        logger.info(
            "[MOCK ServiceNow] Created %s | category=%s | title=%s\n%s",
            incident_number,
            category,
            title,
            description,
        )
        return {
            "incident_number": incident_number,
            "status": "created",
            "title": title,
            "category": category,
            "mock": True,
        }

    def _create_real(self, title: str, description: str, category: str) -> dict:
        """
        Real ServiceNow Table API call.

        Implemented with httpx so it can later be made fully async. Kept behind
        MOCK_MODE until a developer instance is wired up.
        """
        import httpx

        url = f"{self.settings.servicenow_instance_url}/api/now/table/incident"
        payload = {
            "short_description": title,
            "description": description,
            "category": category,
        }
        try:
            resp = httpx.post(
                url,
                json=payload,
                auth=(self.settings.servicenow_username, self.settings.servicenow_password),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=20.0,
            )
            resp.raise_for_status()
            result = resp.json().get("result", {})
            return {
                "incident_number": result.get("number", "UNKNOWN"),
                "status": "created",
                "title": title,
                "category": category,
                "mock": False,
            }
        except Exception as exc:  # pragma: no cover - network
            logger.exception("ServiceNow call failed, falling back to mock: %s", exc)
            return self._create_mock(title, description, category)


_servicenow_singleton: Optional[ServiceNowClient] = None


def get_servicenow_client() -> ServiceNowClient:
    global _servicenow_singleton
    if _servicenow_singleton is None:
        _servicenow_singleton = ServiceNowClient()
    return _servicenow_singleton
