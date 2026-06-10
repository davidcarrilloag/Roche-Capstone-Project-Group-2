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
    message = request.message
    tone = request.sentiment
    rating = request.rating

    # Chat thumbs feedback: {message_id, rating: +1 (up) / -1 (down)}.
    if request.message_id and message is None:
        is_down = rating is not None and rating < 0
        tone = "negative" if is_down else "satisfied"
        rating = 1 if is_down else 5
        message = f"Thumbs {'down' if is_down else 'up'} on message {request.message_id}"

    # Otherwise auto-detect sentiment from the text if not provided.
    if not tone or tone == "auto":
        tone = sentiment.analyze(message) if message else "neutral"

    store.add(
        session_id=request.session_id or "web",
        message=message or "",
        sentiment=tone,
        rating=rating,
    )
    return FeedbackResponse(sentiment=tone)


@router.get("/feedback/analytics")
async def feedback_analytics(
    store: FeedbackStore = Depends(get_feedback_store),
) -> dict:
    """Aggregated feedback metrics consumed by the Dashboard page."""
    return store.analytics()
