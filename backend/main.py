"""
FastAPI entry point for the Roche Scientist Assistant backend.

Owner: PM + backend coordination.

Run locally:
    cd backend
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs for the interactive Swagger UI.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Query

from config import get_settings
from models.schemas import HealthResponse
from routes import activity, announcements, bookings, chat, experts, feedback, incidents, members

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Roche Scientist Assistant",
    description="AI assistant for Roche scientists: document Q&A, incident "
    "creation, feedback & sentiment.",
    version="0.1.0",
)

# CORS: allow all origins during development so the frontend team is unblocked.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers.
app.include_router(chat.router)
app.include_router(feedback.router)
app.include_router(incidents.router)
app.include_router(bookings.router)
app.include_router(members.router)
app.include_router(experts.router)
app.include_router(announcements.router)
app.include_router(activity.router)


@app.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness probe used by Render and local smoke tests (GET/HEAD).

    HEAD is accepted so free uptime pingers (UptimeRobot) that can only send
    HEAD get a 200 instead of 405 — keeps the free Render instance warm.
    """
    return HealthResponse(status="ok")


@app.post("/admin/reindex")
async def reindex(sync_drive: bool = Query(default=False)) -> dict:
    """
    Rebuild the RAG index from the SOP knowledge base.

    With ?sync_drive=true, first pull the latest SOPs from Google Drive
    (the Drive bridge) and then re-ingest.
    """
    from services.ingest import ingest

    chunks = ingest(sync_drive=sync_drive)
    return {"status": "ok", "chunks_indexed": chunks, "drive_synced": sync_drive}


@app.on_event("startup")
async def on_startup() -> None:
    settings = get_settings()
    logger.info("Starting Scientist Assistant backend")

    # Initialise the database (tables + synthetic lab-member roster).
    try:
        from db import init_db

        init_db()
    except Exception as exc:  # never block startup on the DB
        logger.warning("DB init skipped: %s", exc)
    logger.info(
        "MOCK_MODE=%s | Groq=%s | Gemini/RAG=%s",
        settings.mock_mode, settings.has_groq, settings.has_google,
    )
    logger.info("SOPs path: %s", settings.sops_path)

    # Best-effort: if the RAG is configured but its index is empty, build it once.
    if settings.has_google:
        try:
            from services.ingest import get_vectorstore, ingest

            store = get_vectorstore(settings)
            if not store.get().get("ids"):
                logger.info("Vector index empty — running initial ingestion...")
                ingest(settings)
        except Exception as exc:  # never block startup on ingestion
            logger.warning("Startup ingestion skipped: %s", exc)
