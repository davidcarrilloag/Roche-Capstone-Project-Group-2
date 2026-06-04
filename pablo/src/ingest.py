"""
ingest.py — SOP ingestion pipeline

Reads all Markdown SOP files from a folder, chunks them, embeds them
using OpenAI, and stores everything in a local ChromaDB vector database.

Run this every time new or updated SOPs are added:
    python src/ingest.py

The vector DB is stored in ./chroma_db/ and persists between runs.
New versions of a document replace the old chunks automatically.
"""

import os
import re
import glob
import yaml
import logging
from pathlib import Path
from dotenv import load_dotenv

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

# Load API key from .env
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(message)s")
log = logging.getLogger(__name__)

# Paths
SOP_DIR = Path(__file__).parent.parent / "data" / "sops"
CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"

# Chunking config — 500 tokens, 50-token overlap (see architecture doc)
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """
    Extract YAML frontmatter from a Markdown file.
    Returns (metadata_dict, body_text).
    Frontmatter is the block between the first two '---' lines.
    """
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                metadata = yaml.safe_load(parts[1])
                body = parts[2].strip()
                return metadata or {}, body
            except yaml.YAMLError:
                pass
    return {}, content


def load_sops(sop_dir: Path) -> list[Document]:
    """
    Read all .md files from sop_dir.
    Returns a list of LangChain Document objects with metadata attached.
    """
    documents = []
    sop_files = glob.glob(str(sop_dir / "*.md"))

    if not sop_files:
        log.warning(f"No .md files found in {sop_dir}. Add SOPs first.")
        return []

    for filepath in sop_files:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()

        metadata, body = parse_frontmatter(raw)

        # Ensure required fields exist — warn and skip if missing
        required = ["doc_id", "title", "version", "date", "language"]
        missing = [k for k in required if k not in metadata]
        if missing:
            log.warning(f"Skipping {filepath} — missing metadata fields: {missing}")
            continue

        # Normalise topic_tags to a comma-separated string
        # (ChromaDB metadata values must be strings, ints, or floats)
        tags = metadata.get("topic_tags", [])
        metadata["topic_tags"] = ", ".join(tags) if isinstance(tags, list) else str(tags)
        metadata["source_file"] = Path(filepath).name

        documents.append(Document(page_content=body, metadata=metadata))
        log.info(f"Loaded: {metadata['doc_id']} — {metadata['title']} ({metadata['language']})")

    return documents


def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Split each document into chunks of ~500 characters with 50-char overlap.
    Each chunk inherits the parent document's metadata plus a chunk_index.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "],
    )

    chunks = []
    for doc in documents:
        split_docs = splitter.split_documents([doc])
        for i, chunk in enumerate(split_docs):
            # Add chunk index to metadata for ordering/debugging
            chunk.metadata["chunk_index"] = i
        chunks.extend(split_docs)

    log.info(f"Split {len(documents)} documents into {len(chunks)} chunks")
    return chunks


def delete_existing_doc(vectorstore: Chroma, doc_id: str) -> None:
    """
    Remove all existing chunks for a doc_id before re-ingesting.
    This ensures updated versions replace old ones cleanly.
    """
    existing = vectorstore.get(where={"doc_id": doc_id})
    if existing["ids"]:
        vectorstore.delete(ids=existing["ids"])
        log.info(f"Removed {len(existing['ids'])} stale chunks for {doc_id}")


def ingest(sop_dir: Path = SOP_DIR, chroma_dir: Path = CHROMA_DIR) -> None:
    """
    Main ingestion function.
    Loads SOPs, chunks them, and upserts into ChromaDB.
    """
    # Validate API key is set
    if not os.getenv("GOOGLE_API_KEY"):
        raise EnvironmentError(
            "GOOGLE_API_KEY is not set. Copy .env.example to .env and add your key.\n"
            "Get a free key at: https://aistudio.google.com/apikey"
        )

    log.info(f"Loading SOPs from: {sop_dir}")
    documents = load_sops(sop_dir)
    if not documents:
        return

    chunks = chunk_documents(documents)

    # Initialise embeddings and vector store
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vectorstore = Chroma(
        collection_name="roche_sops",
        embedding_function=embeddings,
        persist_directory=str(chroma_dir),
    )

    # For each unique doc_id, delete stale chunks before adding new ones
    doc_ids_seen = set()
    for chunk in chunks:
        doc_id = chunk.metadata.get("doc_id")
        if doc_id and doc_id not in doc_ids_seen:
            delete_existing_doc(vectorstore, doc_id)
            doc_ids_seen.add(doc_id)

    # Add all new chunks
    vectorstore.add_documents(chunks)
    log.info(f"Ingestion complete. {len(chunks)} chunks stored in {chroma_dir}")


if __name__ == "__main__":
    ingest()
