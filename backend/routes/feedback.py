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

    # A downvote arrives in two steps: first the thumb (with a rating), then an
    # optional reason chip / free-text comment (no rating). Fold that second
    # step into the existing rated entry so one downvote stays a single entry
    # across the whole dashboard (total, sentiment split, recent, attention).
    if (request.message_id and message is None and rating is None
            and (request.reason or request.comment)):
        enriched = store.enrich(
            message_id=request.message_id,
            reason=request.reason,
            comment=request.comment,
            language=language,
        )
        if enriched is not None:
            return FeedbackResponse(sentiment=enriched.get("sentiment", "negative"))
        # No prior rated downvote to attach to — record it as a standalone note.
        tone = "negative"
        message = request.comment or request.reason or ""

    # Chat thumbs feedback proper: {message_id, rating: +1 (up) / -1 (down)}.
    elif request.message_id and message is None:
        is_down = rating is not None and rating < 0
        tone = "negative" if is_down else "satisfied"
        rating = 1 if is_down else 5
        message = request.comment or f"Thumbs {'down' if is_down else 'up'} on message {request.message_id}"

    # Otherwise auto-detect sentiment from the text if not provided.
    if not tone or tone == "auto":
        tone = sentiment.analyze(message) if message else "neutral"

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
    start: str | None = None,
    end: str | None = None,
    store: FeedbackStore = Depends(get_feedback_store),
) -> dict:
    """Aggregated feedback metrics consumed by the Dashboard page.

    Optional `start`/`end` query params ('YYYY-MM-DD') limit the period.
    """
    return store.analytics(start, end)


@router.get("/feedback/entries")
async def feedback_entries(
    start: str | None = None,
    end: str | None = None,
    store: FeedbackStore = Depends(get_feedback_store),
) -> list[dict]:
    """All raw feedback entries, used by the dashboard's CSV export.

    One object per feedback (timestamp, topic, rating, sentiment, language,
    reason, comment, message, ...). The frontend turns this into a CSV.
    Optional `start`/`end` query params ('YYYY-MM-DD') limit the period so the
    CSV matches whatever date filter is active on the dashboard.
    """
    return store.filtered(start, end)
