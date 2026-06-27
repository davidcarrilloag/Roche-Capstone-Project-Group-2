# Test report & insights — backend NLP services

Verification of the three lightweight NLP services that route and tag every
message: the **intent classifier** (question vs feedback), the **sentiment**
detector, and the **incident triage** (category + severity). Includes a
heuristic-vs-Gemini experiment for triage.

---

## 1. Methodology

- **Unit suite:** `backend/tests/` (pytest). Forces the deterministic path
  (intent & sentiment are keyword heuristics; triage is run with Gemini disabled,
  `has_google = False`). No keys, no network, **~0.4 s**.
- **Experiment:** `backend/eval/triage_uplift.py` runs the 20 triage cases twice
  — once with the heuristic, once with **Gemini** (`GOOGLE_API_KEY` set) — and
  compares category / severity / exact-match accuracy.
- **Run:**
  ```bash
  cd backend
  pip install pytest          # one-time (dev only)
  python -m pytest tests/ -v  # the unit suite
  python -m eval.triage_uplift  # the heuristic-vs-Gemini experiment
  ```

---

## 2. Results — unit suite

| Suite | What it checks | Passed | Accuracy |
|---|---|---|---|
| `test_classifier.py` | question vs feedback routing | 16 / 20 | **80%** |
| `test_sentiment.py` | tone (satisfied/frustrated/confused/negative…) | 14 / 20 | **70%** |
| `test_triage.py` | incident category + severity | 16 / 20 | **80%** |
| **Total** | | **46 / 60** | **≈ 77%** |

Each suite is split into **clear cases** (the heuristic handles them) and
**edge cases** (deliberately hard — they document the limits). The 14 "failures"
are the edge cases: **expected and commented**, not regressions.

---

## 3. Edge-case analysis (the 14 "failures")

The failures cluster into clear, explainable patterns — they pinpoint exactly
where keyword logic falls short.

### 3.1 Phrasing variants not in the keyword list
- `"I couldn't find any documentation"` → **question** (expected feedback); the
  list has `"can't find"` but not `"couldn't find"`.
- `"The process makes no sense to me"` → **question**; `"makes no sense"` ≠ the
  listed `"doesn't make sense"`.

### 3.2 No keyword at all → falls back to a default
- `"Nothing is working anymore"`, `"Broken again after the update"` → default to
  **question** instead of feedback.
- `"My samples are all ruined"`, `"The lab is inaccessible for everyone"` →
  **neutral** instead of negative.
- `"I need this fixed immediately"` → **neutral** instead of frustrated (urgency
  without an explicit emotion word).

### 3.3 Keyword traps (the literal word points the wrong way)
- `"Another error, great."` → **satisfied** (the word *great*) — actually
  **sarcasm / negative**.
- `"Everything is broken, thanks a lot"` → **satisfied** (the word *thanks*) —
  actually **negative**.

### 3.4 Keyword collisions between categories (triage)
- `"…permission for the network shared drive"` → **network** (matched first)
  instead of **access**.
- `"Instrument not connecting to the PC"` → **network** (the word *connect*)
  instead of **hardware**.
- `"Outlook won't launch"` → **inquiry** (no software keyword) instead of
  **software**.

### 3.5 Severity needs context, not keywords (triage)
- `"Temperature alarm in cold room, samples at risk"` → **low** instead of
  **critical** — the heuristic can't infer the safety/biological risk.

---

## 4. Experiment — heuristic vs Gemini for triage

Same 20 cases, two engines. **Clean run** (4.5 s between calls to avoid the
free-tier rate limit):

| Engine | Category | Severity | Exact match (both) |
|---|---|---|---|
| **Heuristic** (no LLM) | 17/20 (85%) | **19/20 (95%)** | **16/20 (80%)** |
| **Gemini** | **18/20 (90%)** | 9/20 (45%) | 8/20 (40%) |

Two opposite movements — and they are the whole story:

**Gemini is BETTER at category.** It resolves the keyword collisions that defeat
the heuristic: "shared folder *access*" (not network), "instrument *connection*"
→ hardware, "email client" → software. **And on the one safety-critical case
it correctly escalated to `critical`** ("cold storage, samples at risk"), where
the heuristic said `low`.

