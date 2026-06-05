# RAG Pipeline — Architecture Document
**Role:** Pablo — AI / RAG Pipeline  
**Project:** Roche Scientist Assistant Chatbot  
**Date:** June 2026

---

## 1. What this component does

The RAG (Retrieval-Augmented Generation) pipeline is the intelligence layer of the chatbot. When a scientist types a question, this component:

1. Converts the question into a vector embedding
2. Searches the document database for the most relevant chunks
3. Injects those chunks as context into an LLM prompt
4. Returns a grounded answer with a source citation and document version

Without RAG, the LLM would hallucinate answers. With RAG, every answer is traceable to a real document.

---

## 2. LLM Selection — Top 10 Comparison

Evaluated across five criteria relevant to this project: multilingual quality (EN/DE/FR/IT), RAG suitability, latency, cost, and enterprise readiness.

| # | Model | Provider | Multilingual | RAG fit | Latency | Cost (per 1M tokens) | Verdict |
|---|-------|----------|-------------|---------|---------|----------------------|---------|
| 1 | **GPT-4o** | OpenAI | Excellent | Strong | ~1-2s | ~$5 input / $15 output | Best all-round for this project |
| 2 | **Claude Sonnet 4.6** | Anthropic | Excellent | Strong | ~1-2s | ~$3 input / $15 output | Best for long documents + careful answers |
| 3 | **Gemini 2.5 Pro** | Google | Excellent | Strong (1M context) | ~1-3s | ~$3.5 input / $10.5 output | Best context window; Google-native |
| 4 | **Command R+** | Cohere | Good | Best native RAG | ~0.5-1s | ~$3 input / $15 output | Built for RAG, less frontier reasoning |
| 5 | **Llama 4 Maverick** | Meta (hosted) | Very good (12 langs) | Good | ~0.5-1s | Free self-hosted / ~$0.5 via API | Best open-source option |
| 6 | **Qwen 3** | Alibaba | Excellent (100+ langs) | Very good | ~1-2s | ~$0.4 input / $1.2 output | Cheapest for multilingual RAG |
| 7 | **Mistral Large** | Mistral AI | Good (FR/DE strong) | Good | ~1s | ~$3 input / $9 output | European vendor, GDPR-friendly |
| 8 | **DeepSeek V3** | DeepSeek | Good | Good | ~1-2s | ~$0.27 input / $1.1 output | Cheapest frontier model; data residency risk |
| 9 | **Grok 3** | xAI | Good | Moderate | ~1-2s | ~$3 input / $15 output | Good reasoning, newer ecosystem |
| 10 | **Gemma 3** | Google (open) | Good | Good | Fast (self-hosted) | Free self-hosted | Good if full self-hosting is needed |

### Recommendation: GPT-4o

**Why:** Best combination of multilingual quality, RAG reliability, ecosystem maturity (LangChain/LlamaIndex native support), and ease of integration with the rest of the team's stack. Strong EN/DE/FR/IT performance out of the box. Well-documented API that Marcos can call from the backend without friction.

**Runner-up:** Claude Sonnet 4.6 — marginally better for long-context document retrieval and careful, conservative answers (relevant for lab compliance contexts). Worth testing both and keeping the architecture model-agnostic.

**Embedding model:** `text-embedding-3-small` (OpenAI) — cheap, fast, strong multilingual performance.  
**Fallback embedding:** `multilingual-e5-large` (open source) if OpenAI access is restricted.

---

## 3. Architecture Overview

```
Scientist types question
        │
        ▼
┌─────────────────────┐
│   Language Detection │  → detect EN / DE / FR / IT
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Embedding Model     │  → convert query to vector
│  (text-embedding-3s) │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Vector Database    │  → top-k semantic search
│   (ChromaDB / local) │     over chunked SOPs
└────────┬────────────┘
         │ top 5 chunks + metadata
         ▼
┌─────────────────────┐
│   Prompt Builder     │  → inject chunks + system prompt
│                      │     (language + citation rules)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   LLM (GPT-4o)       │  → generate grounded answer
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Response Formatter │  → attach source doc name,
│                      │     version, date
└────────┬────────────┘
         │
         ▼
   Answer + [Source: SOP-023-EN, v2.1, 2026-04-10]
```

---

## 4. Document chunking strategy

