# Deploying the demo (for expert testers)

Goal: one HTTPS link your testers open. They use **every feature with no keys of
their own** — your keys live server-side in the backend. This uses two free
Render services (a Python API + a static React site) defined in
[`render.yaml`](render.yaml), plus a free GitHub Actions keep-alive so there's
nothing to babysit.

> No application code is modified for the deploy. ServiceNow behaves exactly as
> it does locally — you enter the same env values in the Render dashboard.

---

## One-time setup (~10 minutes)

### 1. Create the services from the Blueprint
1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
3. Connect this repository. Render reads `render.yaml` and proposes **two**
   services: `roche-scientist-assistant-api` (backend) and
   `roche-scientist-assistant` (frontend).
4. Click **Apply**. Render starts building both.

### 2. Add your keys to the **backend** service
On the API service → **Environment**, set (these are `sync: false`, so Render
prompts you):

| Variable | Value |
|---|---|
| `GOOGLE_API_KEY` | your Gemini key (required — powers chat + triage) |
| `MOCK_MODE` | the same value as your local `.env` |
| `SERVICENOW_INSTANCE_URL` | same as local |
| `SERVICENOW_USERNAME` | same as local |
| `SERVICENOW_PASSWORD` | same as local |

Save → the backend redeploys. On first boot it builds the SOP index from
`data/sops/` (takes a couple of minutes; watch the logs for "ingestion").

### 3. Point the frontend at the backend (only if the URL differs)
Open the **API** service page and copy its real URL (e.g.
`https://roche-scientist-assistant-api.onrender.com`). If it differs from the
value in `render.yaml`, set `VITE_API_URL` on the **static site** service to that
URL (no trailing `/api`) and **Manual Deploy → Clear build cache & deploy**.

### 4. Share the link
Give testers the **static site** URL (e.g.
`https://roche-scientist-assistant.onrender.com`). That's it — they get chat,
voice, triage, tickets, everything, with no setup.

---

## Keep-alive (no babysitting)

[`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) pings the
backend's `/health` every ~14 minutes so it never goes cold.

- It runs automatically once the workflow file is on the default branch.
- If you renamed the API service, update the URL inside that file.
- When the demo period is over, **disable** the workflow (repo → **Actions** →
  the workflow → **Disable workflow**) so it stops keeping the service awake.

> A free Render web service includes **750 instance-hours/month** — enough for
> one always-on service. Keeping a second service always-on would exceed that,
> so only the backend is pinged; the static frontend is already always-on (CDN).

---

## Notes & gotchas

- **First request after idle** (if the keep-alive is off) takes ~30–50s while
  the backend boots — normal for the free tier.
- **Shared quota:** every tester uses your Gemini free-tier quota.
  `gemini-flash-lite-latest` has a generous daily limit, but don't post the link
  publicly.
- **Voice & read-aloud** need HTTPS + Chrome/Edge. Render provides HTTPS, so they
  work on the deployed site.
- **Google Drive** is **not** needed for the deploy: the SOPs are committed in
  `data/sops/` and indexed on startup. (Drive is only used by the optional
  `--sync` ingest.)
- **ServiceNow dev instances hibernate.** If you keep it live and tickets fail,
  log in to your instance once to wake it. (This is a ServiceNow behavior, not
  the app.)
