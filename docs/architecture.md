# Roche Scientist Assistant — Architecture

**Project:** Scientist Assistant Chatbot (Roche Capstone, Group 2)
**Status:** Integrated single-service backend with a working Gemini RAG, Google
Drive document sync, and ServiceNow incident creation.
**Last updated:** June 2026

---

## 1. What the system does

A chatbot for Roche laboratory scientists that gives them one place to:

1. **Ask questions** answered from internal SOPs/knowledge docs, with a
   **source citation** (document title, version, date) on every answer.
2. **Create IT incidents** in ServiceNow from natural language.
3. **Give feedback**, with automatic **sentiment** detection feeding a dashboard.
4. Work in their **own language** (English, German, French, Italian).

Accuracy matters: the assistant is **grounded** — if the answer isn't in the
documents, it says so rather than guessing.

---

## 2. High-level architecture

Everything runs as **one FastAPI backend** (`backend/`, port 8000). The RAG is an
in-process module — not a separate service.

```
                         React + Tailwind frontend (Vite)
                         Chat page  ·  Feedback widget  ·  Dashboard
                                        │  REST (JSON)
                                        ▼
        ┌──────────────────────────────────────────────────────────┐
        │                 FastAPI backend  (port 8000)              │
        │   routes:  /chat   /feedback   /incidents   /admin/reindex │
        └───┬───────────────┬───────────────┬───────────────┬───────┘
            │               │               │               │
            ▼               ▼               ▼               ▼
   ┌─────────────┐  ┌──────────────┐ ┌────────────┐ ┌───────────────┐
   │  Intent     │  │  Sentiment   │ │ Translator │ │  ServiceNow   │
   │  classifier │  │  (Groq)      │ │ (Groq +    │ │  client       │
   │  (Groq*)    │  │              │ │ langdetect)│ │  (Table API)  │
   └──────┬──────┘  └──────────────┘ └────────────┘ └───────────────┘
          │ question
          ▼
   ┌──────────────────────────────────────────────┐
   │            RAG  (services/rag.py)              │
   │  Gemini embeddings → ChromaDB top-k search     │
   │  → grounded, language-aware prompt → Gemini    │
   │  → answer + [Source: title | version | date]   │
   └───────────────────┬────────────────────────────┘
                       │ index built by services/ingest.py
                       ▼
            ┌────────────────────────┐        ┌──────────────┐
            │  data/sops/ SOP-001…08 │ ◄─sync──│ Google Drive │
            │  (Markdown + frontmtr) │ bridge   │ (live source)│
            └────────────────────────┘        └──────────────┘

   * Groq-backed services degrade to lightweight heuristics if no Groq key.
```

### Request flow for `/chat`
1. Detect the message language (`langdetect`), or use the client-provided code.
2. Classify intent: **question** vs **feedback**.
3a. **Feedback** → run sentiment → store it → acknowledge (translated).
3b. **Question** → RAG → grounded answer + version-aware citation.

---

## 3. RAG pipeline

### Query (`services/rag.py`)
```
question
  → embed with Gemini (models/gemini-embedding-001)
  → ChromaDB similarity_search_with_relevance_scores (top-k = 5)
  → build a grounded, language-aware prompt (citation rules injected)
  → Gemini chat (gemini-flash-latest) generates the answer
  → return answer + source{title, doc_id, version, date} + confidence
```
- **Confidence:** the relevance score of the top chunk. Below
  `CONFIDENCE_THRESHOLD` (0.45) the answer is prefixed with a low-confidence
  warning in the user's language.
- **Grounding:** the system prompt forbids using anything outside the retrieved
  context and requires the `[Source: title | version | date]` line.

### Ingestion (`services/ingest.py`)
```
data/sops/*.md
  → parse YAML frontmatter (doc_id, title, version, date, language, topic_tags)
  → chunk (~500 chars, 50 overlap, split on headings)
  → embed with Gemini (batched, with backoff for the free-tier 429 limit)
  → upsert into ChromaDB, keyed by doc_id (re-ingest replaces old chunks)
```
Run with `python -m services.ingest` (add `--sync` to pull from Drive first).
The backend also auto-ingests on startup if the index is empty, and exposes
`POST /admin/reindex?sync_drive=true` to rebuild at runtime.

