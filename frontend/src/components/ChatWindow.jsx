import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import MessageBubble from "./MessageBubble.jsx";
import FeedbackButton from "./FeedbackButton.jsx";
import IncidentForm from "./IncidentForm.jsx";

// Generate (and persist) a session id so the conversation survives page
// reloads and device switches in the lab.
function getSessionId() {
  let id = localStorage.getItem("sa_session_id");
  if (!id) {
    id = "sess-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("sa_session_id", id);
  }
  return id;
}

const WELCOME = {
  role: "assistant",
  text:
    "Hi! I'm your Roche Scientist Assistant. Ask me about onboarding, lab " +
    "procedures, or sample management. I can also raise an IT incident for you.",
};

export default function ChatWindow() {
  const [sessionId] = useState(getSessionId);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await api.chat(text, sessionId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: res.answer,
          source_doc: res.source_doc,
          source_page: res.source_page,
          confidence: res.confidence,
          is_feedback: res.is_feedback,
          sentiment: res.sentiment,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `⚠️ ${err.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Heuristic to offer the incident button when the user mentions a problem.
  function maybeOfferIncident(text) {
    const t = text.toLowerCase();
    return (
      t.includes("crash") ||
      t.includes("not working") ||
      t.includes("broken") ||
      t.includes("error") ||
      t.includes("can't log") ||
      t.includes("cannot log")
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const offerIncident = lastUser && maybeOfferIncident(lastUser.text);

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {busy && (
          <div className="text-sm text-gray-400 px-2">Assistant is typing…</div>
        )}

        {offerIncident && !busy && (
          <div className="my-2 flex items-center gap-3">
            <button
              onClick={() => {
                setIncidentTitle(lastUser.text);
                setShowIncident(true);
              }}
              className="px-3 py-1.5 text-sm rounded-md border border-roche text-roche hover:bg-roche-light"
            >
              🛠️ Raise an IT incident about this
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Footer: feedback + input */}
      <div className="border-t border-gray-200 bg-white p-3">
        <div className="flex justify-end mb-2 px-1">
          <FeedbackButton sessionId={sessionId} />
        </div>
        <form onSubmit={send} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question, give feedback, or describe a problem…"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-roche"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-roche hover:bg-roche-dark text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {showIncident && (
        <IncidentForm
          sessionId={sessionId}
          initialTitle={incidentTitle}
          onClose={() => setShowIncident(false)}
        />
      )}
    </div>
  );
}
