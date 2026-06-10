# Local Setup — for each team member

Run the assistant on your own machine. **You can't break anything shared** — the
parts that are unique to your machine (`.env`, `chroma_db/`, secrets) are all
gitignored and stay local.

> **Why do I have to do this?** `.env` (API keys) and `chroma_db/` (the vector
> index the chatbot searches) are **not** stored in GitHub — secrets and
> generated data never go to the repo. So everyone sets them up locally. It's a
> one-time thing.

---

## What you need first

Ask **David** for these shared secrets (sent privately, not in git):

| Secret | What it's for | Required? |
|--------|---------------|-----------|
| `GOOGLE_API_KEY` (Gemini) | Document Q&A (the RAG) | **Yes** |
| `service_account.json` | Google Drive document sync | Optional |
| `SERVICENOW_*` (user/password) | Creating IT incidents | Optional |

---

## 1. Backend (one terminal)

```powershell
cd scientist-assistant\backend
python -m venv .venv
.venv\Scripts\Activate.ps1            # Windows PowerShell
pip install -r ..\requirements.txt
```

## 2. Configure your secrets

```powershell
copy ..\.env.example ..\.env
```

Open `scientist-assistant\.env` and paste the values David gave you. At minimum:

```
GOOGLE_API_KEY=AIza... (or AQ....)   # the one David shares
```

(Optional, only if you want Drive sync / real tickets: fill the `SERVICENOW_*`
and `GOOGLE_DRIVE_*` lines, and put `service_account.json` in `backend\secrets\`.)

## 3. Start the backend — it builds the index by itself

```powershell
uvicorn main:app --port 8000
```

- **The first start takes ~2-3 minutes** — it reads the SOPs in `data/sops/` and
  embeds them into a local `chroma_db/` (you'll see *"running initial
  ingestion..."*). This is normal, not a freeze. After that, startup is instant.
- ✅ `chroma_db/` is just a local cache. Rebuilding or deleting it is harmless.

> Want to rebuild the index manually at any time? `python -m services.ingest`
> (100% safe — it only writes your local `chroma_db/`.)

## 4. Frontend (a second terminal)

```powershell
cd scientist-assistant\frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

---

## If something looks wrong

| Symptom | Fix |
|---------|-----|
| Answer says *"Document Q&A is not available… missing Google API key"* | `GOOGLE_API_KEY` isn't set in `.env`. Add it and restart the backend. |
| *"knowledge base is empty"* / `chroma_db` doesn't exist | Start the backend **with a valid `GOOGLE_API_KEY`** — it ingests on startup. Or run `python -m services.ingest`. |
| Backend seems stuck right after starting | That's the one-time ingestion (embedding ~150 chunks). Give it 2-3 minutes. |
| Creating an incident fails | The ServiceNow dev instance may be asleep — log into `dev389826.service-now.com` once to wake it. |

**Remember:** `.env`, `chroma_db/`, and `backend/secrets/` are all local and
gitignored. Nothing you do on your machine touches the shared repo or your
teammates. Experiment freely.