---

## 4. Document source — Google Drive bridge

Google Drive is the **live source of truth** for the knowledge base.

- A read-only **service account** (shared on the Drive folder as Viewer) is used
  to fetch documents — no human OAuth, follows the scientist across devices.
- `services/gdrive.py` → `sync_to_sops()` **mirrors** the Drive folder into
  `data/sops/`: it downloads the Markdown SOPs (and native Google Docs exported
  as Markdown) and removes stale local copies. If Drive is empty or unreachable,
  it safely keeps the committed seed SOPs.
- The ingester then indexes whatever is in `data/sops/`.

```
Selva updates a doc in Drive
   → sync_to_sops() mirrors Drive → data/sops/
   → ingest() re-embeds changed docs (upsert by doc_id)
   → next query answers from the new version
```

---

## 5. SOP document format

Each SOP is a Markdown file with YAML frontmatter — this metadata powers the
version-aware citations Selva requires.

```markdown
---
doc_id: SOP-004-EN
title: Laboratory Waste Management Guide
version: v1.0
date: "2026-05-20"
language: en
topic_tags: [waste, disposal, biohazard, EHS]
roche_use_cases: "4"
---

# Laboratory Waste Management Guide
...
```

Required fields (the ingester skips files missing them): `doc_id`, `title`,
`version`, `date`, `language`. ChromaDB stores these as chunk metadata; the top
chunk's metadata becomes the citation.

The current corpus is the 8 documents Selva provided, mapped to her 11 use
cases (onboarding, ordering, returns, waste, equipment cleaning, calibration,
facilities/access, lab sharing).

---

## 6. Multilingual

- **Detection:** `langdetect` runs before retrieval; supported codes are
  `en`, `de`, `fr`, `it` (others default to `en`).
- **Generation:** the detected language name is injected into the system prompt,
  so Gemini answers in that language (verified: a German question returns a
  German answer).
- Gemini is strongly multilingual out of the box, so no per-language models are
  needed. Translating SOPs into DE/FR also improves *retrieval* in those
  languages (planned).

---

## 7. Other services

| Service | File | Notes |
|---------|------|-------|
| Intent classifier | `services/classifier.py` | question vs feedback (Groq + heuristic fallback) |
| Sentiment | `services/sentiment.py` | positive/negative/neutral/frustrated/confused/satisfied |
| Translator | `services/translator.py` | langdetect + Groq translation |
| Feedback store | `services/feedback_store.py` | JSONL log + aggregation for the dashboard |
| ServiceNow | `services/servicenow.py` | real incidents via the Table API; mock mode for dev |

---

## 8. Tech stack (as built)

| Component | Tool | Reason |
|-----------|------|--------|
| LLM (RAG answers) | **Gemini** `gemini-flash-latest` (Google AI Studio) | Free tier, strong multilingual, native embeddings |
| Embeddings | **`models/gemini-embedding-001`** (3072-dim) | Same provider as the LLM, free |
| Vector DB | **ChromaDB** (local, persisted) | Zero infra, easy to run for the demo |
| RAG orchestration | **LangChain** 0.3 | Standard framework; loaders, splitters, LCEL chains |
| LLM (NLP helpers) | **Groq** (Llama 3.x) | Fast/free for sentiment, translation, intent; heuristic fallback |
| Language detection | **langdetect** | Lightweight, no API cost |
| Backend | **FastAPI** (async) | Single service, Swagger docs, DI |
| Frontend | **React + Vite + Tailwind** | Touchscreen-friendly chat UI |
| Documents | **Google Drive API v3** (service account) | Live document source |
| Ticketing | **ServiceNow REST** (Table API) | Real incident creation |

> **Why two LLM providers?** Document Q&A uses Gemini (native multilingual +
> free embeddings in one provider). The smaller NLP helpers use Groq and fall
> back to heuristics, so the app works even without a Groq key.

---

