"""
Chat endpoint.

Owner: Backend / routes.

Flow
----
1. Detect the message language (or use the client-provided one).
2. Classify intent: question vs feedback.
3a. If feedback -> run sentiment, store it, return is_feedback=True.
3b. If question  -> run RAG, translate the answer to the user's language.

All collaborators are provided via FastAPI dependency injection so each can be
swapped/mocked independently in tests.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from models.schemas import ChatRequest, ChatResponse
from services.classifier import IntentClassifier, get_intent_classifier
from services.feedback_store import FeedbackStore, get_feedback_store
from services.rag import RAGService, get_rag_service
from services.sentiment import SentimentService, get_sentiment_service
from services.translator import TranslatorService, get_translator_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    rag: RAGService = Depends(get_rag_service),
    classifier: IntentClassifier = Depends(get_intent_classifier),
    sentiment: SentimentService = Depends(get_sentiment_service),
    translator: TranslatorService = Depends(get_translator_service),
    feedback_store: FeedbackStore = Depends(get_feedback_store),
) -> ChatResponse:
    message = request.message

    # 1. Language: trust the client if provided, else detect.
    language = request.language or translator.detect_language(message)

    # 2. Intent.
    intent = classifier.classify(message)

    # 3a. Feedback branch.
    if intent == "feedback":
        tone = sentiment.analyze(message)
        feedback_store.add(
            session_id=request.session_id,
            message=message,
            sentiment=tone,
        )
        ack = (
            "Thank you for your feedback — it has been logged and shared with "
            "the IT team."
        )
        ack = translator.translate(ack, language)
        return ChatResponse(
            answer=ack,
            source_doc="",
            source_page="",
            detected_language=language,
            is_feedback=True,
            sentiment=tone,
            confidence=None,
        )

    # 3b. Knowledge question branch -> RAG.
    result = rag.query(message, language=language)
    return ChatResponse(
        answer=result["answer"],
        source_doc=result.get("source_doc", ""),
        source_page=result.get("source_page", ""),
        source_version=result.get("source_version", ""),
        source_last_updated=result.get("source_last_updated", ""),
        detected_language=language,
        is_feedback=False,
        sentiment=None,
        confidence=result.get("confidence"),
    )
