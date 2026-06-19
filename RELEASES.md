# Releases & branching

We separate **what's live** (what reviewers/experts test) from **what we're
building**, so day-to-day work never disrupts the running demo.

## Branches

| Branch | Role | Deploys to |
|---|---|---|
| `production` | The **released, live demo**. Only updated on a deliberate release. Always stable. | Render (the URL we share) |
| `main` | **Integration / next version.** All feature work merges here. May be unstable. | nothing auto (optional staging) |
| `feature/*` | One feature each, branched off `main`. | — |

> Render is configured to auto-deploy the **`production`** branch. Pushing to
> `main` does **not** change the live demo.

## Versions (git tags)

| Tag | What |
|---|---|
| `v1.0.0` | MVP demo: RAG + citations, voice input + read-aloud, settings, multilingual (EN/DE/FR/IT), ServiceNow tickets, Render deploy. |
| `v2.0.0` | _(in progress on `main`)_ Hands-free voice conversation ("call") mode, + next features. |

## Day-to-day

```bash
# start a feature
git checkout main && git pull
git checkout -b feature/my-thing
# ...work, commit...
git push -u origin feature/my-thing      # open a PR into main
```

Merging to `main` is safe — it does not touch the live demo.

## Releasing a new version (e.g. v2)

When `main` is ready to become the live demo:

```bash
git checkout production && git pull
git merge --no-ff main -m "release: v2.0.0"
git tag -a v2.0.0 -m "v2.0.0 — voice conversation, ..."
git push origin production --follow-tags
```

Render auto-deploys `production` → the live demo updates **on purpose**, as one
clean version. To roll back, deploy an earlier tag from the Render dashboard.

## Render setup (one-time)

Both services (`roche-scientist-assistant-api` and `roche-scientist-assistant`)
→ **Settings → Build & Deploy → Branch → `production`**. After that, only
releases to `production` reach the live URL.
