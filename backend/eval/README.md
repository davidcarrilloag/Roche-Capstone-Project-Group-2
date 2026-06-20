# Evaluation harness

Automated checks that address the Roche team's feedback on **verification,
robust performance, language parity, and typo tolerance**.

## What it measures

| Suite | What it verifies | Roche ask |
|---|---|---|
| **In-scope** | Known questions are answered from the SOPs (`grounded=True`, right source) | Verification / robust performance |
| **Out-of-scope** | Unknown questions are correctly declined (`grounded=False`, no hallucination) | Verification |
| **Language parity** | The same question works in EN/DE/FR/IT | Equal performance across languages |
| **Typo robustness** | Misspelled questions still find the answer | Quality despite user typos |

## Run it

```bash
# backend must be running
cd backend
python eval/run_eval.py
# or against the deployed API:
BASE_URL=https://roche-scientist-assistant-api.onrender.com python eval/run_eval.py
```

## Latest result (2026-06-21, local, gemini-flash-lite-latest)

```
in_scope   10/10  (100%)   # answered from the correct SOP
out_scope   3/3   (100%)   # correctly declined — no hallucination
parity      3/3   (100%)   # identical grounding across EN/DE/FR/IT
typos       5/5   (100%)   # robust to misspellings
OVERALL    21/21  (100%)
```

> The grounding signal (`grounded`) is the core metric: in-scope questions must
> be answered from the documents, and out-of-scope ones must be declined. Extend
> `IN_SCOPE`, `PARITY` and `TYPOS` in `run_eval.py` to grow coverage.
