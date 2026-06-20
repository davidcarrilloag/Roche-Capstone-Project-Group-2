import { useEffect, useState } from "react";
import { membersDirectory, listAnnouncements, createAnnouncement, retireAnnouncement } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import AskColleagueModal from "./AskColleagueModal.jsx";
import { Headset, MessageSquare, CalendarPlus, Megaphone, Wrench, AlertTriangle, Info, Plus, X, Ticket } from "lucide-react";

const COLORS = ["#7C3AED", "#0891B2", "#DB2777", "#EA580C"];
function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
}
function Avatar({ name, i }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, backgroundColor: COLORS[i % COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>
      {initials(name)}
    </div>
  );
}
function Tags({ expertise }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(expertise || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
        <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, backgroundColor: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent-tint-border)" }}>{t}</span>
      ))}
    </div>
  );
}

const CAT = {
  info: { icon: Info, color: "#0066CC" },
  maintenance: { icon: Wrench, color: "#CA8A04" },
  incident: { icon: AlertTriangle, color: "#DC2626" },
};

function Composer({ author, onClose, onPosted }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("info");
  const [busy, setBusy] = useState(false);
  async function post() {
    if (!title.trim()) return;
    setBusy(true);
    try { await createAnnouncement({ title: title.trim(), body: body.trim(), category, author }); onPosted(); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="incident-surface bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Megaphone size={17} /> Post an update</h2>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100" aria-label="Close">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
              <option value="info">Info / Tip</option>
              <option value="maintenance">Maintenance</option>
              <option value="incident">Known issue</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Headline</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ELN maintenance tonight 22:00" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Details (optional)</label>
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none" />
          </div>
          <button onClick={post} disabled={busy || !title.trim()} className="w-full min-h-[44px] bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50">
            {busy ? "Posting…" : "Post to all scientists"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ITSupport() {
  const me = getIdentity();
  const [team, setTeam] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isIT, setIsIT] = useState(false);
  const [composing, setComposing] = useState(false);
  const [ask, setAsk] = useState(null); // { member, mode }

  function loadAnn() {
    listAnnouncements().then((a) => setAnnouncements(a || [])).catch(() => {});
  }
  useEffect(() => {
    membersDirectory()
      .then((list) => {
        const it = (list || []).filter((x) => (x.team || "").startsWith("IT"));
        setTeam(it);
        const m = (list || []).find((x) => x.name === me);
        setIsIT(!!(m && (m.team || "").startsWith("IT")));
      })
      .catch(() => {});
    loadAnn();
  }, [me]);

  async function retire(id) {
    await retireAnnouncement(id);
    loadAnn();
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }} className="chat-scroll">
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 40px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Headset size={20} strokeWidth={1.75} color="var(--accent)" /> IT Support
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 24px" }}>
          Reach the IT team without a formal ticket — ask a quick question, book office hours, or check their updates.
        </p>

        {/* Announcements */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Megaphone size={16} color="var(--accent)" /> Updates from IT
          </h2>
          {isIT && (
            <button onClick={() => setComposing(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent-tint)", color: "var(--accent)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={14} /> Post update
            </button>
          )}
        </div>
        {announcements.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 28 }}>No updates right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {announcements.map((a) => {
              const c = CAT[a.category] || CAT.info;
              const Icon = c.icon;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                  <Icon size={17} color={c.color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
                    {a.body && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{a.body}</div>}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>📣 {a.author || "IT"}</div>
                  </div>
                  {isIT && <button onClick={() => retire(a.id)} title="Retire" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}><X size={15} /></button>}
                </div>
              );
            })}
          </div>
        )}

        {/* IT team */}
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>The IT team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12, marginBottom: 24 }}>
          {team.map((m, i) => (
            <div key={m.id} style={{ border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, backgroundColor: "var(--bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={m.name} i={i} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.role}</div>
                </div>
              </div>
              <Tags expertise={m.expertise} />
              {m.name !== me && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setAsk({ member: m.name, mode: "ask" })} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    <MessageSquare size={14} /> Ask
                  </button>
                  <button onClick={() => setAsk({ member: m.name, mode: "meet" })} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    <CalendarPlus size={14} /> Office hours
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formal route */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px dashed var(--border-color)", color: "var(--text-secondary)", fontSize: 12.5 }}>
          <Ticket size={16} color="var(--text-muted)" />
          Need a formal request? Describe the issue in the chat and create a ServiceNow ticket — best for things that need tracking.
        </div>

        {composing && <Composer author={me} onClose={() => setComposing(false)} onPosted={() => { setComposing(false); loadAnn(); }} />}
        {ask && <AskColleagueModal lockedMember={ask.member} initialMode={ask.mode} onClose={() => setAsk(null)} />}
      </div>
    </div>
  );
}