**Gemini "loses" on severity — but read carefully.** It systematically rates
incidents **one level higher** than the test expects:

| Case | Test expects | Gemini says |
|---|---|---|
| Password reset | low | medium |
| ELN crashes on startup | low | medium |
| Badge reader broken | low | **high** |
| Software license expired | low | **high** |
| WiFi drops | low | medium |

This is **not Gemini being wrong** — the test's expected severities were
**calibrated to the heuristic's own convention** (the author set "low" because
that's the reasonable/heuristic answer). So the heuristic scores 95% on severity
**by construction**: the test partly measures *"agreement with our own rules,"*
not absolute truth. Gemini applies independent, more **cautious** judgment (a
locked-out badge or expired license as medium/high is defensible).

> **Operational caveat (also a finding):** the first run hit the free-tier rate
> limit (**15 requests/minute** → HTTP 429), and those calls silently fell back
> to the heuristic. Gemini also adds **seconds of latency per call**. The
> heuristic is instant, free and deterministic.

---

## 5. Conclusions (for the report)

1. **The suite quantifies the heuristics' accuracy and limits.** Pure keyword
   logic already gets **~77%** of routing/tagging right; the failing ~23% are
   exactly the nuanced cases (sarcasm, implicit frustration, phrasing variants,
   category collisions, contextual severity).

2. **"LLM > heuristic" is too simple — it depends on the sub-task.**
   - **Category:** Gemini wins (90% vs 85%) — it disambiguates real-world
     phrasing the keywords confuse, and catches safety-critical escalation.
   - **Severity:** the heuristic + the fixed ITIL mapping is **deterministic and
     consistent**, which is exactly what a system that computes ServiceNow
     **Priority = Impact × Urgency** needs. Gemini's severity is more cautious
     but less predictable, and it disagreed with the heuristic-calibrated labels.

3. **Determinism is a feature here.** For triage feeding a ticketing system,
   predictable, explainable, free, instant classification matters. That is *why*
   the design uses the heuristic as a reliable fallback and keeps the
   severity→priority mapping fixed.

4. **Best of both worlds (design implication):** use the LLM for **category +
   risk detection** (where it clearly helps) and a **deterministic severity
   policy** (where consistency matters) — which is close to what the app already
   does (Gemini primary, heuristic fallback, fixed priority matrix).

5. **Validated graceful degradation.** With no AI at all (offline / rate-limited),
   the assistant still classifies the majority correctly and never crashes. The
   system *degrades*, it doesn't *break*.

6. **Honest measurement matters.** The most useful result wasn't a number, it was
   noticing that the "ground truth" encoded the heuristic's own convention — so a
   naive "accuracy" comparison would have been misleading.

---

## 6. Limitations & caveats

- The triage test labels are **heuristic-calibrated**, so they favour the
  heuristic on severity. An LLM-vs-LLM or human-labelled set would be fairer.
- Free-tier **rate limits (15/min)** and latency make per-message LLM triage
  costly at scale; the heuristic is the pragmatic default.
- Intent and sentiment have **no LLM path** today, so their edge failures are a
  backlog item, not a regression.
- Small samples (20 per suite) — directional, not statistically rigorous.

---

## 7. Recommendations

- **Mark the edge cases `@pytest.mark.xfail`** so CI is green while still
  recording the known gaps.
- **Add `pytest` to a `requirements-dev.txt`** so any teammate can run the suite.
- **For triage:** keep the deterministic severity mapping; consider using Gemini
  only to (a) pick the category and (b) flag safety-critical risk → escalate.
- **Grow coverage** (multilingual variants, more scenarios, human-labelled
  severity) to strengthen the verification story Roche asked for.

---

## 8. How to run

```bash
cd backend
pip install pytest
python -m pytest tests/ -v      # unit suite (46/60 by design)
python -m eval.triage_uplift    # heuristic vs Gemini (needs GOOGLE_API_KEY)
```

> Latest figures in this doc: unit suite **46/60 (~77%)**; triage experiment
> heuristic **80%** vs Gemini **40%** exact-match, but Gemini **90%** vs **85%**
> on category — see §4–5 for why both numbers are true and what they mean.
