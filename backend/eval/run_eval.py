"""
Evaluation harness — verification, language parity and typo robustness.

Runs a golden set of questions against the live /chat endpoint and checks:
  1. In-scope questions are answered from the SOPs   (grounded == True)
  2. Out-of-scope questions are correctly declined    (grounded == False)
  3. The same question works equally across EN/DE/FR/IT (language parity)
  4. Questions with typos still find the answer        (typo robustness)

This directly addresses the Roche feedback: "chatbot verification and robust
performance", "equal performance across languages", "quality despite typos".

Usage (backend must be running):
    python -m eval.run_eval                 # hits http://localhost:8000
    BASE_URL=https://...onrender.com python -m eval.run_eval
"""

from __future__ import annotations

import os
import time

import httpx

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# --- In-scope: expect grounded=True. Optional `source` keyword (lenient). ---
IN_SCOPE = [
    ("How do I dispose of chemical waste?", "waste"),
    ("How do I order lab consumables?", None),  # procurement docs vary; grounding is the metric
    ("How do I return leftover materials?", None),
    ("How do I clean my HP device?", "hp"),
    ("How do I request building access?", "access"),
    ("What trainings do I need as a new employee?", None),
    ("How do I store samples in cold storage?", "cold"),
    ("What should I do about a calibration drift?", "calibrat"),
    ("How do I report missing materials?", None),
    ("How do I share lab equipment with another team?", None),
]

# --- Out-of-scope: expect grounded=False (the assistant should decline). ---
OUT_OF_SCOPE = [
    "What is the wifi password for the cafeteria?",
    "What time does the company gym open?",
    "Who won the football match last night?",
]

# --- Language parity: same question in 4 languages, all expect grounded=True. ---
PARITY = [
    {
        "en": "How do I dispose of chemical waste?",
        "de": "Wie entsorge ich Chemikalienabfälle?",
        "fr": "Comment éliminer les déchets chimiques ?",
        "it": "Come smaltisco i rifiuti chimici?",
    },
    {
        "en": "How do I order lab consumables?",
        "de": "Wie bestelle ich Laborverbrauchsmaterial?",
        "fr": "Comment commander des consommables de laboratoire ?",
        "it": "Come ordino i materiali di consumo da laboratorio?",
    },
    {
        "en": "What trainings do I need as a new employee?",
        "de": "Welche Schulungen brauche ich als neuer Mitarbeiter?",
        "fr": "De quelles formations ai-je besoin comme nouvel employé ?",
        "it": "Di quali formazioni ho bisogno come nuovo dipendente?",
    },
]

# --- Typo robustness: misspelled in-scope questions, expect grounded=True. ---
TYPOS = [
    "How do I dispoze of chemcial waist?",
    "How do I oder lab consumabls?",
    "How do I clean my HP devise?",
    "How do I reqest buidling acces?",
    "How do I stor samples in cold storge?",
]


def ask(question: str, language: str = "en") -> dict:
    r = httpx.post(
        f"{BASE_URL}/chat",
        json={"message": question, "language": language},
        timeout=120.0,
    )
    r.raise_for_status()
    return r.json()


def _ok(b: bool) -> str:
    return "PASS" if b else "FAIL"


def main() -> None:
    print(f"Evaluating {BASE_URL}\n" + "=" * 64)
    results = {"in_scope": [], "out_scope": [], "parity": [], "typos": []}

    print("\n[1] In-scope — should be answered from the SOPs (grounded=True)")
    for q, kw in IN_SCOPE:
        d = ask(q)
        grounded = d.get("grounded") is True
        src = (d.get("source_doc") or "").lower()
        src_ok = (kw is None) or (kw in src)
        passed = grounded and src_ok
        results["in_scope"].append(passed)
        print(f"  [{_ok(passed)}] grounded={grounded} src={d.get('source_doc','')!r:40} | {q}")
        time.sleep(0.3)

    print("\n[2] Out-of-scope — should be declined (grounded=False)")
    for q in OUT_OF_SCOPE:
        d = ask(q)
        passed = d.get("grounded") is False
        results["out_scope"].append(passed)
        print(f"  [{_ok(passed)}] grounded={d.get('grounded')} | {q}")
        time.sleep(0.3)

    print("\n[3] Language parity — same question, EN/DE/FR/IT (all grounded=True)")
    for group in PARITY:
        flags = {}
        for lang, q in group.items():
            d = ask(q, language=lang)
            flags[lang] = d.get("grounded") is True
            time.sleep(0.3)
        passed = all(flags.values())
        results["parity"].append(passed)
        print(f"  [{_ok(passed)}] " + " ".join(f"{l}={int(v)}" for l, v in flags.items()) + f" | {group['en']}")

    print("\n[4] Typo robustness — misspelled questions still find the answer")
    for q in TYPOS:
        d = ask(q)
        passed = d.get("grounded") is True
        results["typos"].append(passed)
        print(f"  [{_ok(passed)}] grounded={d.get('grounded')} | {q}")
        time.sleep(0.3)

    print("\n" + "=" * 64 + "\nSUMMARY")
    total_p = total_n = 0
    for name, arr in results.items():
        p, n = sum(arr), len(arr)
        total_p += p
        total_n += n
        pct = (100 * p / n) if n else 0
        print(f"  {name:10} {p}/{n}  ({pct:.0f}%)")
    pct = (100 * total_p / total_n) if total_n else 0
    print(f"  {'OVERALL':10} {total_p}/{total_n}  ({pct:.0f}%)")


if __name__ == "__main__":
    main()
