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
    # A second call may follow a downvote carrying only a `reason` chip
    # and/or free-text `comment` (no rating) — record it as negative detail
    # without fabricating a rating, so averages stay accurate.
    if request.message_id and message is None:
        if rating is None and (request.reason or request.comment):
            tone = "negative"
            message = request.comment or request.reason or ""
        else:
            is_down = rating is not None and rating < 0
            tone = "negative" if is_down else "satisfied"
            rating = 1 if is_down else 5
            message = request.comment or f"Thumbs {'down' if is_down else 'up'} on message {request.message_id}"

    # Otherwise auto-detect sentiment from the text if not provided.
    if not tone or tone == "auto":
        tone = sentiment.analyze(message) if message else "neutral"

    # Detect the language of free-text feedback (en/de/fr/it) so the
    # dashboard can break feedback down per language. Explicit value wins;
    # detection is best-effort and skipped for very short texts.
    language = request.language
    text_for_lang = request.comment or request.message
    if not language and text_for_lang and len(text_for_lang) >= 15:
        try:
            from langdetect import detect

            detected = detect(text_for_lang)
            if detected in {"en", "de", "fr", "it"}:
                language = detected
        except Exception:  # detection must never break feedback storage
            pass

    store.add(
        session_id=request.session_id or "web",
        message=message or "",
        sentiment=tone,
        rating=rating,
        reason=request.reason,
        comment=request.comment,
        message_id=request.message_id,
        language=language,
        topic=request.topic,
    )
    return FeedbackResponse(sentiment=tone)


@router.get("/feedback/analytics")
async def feedback_analytics(
    store: FeedbackStore = Depends(get_feedback_store),
) -> dict:
    """Aggregated feedback metrics consumed by the Dashboard page."""
    return store.analytics()
