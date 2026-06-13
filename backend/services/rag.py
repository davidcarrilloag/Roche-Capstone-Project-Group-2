"""
RAG query pipeline (in-process) — Gemini + ChromaDB.

For a scientist's question: accept/detect the language, retrieve the top-k SOP
chunks from ChromaDB, build a grounded language-aware prompt, and ask Gemini for
an answer with a source citation (title, version, date).

Exposes the backend's standard `RAGService.query(question, language) -> dict`
interface, so the chat route is provider-agnostic. Degrades gracefully when no
Google API key is configured.

RAG pipeline originally authored by Pablo; integrated into the backend.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

TOP_K = 5

SUPPORTED_LANGUAGES = {
    "en": "English",
    "de": "German",
    "fr": "French",
    "it": "Italian",
}

NOT_CONFIGURED = (
    "Document Q&A is not available yet: the knowledge service is missing its "
    "Google API key. Please contact your local IT support."
)

RATE_LIMITED = (
    "The assistant is temporarily busy (free-tier request limit reached). "
    "Please try again in a little while."
)

GENERATION_ERROR = (
    "Sorry, I couldn't generate an answer just now. Please try again."
)

EMPTY_INDEX = (
    "I don't have any documents in my knowledge base yet. Please ensure the SOPs "
    "have been ingested."
)

# Low-confidence warning prepended to weak answers, per language.
LOW_CONF_WARNING = {
    "en": "Note: I'm not very confident in this answer — please verify with the source document.",
    "de": "Hinweis: Ich bin nicht sehr sicher bei dieser Antwort — bitte prüfen Sie das Quelldokument.",
    "fr": "Note: Je ne suis pas très confiant dans cette réponse — veuillez vérifier le document source.",
    "it": "Nota: Non sono molto sicuro di questa risposta — si prega di verificare il documento sorgente.",
}


def _empty_result(answer: str) -> dict:
    return {
        "answer": answer,
        "source_doc": "",
        "source_page": "",
        "source_version": "",
        "source_last_updated": "",
        "confidence": "low",
    }


class RAGService:
    """In-process retrieval-augmented QA over the SOP knowledge base."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._store = None
        self._llm = None

    # ------------------------------------------------------------------
    def _get_store(self):
        if self._store is None:
            from services.ingest import get_vectorstore

            self._store = get_vectorstore(self.settings)
        return self._store

    def _get_llm(self):
        if self._llm is None:
            from langchain_google_genai import ChatGoogleGenerativeAI

            self._llm = ChatGoogleGenerativeAI(
                model=self.settings.gemini_model,
                temperature=0,
                google_api_key=self.settings.google_api_key,
            )
        return self._llm

    @staticmethod
    def _confidence_label(score: float, low_confidence: bool) -> str:
        if low_confidence:
            return "low"
        if score >= 0.8:
            return "high"
        if score >= 0.6:
            return "medium"
        return "low"

    # ------------------------------------------------------------------
    def query(self, question: str, language: str = "en") -> dict:
        """Answer a question from the SOP corpus with a version-aware citation."""
        if not self.settings.has_google:
            return _empty_result(NOT_CONFIGURED)

        lang = language if language in SUPPORTED_LANGUAGES else "en"

        try:
            store = self._get_store()
            results = store.similarity_search_with_relevance_scores(question, k=TOP_K)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Retrieval failed: %s", exc)
            return _empty_result(EMPTY_INDEX)

        if not results:
            return _empty_result(EMPTY_INDEX)

        docs, scores = zip(*results)
        confidence = float(scores[0])
        low_confidence = confidence < self.settings.confidence_threshold

        top = docs[0].metadata
        source = {
            "title": top.get("title", "Unknown"),
            "doc_id": top.get("doc_id", "N/A"),
            "version": top.get("version", "N/A"),
            "date": top.get("date", "N/A"),
        }
        context = "\n\n---\n\n".join(d.page_content for d in docs)

        answer = self._generate(question, context, lang, source)

        # If the model couldn't answer from the docs, don't show a citation.
        grounded = "i don't have that information" not in answer.lower()
        if low_confidence and grounded:
            answer = LOW_CONF_WARNING.get(lang, LOW_CONF_WARNING["en"]) + "\n\n" + answer

        return {
            "answer": answer,
            "source_doc": source["title"] if grounded else "",
            "source_page": source["doc_id"] if grounded else "",
            "source_version": source["version"] if grounded else "",
            "source_last_updated": source["date"] if grounded else "",
            "confidence": self._confidence_label(confidence, low_confidence),
        }

    def _generate(self, question: str, context: str, language: str, source: dict) -> str:
        from langchain_core.output_parsers import StrOutputParser
        from langchain_core.prompts import ChatPromptTemplate

        language_name = SUPPORTED_LANGUAGES.get(language, "English")
        system_message = (
            f"You are a helpful assistant for Roche laboratory scientists.\n"
            f"Always respond in {language_name}.\n"
            "Use ONLY the information in the context below to answer. Do not make "
            "up information. If the context does not contain the answer, say "
            "clearly: \"I don't have that information in my documents. Please "
            "contact the relevant support team.\" Do NOT append a source or "
            "citation line — the application adds the citation separately.\n"
            "Format your answers using markdown: use **bold** for key terms or "
            "important values, and bullet points (- item) or numbered lists for "
            "steps or multiple items. Keep answers concise and well-structured.\n\n"
            "Context:\n{context}"
        )
        prompt = ChatPromptTemplate.from_messages(
            [("system", system_message), ("human", "{question}")]
        )
        chain = prompt | self._get_llm() | StrOutputParser()
        try:
            answer = chain.invoke(
                {"context": context, "question": question}
            ).strip()
            # Defensive: strip any "[Source: ...]" the model may still append.
            return re.sub(
                r"\s*\[source:.*?\]\s*$", "", answer, flags=re.I | re.S
            ).strip()
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.exception("Generation failed: %s", exc)
            msg = str(exc).lower()
            if any(k in msg for k in ("429", "quota", "exhausted", "rate limit", "resourceexhausted")):
                return RATE_LIMITED
            return GENERATION_ERROR


_rag_singleton: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_singleton
    if _rag_singleton is None:
        _rag_singleton = RAGService()
    return _rag_singleton
