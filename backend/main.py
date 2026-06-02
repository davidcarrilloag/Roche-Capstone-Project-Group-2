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

from config import get_settings
from models.schemas import HealthResponse
from routes import chat, feedback, incidents

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


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness probe used by Render and local smoke tests."""
    return HealthResponse(status="ok")


@app.on_event("startup")
async def on_startup() -> None:
    settings = get_settings()
    logger.info("Starting Scientist Assistant backend")
    logger.info("MOCK_MODE=%s | Groq configured=%s", settings.mock_mode, settings.has_groq)
    logger.info("Docs path: %s", settings.mock_docs_path)
