# Test report & insights — backend NLP services

Unit tests for the three lightweight NLP services that route and tag every
message: the **intent classifier** (question vs feedback), the **sentiment**
detector, and the **incident triage** (category + severity).

> **Run:** `cd backend && python -m pytest tests/ -v` (needs `pip install pytest`).
> The suite is fully **offline and deterministic**: intent and sentiment use
> keyword heuristics directly, and triage is run with its Gemini path disabled
> (`has_google = False`), so no API keys, no network, and runs in **~0.4 s**.

---

## Results at a glance

| Suite | What it checks | Passed | Accuracy |
|---|---|---|---|
| `test_classifier.py` | question vs feedback routing | 16 / 20 | **80%** |
| `test_sentiment.py` | tone (satisfied/frustrated/confused/negative…) | 14 / 20 | **70%** |
| `test_triage.py` | incident category + severity | 16 / 20 | **80%** |
| **Total** | | **46 / 60** | **≈ 77%** |

Each suite is split into **clear cases** (the heuristic should and does handle)
and **edge cases** (deliberately hard — they document where the heuristic falls
short). The 14 "failures" are the edge cases: they are **expected and
commented**, not regressions.

---

## What the suites cover

- **Intent classifier (20):** 10 clear questions (question words, "?", "tell me",
  "I need information…"), 6 clear feedback ("this is confusing/terrible/too
  slow…"), and 4 edge cases.
- **Sentiment (20):** 14 clear cases across satisfied / frustrated / confused /
  negative, and 6 edge cases.
- **Triage (20):** 16 clear IT incidents mapped to category (hardware / software /
  network / access / inquiry) and severity (low → critical), and 4 edge cases.

---

## Edge cases — why the heuristic misses them

The failures cluster into a few clear, explainable patterns. This is the most
useful part for the report: it pinpoints **exactly where language understanding
needs more than keywords**.

### 1. Phrasing variants the keyword list doesn't cover
- `"I couldn't find any documentation"` → tagged **question** (expected feedback);
  the list has `"can't find"` but not `"couldn't find"`.
- `"The process makes no sense to me"` → **question** (expected feedback);
  `"makes no sense"` ≠ the listed `"doesn't make sense"`.

### 2. No keyword at all → falls back to a default
- `"Nothing is working anymore"`, `"Broken again after the update"` → default to
  **question** instead of feedback.
- `"My samples are all ruined"`, `"The lab is inaccessible for everyone"` →
  **neutral** instead of negative (no sentiment keyword present).
- `"I need this fixed immediately"` → **neutral** instead of frustrated (urgency
  without an explicit emotion word).

### 3. Keyword traps (the literal keyword points the wrong way)
- `"Another error, great."` → **satisfied** (the word *great*) — actually
  **sarcasm / negative**.
- `"Everything is broken, thanks a lot"` → **satisfied** (the word *thanks*) —
  actually **negative**.

### 4. Keyword collisions between categories (triage)
- `"I don't have permission for the network shared drive"` → **network** (matched
  first) instead of **access**.
- `"Instrument not connecting to the PC"` → **network** (the word *connect*)
  instead of **hardware**.
- `"Outlook won't launch"` → **inquiry** (no software keyword) instead of
  **software**.

### 5. Severity needs context, not keywords (triage)
- `"Temperature alarm in cold room, samples at risk"` → **low** instead of
  **critical** — the heuristic can't infer the safety/biological risk.

---

## Key insights (for the report)

1. **The tests quantify the heuristics' accuracy and limits.** With pure keyword
   logic (no AI), the helpers already get **~77%** of routing/tagging right. The
   remaining ~23% are exactly the nuanced cases — **sarcasm, implicit
   frustration, phrasing variants, category collisions, and contextual
   severity** — which keyword matching cannot capture. For **triage**, the Gemini
   model is the primary path and these heuristics are only the fallback, so the
   edge cases show precisely what Gemini buys you. For **intent and sentiment**
   (heuristic-only by design), they mark clear candidates for an LLM upgrade.

2. **Validated graceful degradation.** Even with no AI at all (triage offline /
   rate-limited, or the lightweight helpers), the assistant still classifies the
   majority of messages correctly and never crashes. The system *degrades*, it
   doesn't *break* — a deliberate design choice, now backed by numbers.

3. **The edge cases are living documentation.** Each one is commented with the
   actual heuristic output vs the ideal, so the test file doubles as a precise
   spec of the heuristic's known limits — useful for onboarding and for deciding
   what the LLM must cover.

4. **Fast, deterministic, CI-ready.** No keys, no network, ~0.4 s. This is the
   kind of test that can gate every push without flakiness or cost.

5. **A natural next experiment.** Re-running the same 60 cases **with** the LLM
   enabled would measure the uplift (heuristic 77% → LLM X%), turning "the LLM
   helps" into a quantified before/after — a strong slide for the report.

---

## Recommendations

- **Keep the edge cases visible** as documentation, or mark them `@pytest.mark.xfail`
  (expected failure) so the suite shows green in CI while still recording the gap.
- **Add `pytest` to a `requirements-dev.txt`** so any teammate can run the suite
  (`pip install -r requirements-dev.txt`).
- **Measure the LLM uplift for triage**: run the triage cases with Gemini
  enabled (`has_google = True`) and report heuristic-vs-Gemini accuracy side by
  side. (Intent and sentiment are heuristic-only today.)
- **Grow coverage** over time (multilingual variants, more triage scenarios) to
  strengthen the "verification" story Roche asked for.

---

## How to run

```bash
cd backend
pip install pytest          # one-time (dev only)
python -m pytest tests/ -v  # verbose, per-case
python -m pytest tests/ -q  # summary
```
