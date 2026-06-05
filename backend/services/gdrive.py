"""
Google Drive document fetcher.

Owner: Google Drive integration.

Behaviour
---------
* MOCK mode (or no credentials / no folder id) -> lists the local files in
  data/mock_docs so the RAG pipeline always has something to index.
* Real mode (MOCK_MODE=false + GOOGLE_DRIVE_FOLDER_ID + service-account JSON)
  -> authenticates with the service account, lists the files in the shared
  Drive folder, downloads them into a local cache, and returns their paths.

Both paths return a list of local file paths, so RAGService doesn't care where
the documents came from.

Setup recap
-----------
1. Create a service account, download its JSON key, point
   GOOGLE_SERVICE_ACCOUNT_JSON at it.
2. Share the Drive folder with the service account email (Viewer).
3. Put the folder id (from the Drive URL) in GOOGLE_DRIVE_FOLDER_ID.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Optional

from config import REPO_ROOT, Settings, get_settings

logger = logging.getLogger(__name__)

# Read-only access is all we need.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Google Workspace (native Docs) export mappings -> (export_mime, extension).
# Native Docs/Sheets/Slides can't be downloaded directly; they must be exported.
GOOGLE_EXPORTS = {
    "application/vnd.google-apps.document": ("text/plain", ".md"),
    "application/vnd.google-apps.spreadsheet": ("text/csv", ".csv"),
    "application/vnd.google-apps.presentation": ("text/plain", ".md"),
}

# Extensions the RAG pipeline knows how to index.
INDEXABLE = {".md", ".pdf"}


class GoogleDriveService:
    """Fetch source documents from Google Drive (mock-backed when unconfigured)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    @property
    def _real_config_present(self) -> bool:
        s = self.settings
        return bool(s.gdrive_folder_id and self._service_account_path().exists())

    def list_documents(self) -> List[str]:
        """Return local file paths for all available source documents."""
        if self.settings.mock_mode or not self._real_config_present:
            return self._list_local()
        try:
            return self._fetch_from_drive()
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.exception("Drive fetch failed, falling back to local docs: %s", exc)
            return self._list_local()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _service_account_path(self) -> Path:
        """Resolve the SA JSON path (relative paths are relative to repo root)."""
        p = Path(self.settings.gdrive_service_account_json or "")
        if p and not p.is_absolute():
            p = REPO_ROOT / p
        return p

    def _cache_dir(self) -> Path:
        d = REPO_ROOT / "backend" / "data" / "drive_cache"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @staticmethod
    def _safe_name(name: str) -> str:
        return re.sub(r"[^\w.\- ]+", "_", name).strip()

    # ------------------------------------------------------------------
    # Mock / local
    # ------------------------------------------------------------------
    def _list_local(self) -> List[str]:
        docs_dir = Path(self.settings.mock_docs_path)
        if not docs_dir.exists():
            logger.warning("Mock docs folder missing: %s", docs_dir)
            return []
        paths = [
            str(p)
            for p in sorted(docs_dir.iterdir())
            if p.suffix.lower() in INDEXABLE
        ]
        logger.info("[Local docs] Found %d documents in %s", len(paths), docs_dir)
        return paths

    # ------------------------------------------------------------------
    # Real Google Drive
    # ------------------------------------------------------------------
    def _build_service(self):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_file(
            str(self._service_account_path()), scopes=SCOPES
        )
        # cache_discovery=False avoids a noisy warning on some setups.
        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def _fetch_from_drive(self) -> List[str]:
        from googleapiclient.http import MediaIoBaseDownload

        service = self._build_service()
        folder_id = self.settings.gdrive_folder_id
        cache = self._cache_dir()

        # Clear stale files so deleted/renamed Drive docs don't linger in the cache.
        for old in cache.iterdir():
            if old.suffix.lower() in INDEXABLE:
                old.unlink(missing_ok=True)

        # List every (non-trashed) file directly inside the folder.
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

        logger.info("[GDrive] Folder %s has %d files", folder_id, len(files))

        saved_paths: List[str] = []
        for f in files:
            name = self._safe_name(f["name"])
            mime = f["mimeType"]
            file_id = f["id"]

            if mime in GOOGLE_EXPORTS:
                export_mime, ext = GOOGLE_EXPORTS[mime]
                # Ensure the saved name has the right extension for the RAG loader.
                target = cache / (Path(name).stem + ext)
                request = service.files().export_media(
                    fileId=file_id, mimeType=export_mime
                )
            else:
                target = cache / name
                request = service.files().get_media(fileId=file_id)

            # Only bother downloading things the RAG pipeline can index.
            if target.suffix.lower() not in INDEXABLE:
                logger.info("[GDrive] Skipping non-indexable file: %s (%s)", name, mime)
                continue

            try:
                import io

                buffer = io.BytesIO()
                downloader = MediaIoBaseDownload(buffer, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                target.write_bytes(buffer.getvalue())
                saved_paths.append(str(target))
                logger.info("[GDrive] Downloaded %s -> %s", name, target.name)
            except Exception as exc:  # pragma: no cover - per-file resilience
                logger.exception("[GDrive] Failed to download %s: %s", name, exc)

        return saved_paths


_gdrive_singleton: Optional[GoogleDriveService] = None


def get_gdrive_service() -> GoogleDriveService:
    global _gdrive_singleton
    if _gdrive_singleton is None:
        _gdrive_singleton = GoogleDriveService()
    return _gdrive_singleton
