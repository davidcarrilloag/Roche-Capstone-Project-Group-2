"""
RAG query pipeline (in-process) — Gemini + ChromaDB.

For a scientist's question: accept/detect the language, retrieve the top-k SOP
chunks from ChromaDB, build a grounded language-aware prompt (with recent
conversation history for follow-ups), and ask Gemini for an answer plus a
source citation (title, version, date).

Exposes `RAGService.query(question, language, history) -> dict`. Degrades
gracefully when no Google API key is configured.

RAG pipeline originally authored by Pablo; integrated into the backend.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import List, Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

TOP_K = 5
# Average the top-N relevance scores for a more robust confidence than top-1.
CONFIDENCE_TOP_N = 3
# How many prior turns to feed the model for follow-up context.
HISTORY_TURNS = 6

SUPPORTED_LANGUAGES = {
    "en": "English",
    "de": "German",
    "fr": "French",
    "it": "Italian",
}

# Sentinel the model returns when the context can't answer (language-agnostic).
NO_ANSWER = "NO_ANSWER"


def _msg(table: dict, lang: str) -> str:
    """Pick a localized message, falling back to English."""
    return table.get(lang, table["en"])


NOT_CONFIGURED = {
    "en": "Document Q&A is not available yet: the knowledge service is missing its Google API key. Please contact your local IT support.",
    "de": "Die Dokumentensuche ist noch nicht verfügbar: Dem Wissensdienst fehlt der Google-API-Schlüssel. Bitte wenden Sie sich an Ihren lokalen IT-Support.",
    "fr": "La recherche documentaire n'est pas encore disponible : la clé API Google est manquante. Veuillez contacter votre support informatique local.",
    "it": "La ricerca documentale non è ancora disponibile: manca la chiave API di Google. Contatta il supporto IT locale.",
}

RATE_LIMITED = {
    "en": "The assistant is temporarily busy (free-tier request limit reached). Please try again in a little while.",
    "de": "Der Assistent ist vorübergehend ausgelastet (Anfragelimit erreicht). Bitte versuchen Sie es in Kürze erneut.",
    "fr": "L'assistant est temporairement occupé (limite de requêtes atteinte). Veuillez réessayer dans un instant.",
    "it": "L'assistente è temporaneamente occupato (limite di richieste raggiunto). Riprova tra poco.",
}

GENERATION_ERROR = {
    "en": "Sorry, I couldn't generate an answer just now. Please try again.",
    "de": "Entschuldigung, ich konnte gerade keine Antwort generieren. Bitte versuchen Sie es erneut.",
    "fr": "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.",
    "it": "Spiacente, non sono riuscito a generare una risposta. Riprova.",
}

EMPTY_INDEX = {
    "en": "I don't have any documents in my knowledge base yet. Please ensure the SOPs have been ingested.",
    "de": "Meine Wissensdatenbank enthält noch keine Dokumente. Bitte stellen Sie sicher, dass die SOPs importiert wurden.",
    "fr": "Ma base de connaissances ne contient encore aucun document. Veuillez vérifier que les SOP ont été importées.",
    "it": "La mia base di conoscenza non contiene ancora documenti. Verifica che le SOP siano state importate.",
}

NOT_FOUND = {
    "en": "I don't have that information in my documents. Please contact the relevant support team.",
    "de": "Diese Information habe ich nicht in meinen Dokumenten. Bitte wenden Sie sich an das zuständige Support-Team.",
    "fr": "Je n'ai pas cette information dans mes documents. Veuillez contacter l'équipe de support concernée.",
    "it": "Non ho questa informazione nei miei documenti. Contatta il team di supporto competente.",
}

LOW_CONF_WARNING = {
    "en": "I'm not very confident in this answer — please verify with the source document.",
    "de": "Ich bin bei dieser Antwort nicht sehr sicher — bitte prüfen Sie das Quelldokument.",
    "fr": "Je ne suis pas très confiant dans cette réponse — veuillez vérifier le document source.",
    "it": "Non sono molto sicuro di questa risposta — verifica con il documento sorgente.",
}

# Markers used internally to flag generation failures (mapped to localized text).
_RATE_LIMITED_MARK = "__RATE_LIMITED__"
_GEN_ERROR_MARK = "__GEN_ERROR__"

# Connector words that signal a follow-up needing prior context for retrieval.
_FOLLOWUP_PREFIXES = (
    "and ", "also ", "what about", "how about", "and for", "and in", "what if",
    "und ", "auch ", "et ", "e ", "y ", "también", "auch", "anche",
)


def _empty_result(answer: str) -> dict:
    return {
        "answer": answer,
        "source_doc": "",
        "source_page": "",
        "source_version": "",
        "source_last_updated": "",
        "confidence": "low",
        "confidence_warning": "",
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

    @staticmethod
    def _is_followup(question: str) -> bool:
        """A short message or a connector ('and...', 'what about...') likely
        depends on the previous turns to be understood."""
        q = question.strip()
        return len(q.split()) <= 6 or q.lower().startswith(_FOLLOWUP_PREFIXES)

    def _standalone_query(self, question: str, history: List[dict]) -> str:
        """
        Rewrite a follow-up into a self-contained search query using the
        conversation, so retrieval targets the *new* intent (e.g.
        "what about returning them?" -> "How do I return chemicals?").
        Falls back to the raw question on any error.
        """
        from langchain_core.messages import HumanMessage, SystemMessage

        convo = "\n".join(
            f"{t.get('role')}: {str(t.get('text', ''))[:200]}"
            for t in history[-4:]
            if str(t.get("text", "")).strip()
        )
        system = (
            "Rewrite the user's last message into a single standalone search "
            "query that captures their current intent, resolving references to "
            "earlier turns. Return ONLY the query — no quotes, no explanation."
        )
        user = f"Conversation:\n{convo}\n\nLast message: {question}\n\nStandalone query:"
        try:
            out = self._get_llm().invoke(
                [SystemMessage(content=system), HumanMessage(content=user)]
            ).content.strip().strip("\"'")
            return out[:200] if out else question
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.warning("Query rewrite failed, using raw question: %s", exc)
            return question

    # ------------------------------------------------------------------
    def query(
        self,
        question: str,
        language: str = "en",
        history: Optional[List[dict]] = None,
    ) -> dict:
        """Answer a question from the SOP corpus with a version-aware citation."""
        lang = language if language in SUPPORTED_LANGUAGES else "en"

        if not self.settings.has_google:
            return _empty_result(_msg(NOT_CONFIGURED, lang))

        retrieval_query = question
        if history and self._is_followup(question):
            retrieval_query = self._standalone_query(question, history)
            logger.info("Follow-up rewrite: %r -> %r", question, retrieval_query)
        try:
            store = self._get_store()
            results = store.similarity_search_with_relevance_scores(retrieval_query, k=TOP_K)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Retrieval failed: %s", exc)
            return _empty_result(_msg(EMPTY_INDEX, lang))

        if not results:
            return _empty_result(_msg(EMPTY_INDEX, lang))

        _, scores = zip(*results)
        # Average the top-N scores for a more robust confidence than top-1.
        top_scores = [float(s) for s in scores[:CONFIDENCE_TOP_N]]
        confidence = sum(top_scores) / len(top_scores)
        low_confidence = confidence < self.settings.confidence_threshold

        # Label each chunk with its doc id so the model can tell us which
        # document it actually used (CITED=<id>). Keep a metadata map and a
        # cumulative-score fallback for the citation.
        meta_by_id: dict = {}
        doc_scores: dict = defaultdict(float)
        labeled = []
        for d, s in results:
            key = d.metadata.get("doc_id") or d.metadata.get("title", "?")
            meta_by_id.setdefault(key, d.metadata)
            doc_scores[key] += float(s)
            labeled.append(f"[DOC {key}] {d.metadata.get('title', '')}\n{d.page_content}")
        context = "\n\n---\n\n".join(labeled)
        fallback_key = max(doc_scores, key=doc_scores.get)

        raw = self._generate(question, context, lang, history)
        if raw == _RATE_LIMITED_MARK:
            return _empty_result(_msg(RATE_LIMITED, lang))
        if raw == _GEN_ERROR_MARK:
            return _empty_result(_msg(GENERATION_ERROR, lang))

        # Parse the cited document and strip control lines from the answer.
        m = re.search(r"CITED\s*=\s*([^\s\]\n]+)", raw, flags=re.I)
        cited = m.group(1).strip() if m else None
        answer = re.sub(r"\s*CITED\s*=.*$", "", raw, flags=re.I | re.S).strip()
        answer = re.sub(r"\s*\[source:.*?\]\s*$", "", answer, flags=re.I | re.S).strip()

        # Language-agnostic grounding: NO_ANSWER (or CITED=NONE) => not grounded.
        grounded = NO_ANSWER not in raw.upper() and (cited or "").upper() != "NONE"
        if not grounded:
            return _empty_result(_msg(NOT_FOUND, lang))

        top = meta_by_id.get(cited) or meta_by_id.get(fallback_key, {})
        warning = _msg(LOW_CONF_WARNING, lang) if low_confidence else ""
        return {
            "answer": answer,
            "source_doc": top.get("title", "Unknown"),
            "source_page": top.get("doc_id", "N/A"),
            "source_version": top.get("version", "N/A"),
            "source_last_updated": top.get("date", "N/A"),
            "confidence": self._confidence_label(confidence, low_confidence),
            "confidence_warning": warning,
        }

    def _generate(
        self,
        question: str,
        context: str,
        language: str,
        history: Optional[List[dict]] = None,
    ) -> str:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        language_name = SUPPORTED_LANGUAGES.get(language, "English")
        system = (
            f"You are a helpful assistant for Roche laboratory scientists.\n"
            f"Always respond in {language_name}.\n"
            "Answer the user's latest question using ONLY the information in the "
            "context below. Use the earlier conversation to resolve follow-ups "
            "(e.g. 'what about step 2?'). Do not make up information.\n"
            f"If the context does not contain the answer, reply with exactly: {NO_ANSWER}\n"
            "Each context chunk is labeled like [DOC <id>]. After your answer, on a "
            "new final line, output exactly: CITED=<id> with the id of the document "
            "your answer relied on most (or CITED=NONE). Output nothing after it.\n\n"
            "FORMAT the answer in markdown so it is easy to scan:\n"
            "- Begin with one short sentence that directly answers the question.\n"
            "- Then use a numbered list (1. 2. 3.) for sequential steps, or a bulleted "
            "list (- ) for options/items. Put each point on its own line.\n"
            "- **Bold** key terms: app/system names, values, times, and deadlines.\n"
            "- Keep each point to a single idea; avoid long paragraphs and walls of text.\n"
            "- Use a short '**Note:**' line only for an important caveat.\n"
            "- Do NOT write your own source/citation line in the answer body.\n\n"
            f"Context:\n{context}"
        )
        messages = [SystemMessage(content=system)]
        for turn in (history or [])[-HISTORY_TURNS:]:
            text = str(turn.get("text", "")).strip()
            if not text:
                continue
            if turn.get("role") == "assistant":
                messages.append(AIMessage(content=text))
            else:
                messages.append(HumanMessage(content=text))
        messages.append(HumanMessage(content=question))

        try:
            return self._get_llm().invoke(messages).content.strip()
        except Exception as exc:  # pragma: no cover - network/defensive
            logger.exception("Generation failed: %s", exc)
            m = str(exc).lower()
            if any(k in m for k in ("429", "quota", "exhausted", "rate limit", "resourceexhausted")):
                return _RATE_LIMITED_MARK
            return _GEN_ERROR_MARK


_rag_singleton: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_singleton
    if _rag_singleton is None:
        _rag_singleton = RAGService()
    return _rag_singleton
