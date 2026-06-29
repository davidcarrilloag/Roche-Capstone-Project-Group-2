# Roche Scientist Assistant 🔬🤖

An AI-powered assistant that gives Roche scientists **one place** to:

1. **Ask questions** answered from internal documents (SOPs, onboarding guides,
   lab procedures) — every answer **cites the source document** (title · version · date).
2. **Create IT incidents** in ServiceNow, with **AI triage** that sets the
   category, urgency/impact and routes the ticket to the right assignment group.
3. **Book equipment and rooms** in natural language — with conflict detection and
   real **Google Calendar** events, on a shared team schedule.
4. **Reach colleagues and IT** — ask the right expert when the docs fall short
   (with an inbox), browse a **people directory**, and use a dedicated **IT
   space** (office hours + announcements) without filing a formal ticket.
5. **Give feedback** to IT teams, with **automatic sentiment detection** and a
   simple analytics view.
6. Work in their **preferred language** — English, German, French or Italian —
   both the answers *and* the interface.
7. **Ask by voice** (browser speech-to-text, hands-free conversation mode) and
   tune their experience in a built-in **Settings** panel.

> **Grounded by design:** the assistant **never fabricates** Roche-specific
> procedures. If the answer isn't in the indexed documents, it says so clearly.

> **More than a chatbot — a two-sided community.** The project shipped in two
> iterations: **MVP 1**, a grounded, source-cited assistant, evolved into **MVP 2**,
> a laboratory-community platform with two perspectives (**scientist** and **IT**),
> equipment/room booking, a people directory, expert routing, and a
> **self-improving knowledge base** where colleague answers feed back into the RAG.

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Testing](#testing)
- [Demo scenarios](#demo-scenarios)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Team & ownership](#team--ownership)

---

## What it does

| Capability | Detail |
|---|---|
| **Document Q&A (RAG)** | Retrieval-augmented generation over a SOP knowledge base. Answers are grounded in retrieved chunks and **cite** the document they came from. Low-confidence answers are flagged. |
| **Conversation memory** | Follow-up questions ("*what about returning them?*") are rewritten into standalone queries using the prior turns, so multi-turn chats work. |
| **Multilingual** | Answers are generated directly in EN/DE/FR/IT via cross-lingual retrieval — no need to translate the whole corpus. The **UI chrome is localized** too (nav, panels, perspectives). |
| **AI incident triage** | A problem description is classified into category + severity, mapped to ServiceNow's impact/urgency (ITIL matrix → Priority P1–P4) and routed to an assignment group. |
| **ServiceNow tickets** | Real Table-API incidents (or a mock when no credentials), with caller resolution and complete description. |
| **Equipment & room booking** | Natural-language booking opens a pre-filled form, **detects scheduling conflicts**, and creates a real **Google Calendar** event. A shared **team schedule** shows all reservations. |
| **Ask a colleague** | When the docs don't cover a question, it routes to the **best-matching expert** by expertise, with an **inbox** to reply and track the exchange. |
| **Self-improving knowledge base** | A colleague's answer is **indexed back into the RAG** and offered to the next person who asks something similar, cited as **"Community knowledge."** |
| **People directory + IT space** | Scientist profiles (role, team, expertise, contributions); a dedicated **IT Support** space with office hours and **broadcast announcements**; an **activity feed**. |
| **Two perspectives** | The same platform is experienced as a **scientist** (ask, book, escalate) or as **IT** (answer queue, post updates, see demand) — chosen at a perspective landing. |
| **Feedback + sentiment** | User feedback is auto-detected, sentiment-scored, and stored for analytics. |
| **Voice input** | Browser Web Speech API: dictate a question in the selected language, with live transcription, read-aloud, and a hands-free conversation mode. |
| **Settings panel** | Theme (light/dark/system), default language, voice preferences, ticket identity, and clear-data — persisted in the browser. |

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │        Frontend (React)       │
                         │  Chat · Documents · Settings   │
                         │  voice · i18n · light/dark     │
                         └───────────────┬───────────────┘
                                         │  REST (JSON, /api proxy)
                                         ▼
                ┌────────────────────────────────────────────────┐
                │                Backend (FastAPI)                │
                │  /chat  /feedback  /incidents  /title  /health  │
                └──┬──────────┬───────────┬────────────┬─────────┘
                   │          │           │            │
          ┌────────▼───┐ ┌────▼─────┐ ┌───▼──────┐ ┌───▼─────────┐
          │  Intent    │ │ Triage   │ │ ServiceNow│ │ Sentiment / │
          │ Classifier │ │ (Gemini  │ │  Client   │ │ Translator/ │
          │ (heuristic)│ │ +heur.)  │ │(mock/REST)│ │ Title*      │
          └─────┬──────┘ └──────────┘ └───────────┘ └─────────────┘
                │ question
                ▼
       ┌────────────────────────────────────────────────┐
       │       RAG  (in-process · services/rag.py)        │
       │  Gemini embeddings → ChromaDB → Gemini LLM       │
       │  grounded, multilingual answer + cited source    │
       └───────────────────────┬──────────────────────────┘
                               │ ingests Markdown SOPs (services/ingest.py)
                               ▼
                  ┌────────────────────────┐        ┌──────────────┐
                  │  data/sops/  *.md       │ ◄─sync─│ Google Drive │
                  │  doc_id·version·date fm │ bridge │  (live docs) │
                  └────────────────────────┘        └──────────────┘

  * Sentiment / Title / Intent are lightweight **keyword heuristics** (no LLM,
    deterministic and offline). Translation is unnecessary because the RAG
    answers directly in the user's language.
```

> **The brain is Gemini.** Document Q&A (embeddings + answers) **and** incident
> triage run on **Google Gemini** via Google AI Studio. ChromaDB is the local
> vector store. A free `GOOGLE_API_KEY` is the only key you need for the full
> experience. The smaller NLP helpers (intent, sentiment, chat titles) use fast
> keyword heuristics — no extra keys, no network.

---

## Tech stack

| Layer | Tech |
|---|---|
| **Backend** | Python 3.11, FastAPI, Uvicorn, Pydantic |
| **RAG / LLM** | Google Gemini (`gemini-flash-lite-latest`) + Gemini embeddings (`models/gemini-embedding-001`), LangChain 0.3.x, ChromaDB (in-process) |
| **Persistence** | SQLModel over SQLite — lab members, bookings, colleague requests, announcements survive restarts |
| **Integrations** | ServiceNow Table API (httpx), Google Drive API v3 (read-only service account), Google Calendar API (service account) |
| **Frontend** | React 18, Vite, Tailwind CSS, lucide-react, react-markdown |
| **Voice** | Browser Web Speech API (no key, Chrome/Edge) |
| **Testing** | pytest — 112 automated tests (deterministic, key-free), plus model-backed evals |
| **Deploy** | Docker, Render (zero-setup demo link), UptimeRobot keep-alive |

---

## Repository layout

```
scientist-assistant/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, routers, startup ingest, /admin/reindex
│   ├── config.py               # Settings loaded from .env (single source of truth)
│   ├── db.py                   # SQLModel/SQLite: LabMember, Booking, ColleagueRequest,
│   │                           #   Announcement, AppMeta + synthetic demo-world seeding
│   ├── routes/
│   │   ├── chat.py             # /chat (Q&A or feedback, auto-routed), /title
│   │   ├── feedback.py         # /feedback, /feedback/analytics
│   │   ├── incidents.py        # /incidents, /incidents/triage
│   │   ├── bookings.py         # /equipment, /bookings (conflict-checked)
│   │   ├── members.py          # /members, /members/directory, /it/questions, profiles
│   │   ├── experts.py          # /experts/suggest, /colleague-requests, /meetings
│   │   ├── announcements.py    # /announcements (IT broadcasts)
│   │   └── activity.py         # /activity (unified recent-activity feed)
│   ├── services/
│   │   ├── rag.py              # in-process RAG: retrieve → ground → answer + cite
│   │   ├── ingest.py           # load SOPs → chunk → embed → ChromaDB (+ community answers)
│   │   ├── gdrive.py           # Google Drive → data/sops sync bridge
│   │   ├── calendar.py         # Google Calendar events for bookings/meetings
│   │   ├── booking.py          # equipment/room catalog + overlap detection
│   │   ├── experts.py          # match a question to the best-fit colleague
│   │   ├── triage.py           # incident category/severity (Gemini + heuristic)
│   │   ├── servicenow.py       # incident creation, priority, assignment-group routing
│   │   ├── classifier.py       # question-vs-feedback intent (keyword heuristic)
│   │   ├── sentiment.py        # feedback sentiment (keyword heuristic)
│   │   ├── translator.py       # language detection (langdetect)
│   │   ├── title.py            # chat title generation (heuristic)
│   │   └── feedback_store.py   # in-memory feedback + analytics
│   ├── tests/                  # pytest suite (112 tests, deterministic, key-free)
│   ├── eval/                   # model-backed evals (multilingual.py, triage_uplift.py)
│   └── models/schemas.py       # Pydantic request/response models
├── frontend/                   # React + Vite + Tailwind
│   └── src/
│       ├── pages/Chat.jsx      # app shell: sidebar, sessions, theme, settings, perspectives
│       ├── components/         # ChatWindow, MessageBubble, IncidentForm, BookingForm,
│       │                       #   TeamSchedule, TeamDirectory, ITSupport, ColleagueInbox,
│       │                       #   AnnouncementsBar, PerspectiveLanding, SettingsPanel, ...
│       ├── i18n.js             # central UI string table + t(lang, key) — EN/DE/FR/IT
│       └── api.js              # REST client
├── data/sops/                  # SOP knowledge base (Markdown + frontmatter) — indexed by RAG
├── docs/                       # architecture, test-insights, multilingual-insights, report, poster
├── requirements.txt            # backend Python dependencies (repo root)
├── .env.example                # copy to .env and fill in
├── docker-compose.yml
└── README.md
```

The **SOP knowledge base** in `data/sops/` holds 16 Markdown SOPs (covering all
Roche use cases, plus one German and one French native SOP for multilingual
testing). Each file starts with YAML frontmatter: `doc_id`, `title`, `version`,
`date`, `language`, `topic_tags`, `roche_use_cases`, `origin`.

---

## Run locally

### Prerequisites
- **Python 3.11+**
- **Node 18+** (the project is developed on Node 24)
- A free **Gemini API key** for document Q&A — <https://aistudio.google.com/apikey>
  *(the only key needed)*

### 1. Backend

```bash
cd scientist-assistant/backend

# create & activate a virtual environment (Python 3.11)
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r ../requirements.txt    # requirements.txt lives at the repo root

# configure environment
copy ..\.env.example ..\.env          # Windows  (cp on macOS/Linux)
# then edit ..\.env and set GOOGLE_API_KEY=...

# run the API
uvicorn main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for interactive Swagger, or
<http://localhost:8000/health>.

> **No keys at all?** The backend still boots. Sentiment/intent/title fall back
> to heuristics. Document Q&A needs a `GOOGLE_API_KEY` — without it, `/chat`
> returns a clear "not configured" message instead of crashing.

### 2. Build the SOP index (document Q&A)

The RAG runs **in-process**. With a Gemini key set, build the vector index from
`data/sops/`:

```bash
cd scientist-assistant/backend
python -m services.ingest            # ingest data/sops/ into ChromaDB
# or pull the latest docs from Google Drive first:
python -m services.ingest --sync
```

The backend also **auto-ingests on startup** if the index is empty. To rebuild
at runtime: `POST /admin/reindex` (add `?sync_drive=true` to pull from Drive).

### 3. Frontend

```bash
cd scientist-assistant/frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the
backend at `http://localhost:8000` (override with `VITE_API_BASE_URL`).

### 4. Everything via Docker (optional)

```bash
cd scientist-assistant
copy .env.example .env    # set GOOGLE_API_KEY
docker compose up --build
```

---

## Environment variables

Copy `.env.example` to `.env`. Only `GOOGLE_API_KEY` is needed for the full
chat/triage experience; everything else is optional and degrades gracefully.

| Variable | Needed for | Description |
|---|---|---|
| `GOOGLE_API_KEY` | **RAG + triage** | Free Gemini key (aistudio.google.com/apikey). Powers embeddings, answers and triage. |
| `GEMINI_MODEL` | no | Gemini chat model. Default `gemini-flash-lite-latest` (large free-tier quota). |
| `EMBEDDING_MODEL` | no | Gemini embedding model. Default `models/gemini-embedding-001`. |
| `CHROMA_DB_PATH` | no | Where the vector index persists. Default `<repo>/chroma_db`. |
| `SOPS_PATH` | no | SOP knowledge base folder. Default `<repo>/data/sops`. |
| `CONFIDENCE_THRESHOLD` | no | Below this retrieval score, answers are flagged low-confidence. Default `0.45`. |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive sync | Folder ID from the Drive URL — syncs SOPs into `data/sops`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive sync | Path to the read-only service-account JSON. |
| `GOOGLE_CALENDAR_ID` | booking events | Calendar ID for equipment/room bookings and meetings (same service account). |
| `CALENDAR_TIMEZONE` | no | Timezone for calendar events. Default `Europe/Madrid`. |
| `SERVICENOW_INSTANCE_URL` | live tickets | e.g. `https://devXXXXX.service-now.com`. |
| `SERVICENOW_USERNAME` | live tickets | ServiceNow user. |
| `SERVICENOW_PASSWORD` | live tickets | ServiceNow password. |
| `DATABASE_URL` | no | SQLModel/SQLite URL. Default `sqlite:///<repo>/data/app.db`. |
| `MOCK_MODE` | no | `true` → mock ServiceNow responses. Default `true`. |

> **Secrets:** `.env`, `backend/secrets/service_account.json`, `chroma_db/` and
> `drive_cache/` are gitignored. Never commit real keys.

---

## How it works

**RAG pipeline** (`services/rag.py` + `services/ingest.py`)
SOPs are chunked (500/50) and embedded with Gemini into ChromaDB (collection
`roche_sops`). On a question, the top chunks are retrieved, labelled `[DOC <id>]`,
and the LLM is instructed to answer **only** from them, emit `CITED=<id>` for the
document it used, or return a `NO_ANSWER` sentinel when the answer isn't present.
Confidence is averaged over the top-3 chunks; below `CONFIDENCE_THRESHOLD` the
answer carries a low-confidence warning. Follow-ups are rewritten into standalone
queries from the conversation history before retrieval.

**Incident triage** (`services/triage.py`)
Gemini (with a keyword-heuristic fallback) classifies a description into a
`category` and `severity`. Severity maps to ServiceNow `urgency`/`impact` so the
ITIL matrix yields Priority **P1–P4** (never P5). The category maps to an
**assignment group** (Software/Hardware/Network/Database/Service Desk).

**ServiceNow** (`services/servicenow.py`)
Creates a real incident via the Table API (or a mock when credentials/`MOCK_MODE`
say so). Resolves the caller by partial name/email match and falls back to the
API user when the reporter isn't a ServiceNow user, keeping the entered value in
the description.

**Booking & calendar** (`services/booking.py` + `services/calendar.py`)
A static catalog of equipment and rooms is bookable in natural language. The
service rejects **overlapping** reservations on the same resource (back-to-back
is allowed), persists the booking in SQLite, and — when Calendar is configured —
creates a real Google Calendar event. All reservations appear on a shared team
schedule.

**Collaboration & the self-improving knowledge base**
(`services/experts.py` + `routes/experts.py`)
When the docs fall short, `experts.suggest` scores each lab member's expertise
against the question and routes it to the best fit, with an inbox to answer.
**Answering a colleague request indexes the Q&A back into the RAG** (via
`ingest.add_community_answer`), so the next person who asks something similar
gets it instantly, cited as *Community knowledge*.

**Two perspectives**
A perspective landing lets you enter as a **scientist** or as **IT**. The IT view
turns the IT Support page into an **IT Console** (answer queue + announcements +
demand analytics). Identity and perspective are kept in `localStorage`.

**Multilingual & voice**
Answers are generated directly in the requested language via cross-lingual
retrieval, and the **UI is localized** through a central string table
(`frontend/src/i18n.js`, `t(lang, key)` for EN/DE/FR/IT). Voice input uses the
browser Web Speech API in the selected locale (en-US/de-DE/fr-FR/it-IT) with live
transcription and an optional hands-free conversation mode; preferences live in
the Settings panel and `localStorage`.

---

## API reference

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET  | `/health` | — | Liveness probe |
| POST | `/chat` | `ChatRequest` | Q&A or feedback (auto-routed), with history |
| POST | `/title` | `TitleRequest` | Generate a short chat title |
| POST | `/feedback` | `FeedbackRequest` | Submit explicit feedback |
| GET  | `/feedback/analytics` | — | Aggregated sentiment metrics |
| POST | `/incidents` | `IncidentRequest` | Create a ServiceNow incident (auto-triages if urgency/impact missing) |
| POST | `/incidents/triage` | `TriageRequest` | Classify category + severity without creating a ticket |
| GET  | `/equipment` | — | List bookable equipment and rooms |
| GET/POST | `/bookings` | `BookingRequest` | List or create a reservation (conflict-checked; creates a Calendar event) |
| GET  | `/members` · `/members/directory` | — | Lab roster; directory enriched with contribution stats |
| GET  | `/members/{id}/profile` | — | A member's profile + contributions + bookings |
| GET  | `/it/questions` | — | Questions scientists routed to the IT team |
| POST | `/experts/suggest` | `ExpertSuggestRequest` | Best-matching colleague(s) for a question |
| GET/POST | `/colleague-requests` | `ColleagueRequestCreate` | Route a question to a colleague; inbox listing |
| POST | `/colleague-requests/{id}/answer` | `ColleagueRequestAnswer` | Answer (indexed back into the RAG as community knowledge) |
| POST | `/meetings` | `MeetingRequest` | Schedule a meeting (Calendar event) |
| GET/POST | `/announcements` | `AnnouncementCreate` | IT broadcasts (maintenance, known issues, tips) |
| GET  | `/activity` | — | Unified recent-activity feed across the lab |
| POST | `/admin/reindex` | `?sync_drive=` | Rebuild the RAG index (optionally pull Drive first) |

Full request/response models are in `backend/models/schemas.py`; interactive
docs at `/docs`.

---

## Testing

Two layers, both runnable from `backend/`.

**Deterministic suite (no keys, ~10 s).** 112 automated tests that run in mock
mode against an isolated SQLite database — reproducible anywhere, CI-ready:

```bash
cd scientist-assistant/backend
pip install pytest
python -m pytest tests/ -v
```

| Suite | Verifies | Result |
|---|---|---|
| `test_api_integration.py` | HTTP status + contract of the main routes | 10/10 |
| `test_booking_conflict.py` | Booking overlap / adjacency logic | 6/6 |
| `test_priority_matrix.py` | ITIL severity → (impact, urgency) → P1–P4, never P5 | 14/14 |
| `test_experts.py` | Expert routing by specialty | 7/7 |
| `test_classifier.py` · `test_sentiment.py` · `test_triage.py` | Intent / sentiment / triage heuristics | 60/60 |
| `test_multilingual_heuristics.py` | DE/FR/IT reach of the English-keyword heuristics | 9 pass, **6 xfail** |

**Total: 106 pass + 6 documented `xfail`.** The 6 expected failures keep a real
limitation *visible*: the lightweight intent/sentiment heuristics are
English-first (German barely registers). The assistant's **answers**, by
contrast, are fully multilingual.

**Model-backed evals (need `GOOGLE_API_KEY`).**

```bash
python -m eval.multilingual      # 20/20 answers grounded AND in the requested language (EN/DE/FR/IT)
python -m eval.triage_uplift     # heuristic vs Gemini on 20 triage scenarios
```

See `docs/test-insights.md` and `docs/multilingual-insights.md` for the full
write-up (including the test-driven improvement from 46/60 → 60/60 on the NLP
suites).

---

## Demo scenarios

| # | Scenario | Try | What happens |
|---|---|---|---|
| 1 | **Onboarding Q&A** | *"How do I request access to the lab building?"* | RAG answers from `SOP-007-building-access.md`, cites it. |
| 2 | **Lab procedure Q&A** | *"How do I clean my HP device?"* | RAG answers from `SOP-005-hp-device-cleaning.md`. |
| 3 | **Follow-up** | *"...and how do I return leftover materials?"* | Query is rewritten from context → answers from `SOP-003-material-return.md`. |
| 4 | **Multilingual** | switch to **DE**, ask in German | Answer comes back in German from cross-lingual retrieval. |
| 5 | **Voice** | click 🎤 and speak | Live transcription fills the box and auto-sends. |
| 6 | **Incident + triage** | *"My virtual session keeps crashing"* → open the ticket form | Triage pre-fills category/priority; `POST /incidents` returns e.g. `INC0010013`, routed to a group. |
| 7 | **Feedback + sentiment** | *"This onboarding process is really confusing"* | Routed to feedback → sentiment logged → visible in analytics. |
| 8 | **Book equipment** | *"Book the confocal microscope tomorrow at 10"* | Pre-filled booking form, conflict check, Calendar event, shows on the team schedule. |
| 9 | **Ask a colleague** | a question the SOPs don't cover | Routed to the best-fit expert; their answer is indexed back as community knowledge. |
| 10 | **Switch perspective** | choose **Tom Becker (IT)** at the landing | The app becomes the **IT Console** — an answer queue, announcements, and demand analytics. |

---

## Deployment

The prototype is containerised and was deployed to **Render** as a **zero-setup
demo link** so external reviewers can try it with no install or keys (the demo
runs in mock mode; document Q&A needs a `GOOGLE_API_KEY` configured on the
service). `/health` accepts `GET` and `HEAD`, and an **UptimeRobot** monitor
pings it to keep the free instance warm.

```bash
cd scientist-assistant
copy .env.example .env    # set GOOGLE_API_KEY (and others as needed)
docker compose up --build
```

Versioning: `main` = active development (v2), `production` = the frozen demo.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/chat` returns "not configured" | No `GOOGLE_API_KEY`. Add a free Gemini key and re-ingest. |
| Answers are empty / "no documents" | Index not built. Run `python -m services.ingest`. |
| `429` / quota errors from Gemini | Free-tier limit. The default `gemini-flash-lite-latest` has a large quota; wait or switch models via `GEMINI_MODEL`. |
| Gemini model `404 / decommissioned` | Model name retired. Set `GEMINI_MODEL` / `EMBEDDING_MODEL` to current names. |
| Mic button missing | Web Speech API only in **Chrome/Edge** on a secure context (localhost is fine). Firefox is unsupported. |
| Ticket shows the API user as caller | The entered name isn't a ServiceNow user — the value is preserved in the description and the API user is used as a fallback. |

---

## Team & ownership

| Area | Files |
|---|---|
| **Backend coordination / API surface** | `main.py`, `routes/`, `models/schemas.py`, `db.py` |
| **AI / RAG** | `services/rag.py`, `services/ingest.py` |
| **Google Drive & Calendar** | `services/gdrive.py`, `services/calendar.py` |
| **ServiceNow & triage** | `services/servicenow.py`, `services/triage.py`, `routes/incidents.py` |
| **Operations & collaboration** | `services/booking.py`, `services/experts.py`, `routes/bookings.py`, `routes/members.py`, `routes/experts.py`, `routes/announcements.py`, `routes/activity.py` |
| **Frontend / UX** | `frontend/` (incl. `i18n.js`, MVP 2 panels) |
| **Sentiment & analytics** | `services/sentiment.py`, `services/translator.py`, `services/feedback_store.py` |
| **Testing** | `backend/tests/`, `backend/eval/` |

Services are loosely coupled and each **degrades gracefully** with mock/heuristic
fallbacks, so no one blocks anyone else.
