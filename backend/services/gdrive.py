"""
Google Drive document sync.

Owner: Google Drive integration.

Bridges Google Drive to the RAG knowledge base: pulls the latest Markdown SOPs
from a shared Drive folder into the local `data/sops/` directory, where the
ingester (`services/ingest.py`) picks them up. This makes Drive the live source
of truth for the documents the assistant answers from.

Setup:
1. Create a service account, download its JSON key, point
   GOOGLE_SERVICE_ACCOUNT_JSON at it.
2. Share the Drive folder with the service-account email (Viewer).
3. Put the folder id (from the Drive URL) in GOOGLE_DRIVE_FOLDER_ID.

When unconfigured, `sync_to_sops` is a no-op and the committed seed SOPs in
`data/sops/` are used as-is.
"""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from typing import List, Optional

from config import REPO_ROOT, Settings, get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
GOOGLE_DOC_MIME = "application/vnd.google-apps.document"


class GoogleDriveService:
    """Sync Markdown SOPs from Google Drive into the local knowledge base."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    @property
    def _real_config_present(self) -> bool:
        s = self.settings
        return bool(s.gdrive_folder_id and self._service_account_path().exists())

    def _service_account_path(self) -> Path:
        """Resolve the SA JSON path (relative paths are relative to repo root)."""
        p = Path(self.settings.gdrive_service_account_json or "")
        if p and not p.is_absolute():
            p = REPO_ROOT / p
        return p

    @staticmethod
    def _safe_name(name: str) -> str:
        return re.sub(r"[^\w.\- ]+", "_", name).strip()

    def _build_service(self):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            str(self._service_account_path()), scopes=SCOPES
        )
        return build("drive", "v3", credentials=creds, cache_discovery=False)

    # ------------------------------------------------------------------
    def sync_to_sops(self, sop_dir: str) -> int:
        """
        Pull the latest Markdown SOPs from the Drive folder into `sop_dir`.

        Downloads `.md` files as-is and native Google Docs exported as Markdown.
        Returns the number of files synced; 0 (no-op) if Drive isn't configured
        or is unreachable, leaving the committed seed SOPs untouched.
        """
        if not self._real_config_present:
            logger.info("[GDrive] Not configured; using local SOPs only.")
            return 0

        try:
            from googleapiclient.http import MediaIoBaseDownload

            service = self._build_service()
            folder_id = self.settings.gdrive_folder_id
            dest = Path(sop_dir)
            dest.mkdir(parents=True, exist_ok=True)

            query = f"'{folder_id}' in parents and trashed = false"
            files: List[dict] = []
            page_token = None
            while True:
                resp = (
                    service.files()
                    .list(
                        q=query,
                        spaces="drive",
                        fields="nextPageToken, files(id, name, mimeType)",
                        pageToken=page_token,
                    )
                    .execute()
                )
                files.extend(resp.get("files", []))
                page_token = resp.get("nextPageToken")
                if not page_token:
                    break

            synced = 0
            for f in files:
                name = self._safe_name(f["name"])
                mime = f["mimeType"]
                if mime == GOOGLE_DOC_MIME:
                    target = dest / (Path(name).stem + ".md")
                    request = service.files().export_media(
                        fileId=f["id"], mimeType="text/markdown"
                    )
                elif name.lower().endswith(".md"):
                    target = dest / name
                    request = service.files().get_media(fileId=f["id"])
                else:
                    continue  # the ingester only consumes Markdown SOPs

                buffer = io.BytesIO()
                downloader = MediaIoBaseDownload(buffer, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                target.write_bytes(buffer.getvalue())
                synced += 1
                logger.info("[GDrive] Synced SOP %s", target.name)

            logger.info("[GDrive] Synced %d SOP file(s) into %s", synced, dest)
            return synced
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.exception("[GDrive] sync_to_sops failed: %s", exc)
            return 0


_gdrive_singleton: Optional[GoogleDriveService] = None


def get_gdrive_service() -> GoogleDriveService:
    global _gdrive_singleton
    if _gdrive_singleton is None:
        _gdrive_singleton = GoogleDriveService()
    return _gdrive_singleton
