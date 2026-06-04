"""
query.py — RAG query pipeline

Handles a scientist's question end-to-end:
1. Detect the language of the query
2. Retrieve the top-k most relevant SOP chunks from ChromaDB
3. Build a grounded, language-aware prompt
4. Call Gemini Flash and return the answer with source citation

LLM provider: Google AI Studio (free tier)
Get your key at: https://aistudio.google.com/apikey
Set GOOGLE_API_KEY in your .env file.

Usage (standalone test):
    python src/query.py "How do I request lab access?"
    python src/query.py "Wie entsorge ich chemische Abfälle?"
"""

import os
import sys
import logging
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv
from langdetect import detect, LangDetectException

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(message)s")
log = logging.getLogger(__name__)

CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"

# Supported languages and their full names for the prompt
SUPPORTED_LANGUAGES = {
    "en": "English",
    "de": "German",
    "fr": "French",
    "it": "Italian",
}

# Minimum retrieval similarity score to consider an answer confident
CONFIDENCE_THRESHOLD = 0.6

# Number of chunks to retrieve per query
TOP_K = 5


@dataclass
class RAGResponse:
    """Structured response returned by the pipeline to the API layer."""
    answer: str
    source_title: str
    source_doc_id: str
    source_version: str
    source_date: str
    language_detected: str
    confidence: float
    low_confidence: bool


def detect_language(text: str) -> str:
    """
    Detect the language of the input text.
    Returns a 2-letter language code (en, de, fr, it).
    Defaults to 'en' for unsupported or undetectable languages.
    """
    try:
        detected = detect(text)
        if detected in SUPPORTED_LANGUAGES:
            return detected
        log.info(f"Unsupported language detected ({detected}), defaulting to 'en'")
        return "en"
    except LangDetectException:
        log.warning("Language detection failed, defaulting to 'en'")
        return "en"


def build_prompt(language_code: str) -> ChatPromptTemplate:
    """
    Build the system prompt with language and citation rules injected.
    The LLM is instructed to stay grounded and always cite its source.
    """
    language_name = SUPPORTED_LANGUAGES.get(language_code, "English")

    system_message = f"""You are a helpful assistant for Roche laboratory scientists.
Always respond in {language_name}.
Use ONLY the information provided in the context below to answer the question.
Do not make up information. If the context does not contain enough information to answer,
say clearly: "I don't have that information in my documents. Please contact the relevant support team."

After your answer, always add a source line in this exact format:
[Source: {{doc_title}} | {{doc_version}} | {{doc_date}}]

Context:
{{context}}"""

    return ChatPromptTemplate.from_messages([
        ("system", system_message),
        ("human", "{question}"),
    ])


def format_chunks(docs) -> str:
    """Concatenate retrieved document chunks into a single context string."""
    return "\n\n---\n\n".join(doc.page_content for doc in docs)


def get_best_source_metadata(docs: list) -> dict:
    """
    Extract metadata from the top retrieved chunk (highest relevance).
    This is what gets cited in the response.
    """
    if not docs:
        return {"title": "Unknown", "doc_id": "N/A", "version": "N/A", "date": "N/A"}
    top = docs[0].metadata
    return {
        "title": top.get("title", "Unknown"),
        "doc_id": top.get("doc_id", "N/A"),
        "version": top.get("version", "N/A"),
        "date": top.get("date", "N/A"),
    }


def run_query(
    question: str,
    user_language: str = None,
    user_role: str = None,
) -> RAGResponse:
    """
    Main query function — runs the full RAG pipeline for a scientist's question.

    Args:
        question: The scientist's question in any supported language.
        user_language: Override language detection (optional).
        user_role: Scientist's role, e.g. 'new_joiner' (optional, for logging).

    Returns:
        RAGResponse with answer, source metadata, and confidence score.
    """
    if not os.getenv("GOOGLE_API_KEY"):
        raise EnvironmentError(
            "GOOGLE_API_KEY is not set. Copy .env.example to .env and add your key.\n"
            "Get a free key at: https://aistudio.google.com/apikey"
        )

    # Step 1: detect language
    language = user_language or detect_language(question)
    log.info(f"Language: {language} | Role: {user_role or 'unknown'} | Query: {question[:80]}")

    # Step 2: connect to vector store and retrieve top-k chunks
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vectorstore = Chroma(
        collection_name="roche_sops",
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )

    # retrieve with relevance scores so we can compute confidence
    results_with_scores = vectorstore.similarity_search_with_relevance_scores(
        question, k=TOP_K
    )

    if not results_with_scores:
        return RAGResponse(
            answer="I don't have any documents in my knowledge base yet. Please ensure SOPs have been ingested.",
            source_title="N/A", source_doc_id="N/A",
            source_version="N/A", source_date="N/A",
            language_detected=language,
            confidence=0.0,
            low_confidence=True,
        )

    docs, scores = zip(*results_with_scores)
    confidence = float(scores[0])  # top chunk score
    low_confidence = confidence < CONFIDENCE_THRESHOLD

    # Step 3: build the chain — retriever | prompt | LLM | parser
    source_meta = get_best_source_metadata(list(docs))
    context = format_chunks(list(docs))

    prompt = build_prompt(language)
    # Gemini 2.0 Flash: fast, free tier, strong multilingual (EN/DE/FR/IT)
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0)

    # Simple chain using LCEL (LangChain Expression Language)
    chain = prompt | llm | StrOutputParser()

    raw_answer = chain.invoke({
        "context": context,
        "question": question,
        "doc_title": source_meta["title"],
        "doc_version": source_meta["version"],
        "doc_date": source_meta["date"],
    })

    # Prepend a low-confidence warning if retrieval score is weak
    if low_confidence:
        warning = {
            "en": "Note: I'm not very confident in this answer — please verify with the source document.",
            "de": "Hinweis: Ich bin nicht sehr sicher bei dieser Antwort — bitte prüfen Sie das Quelldokument.",
            "fr": "Note: Je ne suis pas très confiant dans cette réponse — veuillez vérifier le document source.",
            "it": "Nota: Non sono molto sicuro di questa risposta — si prega di verificare il documento sorgente.",
        }
        raw_answer = warning.get(language, warning["en"]) + "\n\n" + raw_answer

    return RAGResponse(
        answer=raw_answer,
        source_title=source_meta["title"],
        source_doc_id=source_meta["doc_id"],
        source_version=source_meta["version"],
        source_date=source_meta["date"],
        language_detected=language,
        confidence=round(confidence, 3),
        low_confidence=low_confidence,
    )


if __name__ == "__main__":
    # Quick CLI test: python src/query.py "your question here"
    if len(sys.argv) < 2:
        print("Usage: python src/query.py \"your question\"")
        sys.exit(1)

    question = " ".join(sys.argv[1:])
    result = run_query(question)

    print("\n" + "="*60)
    print(f"ANSWER ({result.language_detected.upper()}):")
    print(result.answer)
    print(f"\nSource: {result.source_title} | {result.source_version} | {result.source_date}")
    print(f"Confidence: {result.confidence} {'(LOW)' if result.low_confidence else '(OK)'}")
    print("="*60)