## 9. Configuration (environment variables)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_API_KEY` | Gemini key (aistudio.google.com/apikey) — powers the RAG |
| `GEMINI_MODEL` / `EMBEDDING_MODEL` | default `gemini-flash-latest` / `models/gemini-embedding-001` |
| `CHROMA_DB_PATH` / `SOPS_PATH` | vector store and SOP folder locations |
| `CONFIDENCE_THRESHOLD` | low-confidence cutoff (default 0.45) |
| `GROQ_API_KEY` | optional — sentiment/translation/intent (heuristic fallback) |
| `GOOGLE_DRIVE_FOLDER_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive sync |
| `SERVICENOW_INSTANCE_URL` / `_USERNAME` / `_PASSWORD` | live incidents |
| `MOCK_MODE` | mock ServiceNow responses when true |

Secrets live in `.env` and `backend/secrets/` — both gitignored.

---

## 10. Repository structure

```
scientist-assistant/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, routers, startup ingest
│   ├── config.py               # settings from .env
│   ├── routes/                 # chat, feedback, incidents
│   ├── services/
│   │   ├── rag.py              # in-process Gemini + ChromaDB query
│   │   ├── ingest.py          # SOP ingestion (chunk, embed, upsert)
│   │   ├── gdrive.py          # Google Drive → data/sops sync bridge
│   │   ├── servicenow.py      # ServiceNow incident client
│   │   ├── sentiment.py · translator.py · classifier.py
│   │   └── feedback_store.py
│   └── models/schemas.py       # Pydantic request/response models
├── data/sops/                  # SOP knowledge base (synced from Drive)
├── docs/architecture.md        # this file
├── frontend/                   # React + Vite + Tailwind UI
├── requirements.txt            # backend dependencies (pinned)
├── .env.example
└── docker-compose.yml
```

---

## 11. LLM selection — research (background)

The team evaluated leading models across multilingual quality (EN/DE/FR/IT),
RAG suitability, latency, and cost.

| # | Model | Provider | Multilingual | RAG fit | Cost | Notes |
|---|-------|----------|--------------|---------|------|-------|
| 1 | GPT-4o | OpenAI | Excellent | Strong | $$ | Best all-round, paid |
| 2 | Claude Sonnet | Anthropic | Excellent | Strong | $$ | Best for long docs / careful answers |
| 3 | Gemini 2.x/Flash | Google | Excellent | Strong | **Free tier** | Native embeddings; chosen |
| 4 | Command R+ | Cohere | Good | Best native RAG | $$ | RAG-specialised |
| 5 | Llama (hosted) | Meta/Groq | Very good | Good | Free/cheap | Used for NLP helpers |
| 6 | Qwen 3 | Alibaba | Excellent | Very good | Cheap | Strong multilingual |
| 7 | Mistral Large | Mistral | Good (FR/DE) | Good | $$ | EU vendor, GDPR-friendly |
| 8 | DeepSeek V3 | DeepSeek | Good | Good | Cheap | Data-residency risk |

**Decision: Gemini Flash.** The capstone constraint is **100% free, no credit
card**. Gemini gives a generous free tier, strong EN/DE/FR/IT performance, and a
matching free **embedding** model — so the entire RAG (embeddings + generation)
runs on one free key. The architecture keeps the LLM call wrapped in one place,
so swapping providers later is a config change.

---

## 12. Key decisions & assumptions

- **Single integrated service.** The RAG runs in-process in the backend (not a
  separate microservice) for a simpler demo and one deployment unit.
- **Google Drive is the live document source**, mirrored into `data/sops/`;
  the repo keeps a committed seed copy as a fallback.
- **Upsert by `doc_id`.** Re-ingesting a document cleanly replaces its chunks,
  so updating a doc in Drive + re-syncing reflects immediately.
- **Graceful degradation.** Missing keys don't crash the app: no Gemini key →
  a clear "not configured" message; no Groq key → heuristic sentiment/intent.
- **ChromaDB for the demo**, a managed vector DB (e.g. Pinecone/Weaviate) for a
  real Roche deployment.