Each SOP is split into chunks of ~500 tokens with 50-token overlap. Each chunk stores:

- `doc_id` — unique document identifier
- `title` — document title
- `version` — e.g. "v2.1"
- `date` — last updated date
- `language` — EN / DE / FR / IT
- `topic_tags` — e.g. ["onboarding", "access_request"]
- `chunk_index` — position within the document
- `text` — the chunk content

Version awareness works by always filtering to the **latest version** of each document at query time. When a newer version is ingested, the old chunks are marked stale (not deleted, for audit trail).

---

## 5. System prompt design

The system prompt enforces three rules on every response:

1. **Cite the source.** Every answer must end with: `[Source: <title>, <version>, <date>]`
2. **Respond in the user's language.** The detected language is injected into the prompt header.
3. **Stay grounded.** If the retrieved chunks don't contain enough information to answer, say so rather than guessing.

```
System prompt template:

You are a helpful assistant for Roche laboratory scientists.
Respond in {language}.
Use only the information in the context below to answer.
If the answer is not in the context, say: "I don't have that information — please contact [support link]."
Always end your answer with: [Source: {doc_title}, {doc_version}, {doc_date}]

Context:
{retrieved_chunks}

Question: {user_query}
```

---

## 6. Multilingual routing

Language detection runs before embedding using `langdetect` (Python library, lightweight, no API cost). The detected language code is:

1. Injected into the system prompt so the LLM responds in the same language
2. Used to **filter or boost** chunks in the same language (scientists should get answers from their language version of the SOP when available)
3. Logged with each query for Andy's analytics layer

Supported languages: EN, DE, FR, IT. Unknown languages default to EN.

---

## 7. API interface (for Marcos)

The pipeline exposes a single POST endpoint:

```
POST /api/rag/query

Request:
{
  "query": "How do I request access to the chemical storage system?",
  "user_language": "de",       // optional — auto-detected if omitted
  "user_role": "new_joiner"    // optional — for personalised context
}

Response:
{
  "answer": "Um Zugang zum...",
  "source": {
    "title": "Chemical Storage Access SOP",
    "version": "v1.3",
    "date": "2026-03-15",
    "doc_id": "SOP-007-DE"
  },
  "language_detected": "de",
  "confidence": 0.87
}
```

---

## 8. Tech stack

| Component | Tool | Reason |
|---|---|---|
| LLM | GPT-4o (OpenAI API) | Best multilingual RAG quality |
| Embeddings | text-embedding-3-small | Fast, cheap, multilingual |
| Vector DB | ChromaDB (local) | Zero infra, easy to run locally for demo |
| Chunking + orchestration | LangChain | Standard RAG framework, well-documented |
| Language detection | langdetect | Lightweight, no API dependency |
| API server | FastAPI (Python) | Simple, fast, async-ready |
| Data format | Markdown SOPs | Easy to chunk, readable, version-controllable |

---

## 9. File structure

```
pablo/
├── docs/
│   └── architecture.md         ← this file
├── data/
│   └── synthetic_sops/         ← SOP documents (from David)
├── src/
│   ├── ingest.py               ← chunk + embed + store SOPs
│   ├── query.py                ← RAG query pipeline
│   ├── detect_language.py      ← language detection utility
│   ├── prompt_builder.py       ← system prompt construction
│   └── api.py                  ← FastAPI endpoint
├── tests/
│   └── test_retrieval.py       ← test queries against synthetic SOPs
├── .env.example                ← OPENAI_API_KEY placeholder
└── requirements.txt
```

---

## 10. Key decisions and assumptions

- **ChromaDB for demo, Pinecone for production.** ChromaDB runs locally with no infrastructure. For a real Roche deployment, Pinecone or Weaviate would be used for scale and persistence.
- **Model-agnostic by design.** The LLM call is wrapped in a single function. Swapping GPT-4o for Claude or Gemini requires changing one config value.
- **Synthetic SOPs until Selva sends real ones.** David is generating 15-20 synthetic SOPs. This pipeline ingests whatever documents are placed in `data/synthetic_sops/`.
- **No fine-tuning.** RAG with a strong system prompt is sufficient for this use case and much faster to iterate on than fine-tuning.
- **Confidence scoring.** The cosine similarity of the top retrieved chunk is returned as `confidence`. If below 0.6, the answer is prefixed with a low-confidence warning.
