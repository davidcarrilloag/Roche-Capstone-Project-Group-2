# Roche Scientist Assistant 🔬🤖

An AI-powered assistant that gives Roche scientists **one place** to:

1. **Ask questions** answered from internal documents (SOPs, onboarding guides,
   cleaning procedures) — every answer **cites its source document**.
2. **Get routed** to the right internal Roche application.
3. **Create IT incidents** directly via ServiceNow.
4. **Give feedback** to IT teams, with **automatic sentiment detection** and a
   simple analytics dashboard.
5. Communicate in their **preferred language** (English, German, French,
   Italian).

> Accuracy matters: the assistant **never fabricates** Roche-specific procedures.
> If the answer isn't in the documents, it says so clearly.

---

## Architecture

```
                       ┌─────────────────────────────┐
                       │        Frontend (React)      │
                       │  Chat  •  Incident  •  Dash   │
                       └───────────────┬──────────────┘
                                       │  REST (JSON)
                                       ▼
              ┌─────────────────────────────────────────────┐
              │            Backend (FastAPI, async)          │
              │  /chat   /feedback   /incidents   /health    │
              └───┬───────────┬────────────┬─────────┬───────┘
                  │           │            │         │
        ┌─────────▼──┐  ┌─────▼─────┐ ┌────▼─────┐ ┌─▼──────────┐
        │ Intent     │  │ Sentiment │ │ Translator│ │ ServiceNow │
        │ Classifier │  │ (Groq)    │ │ (Groq +   │ │ Client     │
        │ (Groq)     │  │           │ │ langdetect)│ │ (mock/REST)│
        └─────┬──────┘  └───────────┘ └───────────┘ └────────────┘
              │ question
              ▼
     ┌──────────────────────────────────────────────┐
     │                 RAG Service                    │
     │  HuggingFace embeddings (all-MiniLM-L6-v2)     │
     │  → Chroma vector store (./chroma_db)           │
     │  → ChatGroq (Llama 3.1) grounded answer        │
     └───────────────────┬────────────────────────────┘
                         │ loads .md / .pdf
                         ▼
              ┌────────────────────────┐
              │  data/mock_docs/       │  ← (later: Google Drive)
              │  • onboarding_guide    │
              │  • equipment_cleaning  │
              │  • sample_management   │
              └────────────────────────┘
```

---

## Repository layout

```
scientist-assistant/
├── backend/
│   ├── main.py              # FastAPI entry point + CORS + routers
│   ├── config.py            # Settings loaded from .env
│   ├── routes/              # chat, feedback, incidents endpoints
│   ├── services/            # rag, gdrive, servicenow, sentiment,
│   │                        #   translator, classifier, feedback_store
│   ├── models/schemas.py    # Pydantic request/response models
│   └── data/mock_docs/      # local doc cache (real docs live at repo-root data/)
├── frontend/                # React + Vite + Tailwind
│   └── src/{components,pages}
├── data/mock_docs/          # SHARED mock SOPs / onboarding docs (indexed by RAG)
├── requirements.txt         # backend Python dependencies (repo root)
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## Run locally

### Prerequisites
- Python 3.11+
- Node 18+ (for the frontend)
- A free Groq API key (optional for a first smoke test — see below)

### 1. Backend

```bash
cd scientist-assistant/backend

# create & activate a virtual environment
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r ../requirements.txt   # requirements.txt lives at the repo root

# configure environment
cp ../.env.example ../.env        # then edit ../.env and add GROQ_API_KEY

# run the API
uvicorn main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for the interactive Swagger UI, or hit
<http://localhost:8000/health>.

> **No Groq key yet?** The backend still boots and the endpoints respond:
> services fall back to lightweight heuristics so the frontend team is
> unblocked. Add the key to enable real LLM answers, translation, and
> sentiment.

### 2. Frontend

```bash
cd scientist-assistant/frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The dev server proxies API calls to
`http://localhost:8000` (configurable via `VITE_API_BASE_URL`).

