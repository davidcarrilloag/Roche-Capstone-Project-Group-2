import { useState } from "react";
import { api } from "../api.js";

// A small thumbs up/down control that submits explicit feedback for a session.
export default function FeedbackButton({ sessionId, contextMessage = "" }) {
  const [sent, setSent] = useState(null); // "up" | "down" | null
  const [busy, setBusy] = useState(false);

  async function send(kind) {
    if (busy) return;
    setBusy(true);
    try {
      await api.feedback(
        sessionId,
        contextMessage || `User rated the last answer: ${kind}`,
        kind === "up" ? "satisfied" : "negative",
        kind === "up" ? 5 : 2
      );
      setSent(kind);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <span className="text-xs text-gray-500">
        Thanks for your feedback {sent === "up" ? "👍" : "👎"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Was this helpful?</span>
      <button
        onClick={() => send("up")}
        disabled={busy}
        className="text-sm hover:scale-110 transition disabled:opacity-50"
        aria-label="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => send("down")}
        disabled={busy}
        className="text-sm hover:scale-110 transition disabled:opacity-50"
        aria-label="Not helpful"
      >
        👎
      </button>
    </div>
  );
}
