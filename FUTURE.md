# Future improvements

Backlog of ideas beyond the current MVP/v2, including items from the Roche team
feedback that we deliberately deferred.

## From Roche team feedback

| Item | Decision | Notes |
|---|---|---|
| **Google Calendar** — schedule equipment **and lab rooms/facilities** | ✅ Done (v2) | Equipment + rooms are bookable and create real Calendar events. |
| **Google Sites** | ⏳ Deferred | Scientists consult many scattered sources. Likely intent: let the assistant **read content from internal Google Sites** as an extra knowledge source (alongside SOPs), or **embed** the assistant inside a Google Site. Needs clarification before scoping. |
| **Google Chat** | ❌ Not for MVP | Roche agrees: integration is hard and **access/privacy of chat history** is a concern. Parked. |
| **Verification & robust performance** | 🟡 Partial | Add an automated **evaluation set** (golden Q&A) so quality is measurable and regressions are caught. |
| **Equal performance across languages** | 🟡 Partial | Cross-lingual retrieval is in place (EN/DE/FR/IT). Add a **multilingual benchmark** to prove parity. |
| **Quality despite typos** | 🟡 Partial | Semantic retrieval already tolerates typos. Add a **typo test set** to demonstrate/measure it. |

## Technical enhancements

- **Workspace resource calendars for rooms.** Today rooms are booked like
  resources onto one shared "Lab Equipment" calendar. If Roche manages rooms as
  Google Workspace **resource calendars** (one calendar per room), map each room
  id to its resource calendar and book/check availability against it directly.
- **Read existing Calendar availability** before offering a slot (free/busy), so
  bookings respect events created outside the app.
- **Add the colleague as an attendee** on meetings + email invites (requires
  Workspace domain-wide delegation).
- **Persistent cloud database.** Render's free tier wipes SQLite on redeploy;
  point `DATABASE_URL` at a free hosted Postgres (Neon/Supabase) for durability.
- **Real authentication** to replace the synthetic identity picker.
- **Automated test suite** (backend routes + RAG eval) in CI.
