# Multilingual evaluation & insights

Does the assistant actually adapt to each language (EN / DE / FR / IT)? We
measured it instead of guessing — and the result splits cleanly into two layers.

> **Run:** `cd backend && python -m eval.multilingual` (needs `GOOGLE_API_KEY`).
> Asks 5 in-scope questions in each language and checks two things per answer:
> **grounded** (did it find the SOP?) and **answered-in-language** (is the answer
> text actually in the requested language, detected with `langdetect`?).

---

## 1. The answers: fully multilingual ✅

5 questions × 4 languages = **20 answers**. Every one was grounded in the SOPs
**and** written in the requested language:

| Language | Grounded | Answered in the right language |
|---|---|---|
| English | 5/5 (100%) | 5/5 (100%) |
| German | 5/5 (100%) | 5/5 (100%) |
| French | 5/5 (100%) | 5/5 (100%) |
| Italian | 5/5 (100%) | 5/5 (100%) |

**Conclusion:** the core language capability works. Ask in German → grounded
German answer; French → French; Italian → Italian. This is **cross-lingual
retrieval**: the SOPs stay in their original language, the multilingual Gemini
embeddings match a foreign-language question to the right English passage, and
Gemini writes the answer **in the user's language**. No 4× translated corpus,
no drift — and verified at **100%**.

---

## 2. The gap: the UI chrome is only partly localised ⚠️

This is almost certainly what feels "not well adapted": the **answers** change
language, but much of the **interface** does not.

**Localised today (EN/DE/FR/IT):**
- Chat welcome subtitle + suggested shortcuts
- "Create support ticket", "Book equipment", the booking lead line,
  "Ask a colleague"
- Language-switch dividers, small-talk replies, and the RAG system messages
  (not configured / rate-limited / not found / low-confidence)

**Still English only:**
- Sidebar navigation — *New chat, Documents, Team schedule, People, IT Support,
  Inbox, Settings, Switch perspective*
- The v2 panels themselves — **Team schedule, People directory, IT Console,
  Inbox, Settings**, the **booking form**, **Ask-a-colleague modal**,
  **incident form**, **announcements composer**, the **activity feed**, and the
  **Choose-a-perspective** landing

So a German user gets perfect German **answers** inside an interface whose
buttons and panels are mostly **English** — which reads as "not properly
translated" even though the hard part (the AI answering in-language) is solid.

---

## 3. Conclusions (for the report)

1. **The intelligence is multilingual; the chrome is the backlog.** The valuable,
   hard capability — grounded answers in the user's language — is verified at
   **100%** across EN/DE/FR/IT. The remaining work is **UI string localisation**,
   which is straightforward (translate labels), not a model problem.
2. **Why this design is sound.** Cross-lingual retrieval avoids maintaining four
   copies of every SOP (size, drift, sync). One corpus, any language, on the fly.
3. **Honest scope.** The newer v2 features (bookings, people, IT, inbox, settings,
   perspectives) were built English-first; their strings haven't been translated
   yet.

---

## 4. Recommendation

To reach full parity, **externalise the UI strings** into the existing per-language
maps (the app already uses `UI_TEXT[language]` for the chat) and translate the
sidebar + the v2 panels. It's mechanical work with no model risk. Priority order:
sidebar navigation → booking/ask-colleague modals → the panels.

> Bottom line: **answers = 100% multilingual (verified); interface = partially
> translated.** The gap the user noticed is UI text, not the assistant's language
> ability.
