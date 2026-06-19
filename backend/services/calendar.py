"""
Google Calendar integration for equipment bookings.

When a reservation is confirmed, this writes a real event to a shared Google
Calendar so the booking shows up in everyone's calendar. Uses the SAME service
account as the Drive sync (no per-user OAuth).

Setup:
1. Enable the Google Calendar API in the same Cloud project.
2. Create a calendar (e.g. "Lab Equipment"), and under its settings share it
   with the service-account email, giving "Make changes to events".
3. Put that calendar's id in GOOGLE_CALENDAR_ID (Calendar settings → Integrate
   calendar → Calendar ID).

When unconfigured, `create_event` is a no-op returning None — bookings still
work, just without a calendar entry.

Owner: Backend / Google integration.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from config import REPO_ROOT, Settings, get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


class CalendarService:
    """Create Google Calendar events for confirmed bookings (or no-op)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def _service_account_path(self) -> Path:
        p = Path(self.settings.gdrive_service_account_json or "")
        if p and not p.is_absolute():
            p = REPO_ROOT / p
        return p

    @property
    def configured(self) -> bool:
        return bool(self.settings.google_calendar_id) and self._service_account_path().exists()

    def _build_service(self):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            str(self._service_account_path()), scopes=SCOPES
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    def create_event(
        self,
        summary: str,
        description: str,
        location: str,
        date: str,
        time: str,
        duration_minutes: int = 60,
    ) -> Optional[str]:
        """Create a calendar event; return its htmlLink, or None if unconfigured/failed."""
        if not self.configured:
            logger.info("[Calendar] Not configured; skipping event creation.")
            return None
        try:
            start = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
            end = start + timedelta(minutes=duration_minutes)
            tz = self.settings.calendar_timezone
            event = {
                "summary": summary,
                "location": location,
                "description": description,
                "start": {"dateTime": start.isoformat(), "timeZone": tz},
                "end": {"dateTime": end.isoformat(), "timeZone": tz},
            }
            service = self._build_service()
            created = (
                service.events()
                .insert(calendarId=self.settings.google_calendar_id, body=event)
                .execute()
            )
            link = created.get("htmlLink")
            logger.info("[Calendar] Created event %s", created.get("id"))
            return link
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.exception("[Calendar] create_event failed: %s", exc)
            return None


_calendar_singleton: Optional[CalendarService] = None


def get_calendar_service() -> CalendarService:
    global _calendar_singleton
    if _calendar_singleton is None:
        _calendar_singleton = CalendarService()
    return _calendar_singleton
