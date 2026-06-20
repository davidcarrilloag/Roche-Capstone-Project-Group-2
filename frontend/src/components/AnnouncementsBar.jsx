import { useEffect, useState } from "react";
import { listAnnouncements, createAnnouncement, membersDirectory } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import { Megaphone, Wrench, AlertTriangle, Info, X, Plus } from "lucide-react";

const CAT = {
  info: { icon: Info, color: "#0066CC", bg: "var(--accent-tint)", border: "var(--accent-tint-border)" },
  maintenance: { icon: Wrench, color: "#CA8A04", bg: "rgba(202,138,4,0.12)", border: "rgba(202,138,4,0.35)" },
  incident: { icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.35)" },
};

function dismissedIds() {
  try { return JSON.parse(localStorage.getItem("dismissedAnnouncements") || "[]"); } catch { return []; }
}
function dismiss(id) {
  try {
    const arr = dismissedIds();
    if (!arr.includes(id)) localStorage.setItem("dismissedAnnouncements", JSON.stringify([...arr, id]));
  } catch (e) {}
}

function Composer({ author, onClose, onPosted }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("info");
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), category, author });
      onPosted();
    } finally {
      setBusy(false);
    }
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

export default function AnnouncementsBar() {
  const [items, setItems] = useState([]);
  const [isIT, setIsIT] = useState(false);
  const [composing, setComposing] = useState(false);
  const [, force] = useState(0);
  const me = getIdentity();

  function load() {
    listAnnouncements().then((a) => setItems(a || [])).catch(() => {});
  }
  useEffect(() => {
    load();
    membersDirectory()
      .then((list) => {
        const m = (list || []).find((x) => x.name === me);
        setIsIT(!!(m && (m.team || "").startsWith("IT")));
      })
      .catch(() => {});
  }, [me]);

  const visible = items.filter((a) => !dismissedIds().includes(a.id));
  if (visible.length === 0 && !isIT) return null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 20px 0" }}>
      {visible.map((a) => {
        const c = CAT[a.category] || CAT.info;
        const Icon = c.icon;
        return (
          <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 8, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
            <Icon size={17} color={c.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
              {a.body && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{a.body}</div>}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>📣 {a.author || "IT"}</div>
            </div>
            <button onClick={() => { dismiss(a.id); force((n) => n + 1); }} title="Dismiss" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
              <X size={15} />
            </button>
          </div>
        );
      })}

      {isIT && (
        <button
          onClick={() => setComposing(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, border: "1px dashed var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}
        >
          <Plus size={13} /> Post an update to scientists (IT)
        </button>
      )}

      {composing && <Composer author={me} onClose={() => setComposing(false)} onPosted={() => { setComposing(false); load(); }} />}
    </div>
  );
}
