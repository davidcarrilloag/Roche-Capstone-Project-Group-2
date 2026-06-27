"""
Multilingual evaluation — does the assistant actually adapt to each language?

For a set of in-scope questions asked in EN / DE / FR / IT, this checks two
things per answer:
  1. grounded  — did it find the answer in the SOPs (cross-lingual retrieval)?
  2. lang_ok   — is the ANSWER actually written in the requested language?
                 (detected with langdetect and compared to the request)

The second check is the one that matters for "is it well adapted to each
language" — a German question that comes back answered in English is a fail.

Run:  cd backend && python -m eval.multilingual   (needs GOOGLE_API_KEY)
"""

from __future__ import annotations

import time

from langdetect import detect

from services.rag import get_rag_service

LANGS = ["en", "de", "fr", "it"]

# Same question in four languages.
QUESTIONS = [
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
    {
        "en": "How do I store samples in cold storage?",
        "de": "Wie lagere ich Proben in der Kühllagerung?",
        "fr": "Comment conserver des échantillons au froid ?",
        "it": "Come conservo i campioni nella conservazione a freddo?",
    },
    {
        "en": "How do I request building access?",
        "de": "Wie beantrage ich Zugang zum Gebäude?",
        "fr": "Comment demander l'accès au bâtiment ?",
        "it": "Come richiedo l'accesso all'edificio?",
    },
]


def main() -> None:
    rag = get_rag_service()
    by_lang = {l: {"grounded": 0, "lang_ok": 0, "n": 0} for l in LANGS}
    print(f"Multilingual eval — {len(QUESTIONS)} questions × {len(LANGS)} languages\n" + "=" * 70)

    for q in QUESTIONS:
        print(f"\nQ: {q['en']}")
        for lang in LANGS:
            res = rag.query(q[lang], language=lang)
            answer = res.get("answer", "") or ""
            grounded = res.get("grounded") is True
            try:
                detected = detect(answer)
            except Exception:
                detected = "?"
            lang_ok = detected == lang
            by_lang[lang]["n"] += 1
            by_lang[lang]["grounded"] += grounded
            by_lang[lang]["lang_ok"] += lang_ok
            flag = "OK " if (grounded and lang_ok) else "!! "
            print(f"  [{flag}] {lang}: grounded={int(grounded)} answer_lang={detected} "
                  f"{'(match)' if lang_ok else '(MISMATCH)'}")
            time.sleep(4.5)  # stay under the free-tier rate limit

    print("\n" + "=" * 70 + "\nSUMMARY (per language)")
    for lang in LANGS:
        s = by_lang[lang]
        n = s["n"]
        print(f"  {lang}: grounded {s['grounded']}/{n} ({100*s['grounded']/n:.0f}%) | "
              f"answered-in-language {s['lang_ok']}/{n} ({100*s['lang_ok']/n:.0f}%)")


if __name__ == "__main__":
    main()
