# Feedback Data Contract (Analytics)

Owner: Andrea (Analytics & Feedback)

This closes the TODO in `FeedbackButton.jsx`: downvote **reasons** and **comments**
are now persisted instead of being console-logged.

## POST /feedback — accepted payload shapes

| Shape | Payload | Stored as |
|---|---|---|
| Thumbs up | `{message_id, rating: 1}` | sentiment `satisfied`, rating 5 |
| Thumbs down | `{message_id, rating: -1}` | sentiment `negative`, rating 1 |
| Downvote follow-up | `{message_id, reason?, comment?}` (no rating) | sentiment `negative`, rating `null` (excluded from averages — the -1 was already counted) |
| Explicit (dashboard/chat) | `{session_id, message, sentiment?, rating?}` | as given; sentiment auto-detected if omitted |

### New optional fields on `FeedbackRequest`

- `reason: string` — one of the reason chips: `"Wrong information"`,
  `"Source not relevant"`, `"Answer too vague"`, `"Wrong language"`.
- `comment: string` — free text typed by the scientist.
- `language: string` — ISO code (en/de/fr/it). Auto-detected from the text
  when omitted.
- `topic: string` — the SOP the rated answer was based on (taken from the
  message's `source.title`), enabling per-topic analytics.

Every stored entry now also keeps `reason`, `comment`, `message_id`,
`language` and `topic` (`null` when absent), so the analytics dashboard and
the weekly FAQ tracker can aggregate downvote reasons per SOP topic.

## Frontend change needed (FeedbackButton.jsx — Claudia)

`api.js` and the thumbs call already send `topic`; the two pending
`console.log` replacements should use the same signature
`submitFeedback(messageId, rating, comment, reason, topic)`:

```js
async function submitReason(reason) {
  try {
    await submitFeedback(messageId, null, null, reason, topic);
  } catch (e) {
    console.error("Feedback error:", e);
  }
  setShowPanel(false);
  setCommentText("");
  triggerThanks();
}

async function submitComment() {
  const comment = commentText.trim();
  if (!comment) return;
  try {
    await submitFeedback(messageId, null, comment, null, topic);
  } catch (e) {
    console.error("Feedback error:", e);
  }
  setShowPanel(false);
  setCommentText("");
  triggerThanks();
}
```

## Backward compatibility

All new fields are optional. Existing payloads (thumbs, explicit) behave
exactly as before; old JSONL entries without the new keys still load fine.
