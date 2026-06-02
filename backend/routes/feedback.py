"""
Feedback endpoint + analytics for the dashboard.

Owner: Backend / routes & analytics.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from models.schemas import FeedbackRequest, FeedbackResponse
from services.feedback_store import FeedbackStore, get_feedback_store
from services.sentiment import SentimentService, get_sentiment_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["feedback"])


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    sentiment: SentimentService = Depends(get_sentiment_service),
    store: FeedbackStore = Depends(get_feedback_store),
) -> FeedbackResponse:
    # If the caller didn't classify sentiment (or sent "auto"), do it now.
    tone = request.sentiment
    if not tone or tone == "auto":
        tone = sentiment.analyze(request.message)

    store.add(
        session_id=request.session_id,
        message=request.message,
        sentiment=tone,
        rating=request.rating,
    )
    return FeedbackResponse(sentiment=tone)


@router.get("/feedback/analytics")
async def feedback_analytics(
    store: FeedbackStore = Depends(get_feedback_store),
) -> dict:
    """Aggregated feedback metrics consumed by the Dashboard page."""
    return store.analytics()
