"""
RAG pipeline: retrieval-augmented generation over Roche internal documents.

Owner: AI / RAG.

Design notes for the team
-------------------------
* Heavy imports (langchain, chromadb, sentence-transformers) are done lazily
  inside methods so this module can be imported and unit-tested in isolation,
  and so the rest of the backend boots even if the ML stack is still installing.
* The vector store is built lazily on first query and persisted to disk
  (Chroma) so subsequent boots are fast.
* The service NEVER fabricates Roche-specific information: if retrieval scores
  are below threshold it returns an explicit "not found" answer. Every answer
  carries the source document and chunk reference.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

from config import Settings, get_settings

logger = logging.getLogger(__name__)

NOT_FOUND_MESSAGE = (
    "I could not find this information in the available documents. "
    "Please rephrase your question or contact your local IT support."
)

# System prompt keeps the model grounded and citation-friendly.
SYSTEM_PROMPT = (
    "You are the Roche Scientist Assistant. Answer ONLY using the provided "
    "context from internal Roche documents. If the context does not contain "
    "the answer, say you could not find it. Never invent Roche-specific "
    "procedures, system names, or contacts. Be concise and practical. "
    "Always answer in the language requested by the user."
)


class RAGService:
    """Retrieval-augmented QA over the mock document corpus."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._vectorstore = None  # lazily built Chroma instance
        self._embeddings = None
        self._llm = None
        self._manifest = None  # lazily loaded metadata manifest

    # ------------------------------------------------------------------
    # Lazy builders
    # ------------------------------------------------------------------
    def _get_embeddings(self):
        if self._embeddings is None:
            from langchain_huggingface import HuggingFaceEmbeddings

            logger.info("Loading embedding model: %s", self.settings.embedding_model)
            self._embeddings = HuggingFaceEmbeddings(
                model_name=self.settings.embedding_model
            )
        return self._embeddings

    def _get_llm(self):
        if self._llm is None:
            if not self.settings.has_groq:
                return None
            from langchain_groq import ChatGroq

            self._llm = ChatGroq(
                api_key=self.settings.groq_api_key,
                model=self.settings.groq_model,
                temperature=0.1,
            )
        return self._llm

    @staticmethod
    def _normalize(name: str) -> str:
        """Normalize a filename stem to alphanumeric-lowercase for matching."""
        return re.sub(r"[^a-z0-9]+", "", name.lower())

    def _load_manifest(self) -> dict:
        """Load the document metadata manifest, keyed by normalized filename.

        Returns {} if the manifest is missing or unreadable, so ingestion still
        works without it (just without version-aware citations).
        """
        if self._manifest is not None:
            return self._manifest

        self._manifest = {}
        manifest_path = Path(self.settings.manifest_path)
        if not manifest_path.exists():
            logger.info("No manifest at %s; skipping metadata enrichment", manifest_path)
            return self._manifest
        try:
            import yaml

            data = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
            for entry in data.get("documents", []):
                fname = entry.get("file", "")
                key = self._normalize(Path(fname).stem)
                if key:
                    self._manifest[key] = entry
            logger.info("Loaded manifest with %d document entries", len(self._manifest))
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Failed to read manifest: %s", exc)
        return self._manifest

    def _load_documents(self):
        """Load and split all .md and .pdf source documents.

        The list of files comes from the GoogleDriveService, which returns
        local mock docs in mock mode and downloaded Drive files in real mode —
        so the RAG pipeline is agnostic to the document source.
        """
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain_community.document_loaders import (
            PyPDFLoader,
            TextLoader,
        )

        from services.gdrive import get_gdrive_service

        paths = [Path(p) for p in get_gdrive_service().list_documents()]
        if not paths:
            logger.warning("No source documents found to index.")
            return []

        manifest = self._load_manifest()

        raw_docs = []
        for path in paths:
            try:
                if path.suffix.lower() == ".md":
                    loaded = TextLoader(str(path), encoding="utf-8").load()
                elif path.suffix.lower() == ".pdf":
                    loaded = PyPDFLoader(str(path)).load()
                else:
                    continue
                # Attach metadata: filename for retrieval + manifest entry
                # (title, version, last_updated, tags) for version-aware citations.
                meta = manifest.get(self._normalize(path.stem), {})
                for d in loaded:
                    d.metadata["source_file"] = path.name
                    d.metadata["source_doc"] = meta.get("title", path.name)
                    d.metadata["version"] = str(meta.get("version", ""))
                    d.metadata["last_updated"] = str(meta.get("last_updated", ""))
                raw_docs.extend(loaded)
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Failed to load %s: %s", path, exc)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50
        )
        chunks = splitter.split_documents(raw_docs)
        # Add a stable chunk index for "source_page" references.
        for i, chunk in enumerate(chunks):
            chunk.metadata.setdefault("chunk_index", i)
        logger.info("Loaded %d chunks from %d documents", len(chunks), len(raw_docs))
        return chunks

    def _get_vectorstore(self):
        if self._vectorstore is not None:
            return self._vectorstore

        from langchain_community.vectorstores import Chroma

        embeddings = self._get_embeddings()
        persist_dir = self.settings.chroma_db_path

        # If a persisted store already exists, reuse it; otherwise build it.
        chunks = self._load_documents()
        if chunks:
            self._vectorstore = Chroma.from_documents(
                documents=chunks,
                embedding=embeddings,
                persist_directory=persist_dir,
            )
        else:
            # Empty store so the app still runs without docs.
            self._vectorstore = Chroma(
                embedding_function=embeddings,
                persist_directory=persist_dir,
            )
        return self._vectorstore

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @staticmethod
    def _confidence_from_score(score: float) -> str:
        """Chroma returns L2 distance (lower = closer). Map to a label."""
        if score <= 0.8:
            return "high"
        if score <= 1.2:
            return "medium"
        return "low"

    def query(self, question: str, language: str = "en") -> dict:
        """
        Answer a question from the document corpus.

        Returns a dict with keys: answer, source_doc, source_page, confidence.
        """
        try:
            store = self._get_vectorstore()
            results = store.similarity_search_with_score(question, k=4)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Retrieval failed: %s", exc)
            return {
                "answer": NOT_FOUND_MESSAGE,
                "source_doc": "",
                "source_page": "",
                "confidence": "low",
            }

        if not results:
            return {
                "answer": NOT_FOUND_MESSAGE,
                "source_doc": "",
                "source_page": "",
                "confidence": "low",
            }

        # Best (closest) match first.
        best_doc, best_score = results[0]
        # Convert distance to a 0-1 similarity for thresholding.
        similarity = 1.0 / (1.0 + best_score)
        if similarity < self.settings.retrieval_threshold:
            return {
                "answer": NOT_FOUND_MESSAGE,
                "source_doc": "",
                "source_page": "",
                "confidence": "low",
            }

        context = "\n\n---\n\n".join(d.page_content for d, _ in results)
        source_doc = best_doc.metadata.get("source_doc", "unknown")
        page = best_doc.metadata.get(
            "page", best_doc.metadata.get("chunk_index", "")
        )

        answer = self._generate_answer(question, context, language)

        return {
            "answer": answer,
            "source_doc": source_doc,
            "source_page": str(page),
            "source_version": best_doc.metadata.get("version", ""),
            "source_last_updated": best_doc.metadata.get("last_updated", ""),
            "confidence": self._confidence_from_score(best_score),
        }

    def _generate_answer(self, question: str, context: str, language: str) -> str:
        """Call Groq to synthesise an answer; fall back to raw context."""
        llm = self._get_llm()
        if llm is None:
            # No Groq key configured: return the most relevant chunk verbatim
            # so the pipeline still demonstrates retrieval end-to-end.
            return (
                "(LLM not configured — showing the most relevant excerpt)\n\n"
                + context.split("\n\n---\n\n")[0]
            )

        from langchain_core.messages import HumanMessage, SystemMessage

        user_prompt = (
            f"Answer in language code '{language}'.\n\n"
            f"Context from Roche documents:\n{context}\n\n"
            f"Question: {question}"
        )
        try:
            resp = llm.invoke(
                [
                    SystemMessage(content=SYSTEM_PROMPT),
                    HumanMessage(content=user_prompt),
                ]
            )
            return resp.content.strip()
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("LLM generation failed: %s", exc)
            return NOT_FOUND_MESSAGE


# Module-level singleton helper for dependency injection.
_rag_singleton: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_singleton
    if _rag_singleton is None:
        _rag_singleton = RAGService()
    return _rag_singleton
