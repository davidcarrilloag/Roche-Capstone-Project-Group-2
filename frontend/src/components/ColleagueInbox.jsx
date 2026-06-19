import { useEffect, useState } from "react";
import { listColleagueRequests, answerColleagueRequest } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import { Inbox, Send, Clock, CheckCircle2, RotateCcw } from "lucide-react";

function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function AnswerBox({ req, onAnswered }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await answerColleagueRequest(req.id, text.trim());
      onAnswered();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Type your reply…"
        style={{
          flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
          color: "var(--text-primary)", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", outline: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0 14px", borderRadius: 8,
          border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit", opacity: busy || !text.trim() ? 0.5 : 1,
        }}
      >
        <Send size={14} /> Reply
      </button>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, padding: "14px 16px", backgroundColor: "var(--bg-card)" }}>
      {children}
    </div>
  );
}

export default function ColleagueInbox() {
  const me = getIdentity();
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!me) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      listColleagueRequests({ member: me }),
      listColleagueRequests({ from_user: me }),
    ])
      .then(([inc, snt]) => {
        setIncoming(inc || []);
        setSent(snt || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  return (
    <div style={{ height: "100%", overflowY: "auto" }} className="chat-scroll">
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Inbox size={20} strokeWidth={1.75} color="var(--accent)" />
            Inbox
          </h1>
          <button
            onClick={load}
            title="Refresh"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, fontFamily: "inherit" }}
          >
            <RotateCcw size={13} strokeWidth={1.75} /> Refresh
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 22px" }}>
          You are <strong>{me || "— select an identity"}</strong>. Questions colleagues routed to you, and the ones you sent.
        </p>

        {loading && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}

        {/* Incoming */}
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
          Questions for you {incoming.length > 0 && <span style={{ color: "var(--accent)" }}>({incoming.filter((r) => r.status === "open").length} open)</span>}
        </h2>
        {!loading && incoming.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>Nothing yet.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {incoming.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{r.from_user || "Someone"}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(r.created_at)}</span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-primary)", margin: "6px 0 0", lineHeight: 1.5 }}>{r.question}</p>
              {r.status === "answered" ? (
                <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                  <CheckCircle2 size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span><strong>You replied:</strong> {r.answer}</span>
                </div>
              ) : (
                <AnswerBox req={r} onAnswered={load} />
              )}
            </Card>
          ))}
        </div>

        {/* Sent */}
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>Your questions</h2>
        {!loading && sent.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>You haven't asked anyone yet.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sent.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>To {r.to_member}</span>
                <span style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, color: r.status === "answered" ? "#16A34A" : "var(--text-muted)" }}>
                  {r.status === "answered" ? <CheckCircle2 size={12} /> : <Clock size={12} />} {r.status}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-primary)", margin: "6px 0 0", lineHeight: 1.5 }}>{r.question}</p>
              {r.status === "answered" && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, backgroundColor: "var(--accent-tint)", fontSize: 13, color: "var(--text-primary)" }}>
                  <strong>{r.to_member}:</strong> {r.answer}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
