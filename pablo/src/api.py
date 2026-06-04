"""
api.py — FastAPI endpoint for the RAG pipeline

Exposes a single POST /api/rag/query endpoint that Marcos calls
from the backend. Returns a structured JSON response with the
answer and full source metadata.

Run locally:
    uvicorn src.api:app --reload --port 8001

The backend (Marcos) should proxy requests to this service.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import logging

from query import run_query, RAGResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(
    title="Roche Scientist Assistant — RAG API",
    description="Retrieval-Augmented Generation pipeline for Roche SOP documents.",
    version="0.1.0",
)


# ── Request / Response models ─────────────────────────────────────────────────

class QueryRequest(BaseModel):
    """
    Payload sent by the backend (Marcos) when a scientist submits a question.
    """
    query: str = Field(
        ...,
        description="The scientist's question in any supported language.",
        example="How do I request access to the chemical storage system?",
    )
    user_language: Optional[str] = Field(
        default=None,
        description="2-letter language code override (en, de, fr, it). Auto-detected if omitted.",
        example="de",
    )
    user_role: Optional[str] = Field(
        default=None,
        description="Scientist's role for logging purposes.",
        example="new_joiner",
    )


class SourceMetadata(BaseModel):
    title: str
    doc_id: str
    version: str
    date: str


class QueryResponse(BaseModel):
    """
    Response returned to the backend after processing a query.
    The frontend uses 'answer' and 'source' to display the result.
    """
    answer: str
    source: SourceMetadata
    language_detected: str
    confidence: float
    low_confidence: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Simple health check — backend can ping this to verify the service is up."""
    return {"status": "ok", "service": "rag-pipeline"}


@app.post("/api/rag/query", response_model=QueryResponse)
def query_endpoint(request: QueryRequest) -> QueryResponse:
    """
    Main RAG endpoint.

    Accepts a scientist's question, runs the full retrieval + generation
    pipeline, and returns a grounded answer with source citation.

    Raises 422 if the request body is invalid.
    Raises 500 if the pipeline fails (e.g. API key missing, DB empty).
    """
    log.info(f"Query received: '{request.query[:80]}' | lang={request.user_language} | role={request.user_role}")

    try:
        result: RAGResponse = run_query(
            question=request.query,
            user_language=request.user_language,
            user_role=request.user_role,
        )
    except EnvironmentError as e:
        # API key not configured — surface clearly
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        log.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="RAG pipeline error. Check server logs.")

    return QueryResponse(
        answer=result.answer,
        source=SourceMetadata(
            title=result.source_title,
            doc_id=result.source_doc_id,
            version=result.source_version,
            date=result.source_date,
        ),
        language_detected=result.language_detected,
        confidence=result.confidence,
        low_confidence=result.low_confidence,
    )
