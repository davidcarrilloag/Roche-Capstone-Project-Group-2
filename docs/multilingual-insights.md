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

## 2. The gap we found — and closed: the UI chrome ✅

The original finding was that the **answers** changed language but much of the
**interface** did not, so a German user got perfect German answers inside a
mostly-English shell. That read as "not properly translated" even though the hard
part was solid. **This has now been fixed.**

We added a central string table — `frontend/src/i18n.js` — exposing
`t(language, key)` with full EN / DE / FR / IT translations, and wired the
language prop through every v2 panel.

**Localised today (EN/DE/FR/IT):**
- Chat welcome subtitle + suggested shortcuts
- "Create support ticket", "Book equipment", the booking lead line,
  "Ask a colleague"
- Language-switch dividers, small-talk replies, and the RAG system messages
  (not configured / rate-limited / not found / low-confidence)
- **Sidebar navigation** — New chat, Documents, Team schedule, People, IT Support,
  Inbox, Settings, Switch perspective, and the topbar title
- **The v2 panels** — Team schedule, People directory + profiles, IT Support /
  IT Console (both the scientist and IT views), Inbox, the announcements bar, and
  the Choose-a-perspective landing. Dates in the schedule already localise via
  `toLocaleDateString` with per-language locales.

So a German user now gets German **answers** inside a German **interface**.

**Still English only (small backlog):** a few modal forms — the booking form,
Ask-a-colleague modal, incident form, and the announcements composer — plus the
Settings panel body. These are secondary surfaces; the primary navigation and
panels are fully translated.

---

## 3. Conclusions (for the report)

1. **Both layers are now multilingual.** The hard capability — grounded answers in
   the user's language — is verified at **100%** across EN/DE/FR/IT. The UI chrome
   gap we identified has been closed by externalising strings into a per-language
   table and translating the navigation and panels.
2. **Why the answer design is sound.** Cross-lingual retrieval avoids maintaining
   four copies of every SOP (size, drift, sync). One corpus, any language, on the
   fly.
3. **Honest scope.** A handful of modal forms (booking, ask-a-colleague, incident,
   announcement composer) and the Settings body remain English-only — mechanical
   work with no model risk, following the same `t(language, key)` pattern.

---

## 4. Recommendation

To reach 100% parity, apply the existing `t(language, key)` helper to the four
remaining modal forms and the Settings panel. It's mechanical work with no model
risk.

> Bottom line: **answers = 100% multilingual (verified); interface = navigation
> and all primary panels translated**, with only a few modal forms left.