### 3. Everything via Docker (optional)

```bash
cd scientist-assistant
cp .env.example .env   # add your GROQ_API_KEY
docker compose up --build
```

---

## Get a free Groq API key

1. Go to <https://console.groq.com>.
2. Sign up (no credit card required).
3. Open **API Keys → Create API Key**.
4. Copy the key into your `.env` as `GROQ_API_KEY=...`.

> **Model note:** Groq occasionally retires model names. This project defaults
> to `llama-3.1-70b-versatile`. If you get a "model decommissioned" error,
> set `GROQ_MODEL` in your `.env` to a current Groq model (check the Groq
> console for the active list, e.g. a newer Llama 3.3 70B versatile model).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | for LLM | Free key from console.groq.com. Enables RAG answers, translation, sentiment & intent classification. |
| `GROQ_MODEL` | no | LLM model name. Default `llama-3.1-70b-versatile`. |
| `EMBEDDING_MODEL` | no | Sentence-transformers model. Default `all-MiniLM-L6-v2` (CPU, no key). |
| `CHROMA_DB_PATH` | no | Where Chroma persists vectors. Default `./chroma_db`. |
| `MOCK_DOCS_PATH` | no | Folder of source docs to index. Default `<repo>/data/mock_docs`. |
| `GOOGLE_DRIVE_FOLDER_ID` | for Drive | Folder ID from the Drive URL (Google Drive integration). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | for Drive | Path to the service-account JSON file. |
| `SERVICENOW_INSTANCE_URL` | for live tickets | e.g. `https://devXXXXX.service-now.com`. |
| `SERVICENOW_USERNAME` | for live tickets | ServiceNow user. |
| `SERVICENOW_PASSWORD` | for live tickets | ServiceNow password. |
| `MOCK_MODE` | no | `true` → mock ServiceNow + local docs. Default `true`. |
| `RETRIEVAL_THRESHOLD` | no | Min similarity before RAG answers; else "not found". Default `0.35`. |

---

## Demo scenarios

| # | Scenario | Try asking | What happens |
|---|----------|-----------|--------------|
| 1 | **Onboarding Q&A** | *"How do I request access to the sample management system?"* | RAG answers from `onboarding_guide.md`, cites the doc. |
| 2 | **Lab procedure Q&A** | *"How do I clean my HP centrifuge?"* | RAG answers from `equipment_cleaning_sop.md` (70% isopropanol, don't spray the screen). |
| 3 | **Incident creation** | *"My virtual session keeps crashing"* → fill the incident form | `POST /incidents` returns a ticket like `INC0012345`. |
| 4 | **Feedback + sentiment** | *"This onboarding process is really confusing"* | Classified as feedback → sentiment `confused` → logged → visible on the Dashboard. |

---

## API quick reference

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/health` | — | Liveness probe |
| POST | `/chat` | `ChatRequest` | Q&A or feedback (auto-routed) |
| POST | `/feedback` | `FeedbackRequest` | Submit explicit feedback |
| GET | `/feedback/analytics` | — | Aggregated metrics for the dashboard |
| POST | `/incidents` | `IncidentRequest` | Create a ServiceNow incident |

---

## Team & ownership

| Role | Area | Files |
|------|------|-------|
| **PM + backend coordination** | API surface | `main.py`, `routes/`, `models/schemas.py` |
| **AI / RAG** | Retrieval pipeline | `services/rag.py` |
| **Google Drive integration** | Document source | `services/gdrive.py` |
| **ServiceNow API** | Ticketing | `services/servicenow.py` |
| **Frontend / UX** | UI | `frontend/` |
| **Sentiment & analytics** | Feedback + mock docs | `services/sentiment.py`, `services/translator.py`, `services/feedback_store.py`, `data/mock_docs/` |

Services are loosely coupled and each degrades gracefully with mock/heuristic
fallbacks, so no one blocks anyone else.
