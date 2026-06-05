"""
SOP ingestion — build the RAG vector index from the document knowledge base.

Reads Markdown SOPs (with YAML frontmatter) from SOPS_PATH, chunks them, embeds
them with Gemini, and upserts into a local ChromaDB collection. Re-ingesting a
document replaces its old chunks (keyed by doc_id), so versions stay clean.

Optionally syncs the SOPs from Google Drive first (the Drive bridge).

Run standalone:
    python -m services.ingest           # ingest local data/sops
    python -m services.ingest --sync    # pull from Google Drive first, then ingest

RAG pipeline originally authored by Pablo; integrated into the backend.
"""

from __future__ import annotations

import glob
import logging
from pathlib import Path
from typing import Optional

import yaml

from config import Settings, get_settings

logger = logging.getLogger(__name__)

COLLECTION = "roche_sops"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
REQUIRED_FIELDS = ["doc_id", "title", "version", "date", "language"]


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML frontmatter; returns (metadata, body)."""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                return yaml.safe_load(parts[1]) or {}, parts[2].strip()
            except yaml.YAMLError:
                pass
    return {}, content


def load_sops(sop_dir: str) -> list:
    """Read all .md SOPs from sop_dir into LangChain Documents with metadata."""
    from langchain_core.documents import Document

    documents = []
    files = sorted(glob.glob(str(Path(sop_dir) / "*.md")))
    if not files:
        logger.warning("No .md SOPs found in %s", sop_dir)
        return []

    for fp in files:
        meta, body = parse_frontmatter(Path(fp).read_text(encoding="utf-8"))
        missing = [k for k in REQUIRED_FIELDS if k not in meta]
        if missing:
            logger.warning("Skipping %s — missing metadata fields: %s", fp, missing)
            continue

        # ChromaDB metadata values must be scalar (str/int/float/bool).
        tags = meta.get("topic_tags", [])
        meta["topic_tags"] = ", ".join(tags) if isinstance(tags, list) else str(tags)
        meta = {
            k: (v if isinstance(v, (str, int, float, bool)) else str(v))
            for k, v in meta.items()
        }
        meta["source_file"] = Path(fp).name

        documents.append(Document(page_content=body, metadata=meta))
        logger.info("Loaded %s — %s (%s)", meta.get("doc_id"), meta.get("title"),
                    meta.get("language"))
    return documents


def chunk_documents(documents: list) -> list:
    """Split documents into ~500-char chunks, preserving structure on headings."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "],
    )
    chunks = []
    for doc in documents:
        for i, chunk in enumerate(splitter.split_documents([doc])):
            chunk.metadata["chunk_index"] = i
            chunks.append(chunk)
    logger.info("Split %d documents into %d chunks", len(documents), len(chunks))
    return chunks


def _embeddings(settings: Settings):
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model,
        google_api_key=settings.google_api_key,
    )


def get_vectorstore(settings: Optional[Settings] = None):
    """Return the persisted Chroma vector store (shared by ingest + query)."""
    settings = settings or get_settings()
    from langchain_chroma import Chroma

    return Chroma(
        collection_name=COLLECTION,
        embedding_function=_embeddings(settings),
        persist_directory=settings.chroma_db_path,
    )


def ingest(settings: Optional[Settings] = None, sync_drive: bool = False) -> int:
    """
    Build/refresh the vector index. Returns the number of chunks ingested.

    If sync_drive is True, pulls the latest SOPs from Google Drive into SOPS_PATH
    before ingesting (the Drive bridge).
    """
    settings = settings or get_settings()
    if not settings.has_google:
        raise EnvironmentError(
            "GOOGLE_API_KEY is not set — required for RAG ingestion. "
            "Get a free key at https://aistudio.google.com/apikey"
        )

    if sync_drive:
        from services.gdrive import get_gdrive_service

        n = get_gdrive_service().sync_to_sops(settings.sops_path)
        logger.info("Drive sync: %d SOP file(s) pulled into %s", n, settings.sops_path)

    documents = load_sops(settings.sops_path)
    if not documents:
        logger.warning("Nothing to ingest.")
        return 0

    chunks = chunk_documents(documents)
    store = get_vectorstore(settings)

    # Upsert: delete stale chunks for each doc_id before adding the fresh ones.
    seen = set()
    for chunk in chunks:
        doc_id = chunk.metadata.get("doc_id")
        if doc_id and doc_id not in seen:
            existing = store.get(where={"doc_id": doc_id})
            if existing["ids"]:
                store.delete(ids=existing["ids"])
            seen.add(doc_id)

    store.add_documents(chunks)
    logger.info("Ingestion complete: %d chunks from %d documents", len(chunks), len(documents))
    return len(chunks)


if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
    )
    ingest(sync_drive="--sync" in sys.argv)
