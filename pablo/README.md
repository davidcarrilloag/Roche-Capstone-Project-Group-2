# Roche Scientist Assistant - RAG Pipeline

This folder contains Pablo's part of the Roche capstone: the AI / RAG layer.

The goal of this component is simple: when a scientist asks a question, the system should search the Roche knowledge documents, find the most relevant parts, and generate an answer that is grounded in those documents. Every answer should include the source document, version, and date so the scientist can verify it.

This is not the full Roche assistant. The full product also needs the frontend, backend orchestration, ServiceNow ticket creation, feedback collection, and analytics. This folder is focused on document Q&A.

---

## What This Part Does

The RAG pipeline has two main flows.

### 1. Ingestion flow

This prepares the documents before users ask questions.

```text
Markdown SOP / process documents
        ->
Read document metadata
        ->
Split document into chunks
        ->
Create embeddings
        ->
Store chunks in ChromaDB
```

The ingestion code is in:

```text
src/ingest.py
```

### 2. Query flow

This runs when a scientist asks a question.

```text
Scientist question
        ->
Detect language
        ->
Embed the question
        ->
Search the vector database
        ->
Build prompt with retrieved context
        ->
LLM generates answer
        ->
Return answer + source + version + date
```

The query code is in:

```text
src/query.py
```

The API endpoint is in:

```text
src/api.py
```

Current endpoint:

```text
POST /api/rag/query
```

Example request:

```json
{
  "query": "How do I request access to the chemical storage system?",
  "user_language": "en",
  "user_role": "new_joiner"
}
```

Example response:

```json
{
  "answer": "To request access, follow the access request process...",
  "source": {
    "title": "Chemical Storage Access SOP",
    "version": "v1.3",
    "date": "2026-03-15",
    "doc_id": "SOP-007-EN"
  },
  "language_detected": "en",
  "confidence": 0.87,
  "low_confidence": false
}
```

---

## What David Needs To Build

David's part should produce the synthetic Roche knowledge documents that this pipeline can ingest.

The documents should be written as Markdown files with metadata at the top.

Expected folder:

```text
data/sops/
```

Each document should be one `.md` file.

Recommended number for the demo:

```text
15-20 documents
```

The documents should cover Roche scientist use cases from the project brief:

- New employee onboarding
- Requesting system or lab access
- Ordering chemicals and consumables
- Returning unused or expired materials
- Laboratory waste management
- Cleaning lab equipment
- Cold storage sample handling
- Missing or replacement lab materials
- Equipment maintenance and support
- Troubleshooting common lab issues
- Who to contact for specific processes

The strongest demo will come from documents that contain clear, practical instructions. The RAG system works best when each document answers real questions a scientist might ask.

---

## Required Document Format

Each synthetic SOP should look like this:

```md
---
doc_id: SOP-001-EN
title: Chemical Storage Access Process
version: v1.0
date: 2026-06-01
language: en
topic_tags:
  - onboarding
  - access_request
  - chemical_storage
---

# Chemical Storage Access Process

## Purpose

This document explains how Roche scientists request access to the chemical storage system.

## Who This Applies To

This process applies to new joiners, visiting scientists, and lab staff who need access to chemical storage areas.

## Steps

1. Complete the mandatory safety training.
2. Ask your line manager to approve the access request.
3. Submit the request through the Roche access portal.
4. Wait for confirmation from the lab operations team.

## Support Contact

For questions, contact the Lab Operations Support Team.
```

The metadata fields are important because they are used in citations.

Required fields:

- `doc_id`
- `title`
- `version`
- `date`
- `language`
- `topic_tags`

Supported languages:

- `en` English
- `de` German
- `fr` French
- `it` Italian

For the current Roche scope, English and German are the most important. French and Italian can be added if there is time.

---

## Good Synthetic Data Guidelines

Each document should include:

- A clear title
- A realistic Roche-style process
- Step-by-step instructions
- Required approvals, if relevant
- Support contact or owning team
- Exceptions or warnings, if relevant
- Version and date metadata

Avoid documents that are too generic. For example, this is weak:

```text
Ask your manager if you need help.
```

This is better:

```text
If the access request is urgent, the scientist should mark the request as "priority lab access" and include the experiment start date. The Lab Operations Support Team reviews priority requests within one business day.
```

The more specific the documents are, the better the chatbot answers will be.

---

## API Provider

This project uses Google AI Studio (Gemini) — free tier, no credit card needed.

```text
LLM:        Gemini 2.0 Flash
Embeddings: models/embedding-001
Vector DB:  ChromaDB (local)
```

Get a free key at: https://aistudio.google.com/apikey

---

## How To Run Locally

From this folder:

```bash
pip install -r requirements.txt
```

Create a local `.env` file:

```text
GOOGLE_API_KEY=your_key_here
```

Get your key at: https://aistudio.google.com/apikey

Add David's documents to:

```text
data/sops/
```

Then run ingestion:

```bash
python src/ingest.py
```

Start the API:

```bash
uvicorn src.api:app --reload --port 8001
```

Test endpoint:

```text
http://localhost:8001/health
```

---

## Current Limitations

This is still a prototype. Before the final demo, we should improve:

- Google Drive ingestion or a mocked Google Drive export
- Better version handling
- Language-aware retrieval
- Feedback logging
- Analytics export for frequently asked questions
- ServiceNow integration through the backend
- Unit tests with David's synthetic documents

---

## Architecture Summary

```text
David's synthetic Roche documents
        |
        v
Pablo ingestion pipeline
        |
        v
Chunked documents + metadata + embeddings
        |
        v
ChromaDB vector database
        |
        v
Scientist asks a question
        |
        v
Pablo query pipeline retrieves relevant chunks
        |
        v
LLM generates grounded answer
        |
        v
Frontend shows answer with source, version, and date
```

This is the part David needs to align with: his documents are the knowledge base that makes the RAG system useful.
