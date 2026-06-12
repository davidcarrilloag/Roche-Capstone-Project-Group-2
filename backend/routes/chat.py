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
import re

from fastapi import APIRouter, Depends

from models.schemas import ChatRequest, ChatResponse, TitleRequest, TitleResponse
from services.classifier import IntentClassifier, get_intent_classifier
from services.feedback_store import FeedbackStore, get_feedback_store
from services.rag import RAGService, get_rag_service
from services.sentiment import SentimentService, get_sentiment_service
from services.title import TitleService, get_title_service
from services.translator import TranslatorService, get_translator_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

# Greetings / pleasantries that should get a friendly reply with NO document
# lookup and NO source citation. Matched as the whole (normalized) message, so
# real questions that merely start with "hi" are unaffected.
SMALL_TALK = {
    "hi", "hello", "hey", "hallo", "hola", "ciao", "bonjour", "yo", "sup",
    "hi there", "hello there", "good morning", "good afternoon", "good evening",
    "good night", "thanks", "thank you", "thank you very much", "thx", "ty",
    "cheers", "gracias", "danke", "merci", "ok", "okay", "cool", "nice",
    "great", "bye", "goodbye", "how are you", "whats up", "what's up",
    "who are you", "what can you do",
}

SMALL_TALK_REPLY = (
    "Hi! I'm your lab assistant. Ask me about lab procedures, equipment, "
    "onboarding, ordering, cold storage, or IT support — or describe a problem "
    "and I can open a ticket for you."
)


def _is_small_talk(text: str) -> bool:
    norm = re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text.lower())).strip()
    return norm in SMALL_TALK


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    rag: RAGService = Depends(get_rag_service),
    classifier: IntentClassifier = Depends(get_intent_classifier),
    sentiment: SentimentService = Depends(get_sentiment_service),
    translator: TranslatorService = Depends(get_translator_service),
    feedback_store: FeedbackStore = Depends(get_feedback_store),
) -> ChatResponse:
    # NOTE: sync def (not async) so FastAPI runs this in a threadpool. The RAG
    # uses the blocking Gemini gRPC client, which would deadlock the event loop
    # if called from an async route.
    message = request.message

    # 1. Language: trust the client if provided, else detect.
    language = request.language or translator.detect_language(message)

    # Small talk -> friendly reply, no document lookup, no citation.
    if _is_small_talk(message):
        return ChatResponse(answer=SMALL_TALK_REPLY, detected_language=language)

    # 2. Intent.
    intent = classifier.classify(message)

    session_id = request.session_id or "web"

    # 3a. Feedback branch.
    if intent == "feedback":
        tone = sentiment.analyze(message)
        feedback_store.add(
            session_id=session_id,
            message=message,
            sentiment=tone,
            language=language if language in {"en", "de", "fr", "it"} else None,
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
    updated = result.get("source_last_updated", "")
    return ChatResponse(
        answer=result["answer"],
        source_doc=result.get("source_doc", ""),
        source_page=result.get("source_page", ""),
        source_version=result.get("source_version", ""),
        source_last_updated=updated,
        source_date=updated,  # frontend reads `source_date`
        detected_language=language,
        is_feedback=False,
        sentiment=None,
        confidence=result.get("confidence"),
    )


@router.post("/title", response_model=TitleResponse)
async def generate_title(
    request: TitleRequest,
    title_service: TitleService = Depends(get_title_service),
) -> TitleResponse:
    title = title_service.generate(request.messages)
    return TitleResponse(title=title)
