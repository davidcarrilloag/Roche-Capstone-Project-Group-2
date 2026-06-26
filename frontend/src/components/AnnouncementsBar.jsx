import { useEffect, useState } from "react";
import { listAnnouncements } from "../api.js";
import { Wrench, AlertTriangle, Info, X } from "lucide-react";

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

// Read-only broadcast banner. IT posts/manages announcements in the IT Support tab.
export default function AnnouncementsBar() {
  const [items, setItems] = useState([]);
  const [, force] = useState(0);

  useEffect(() => {
    listAnnouncements().then((a) => setItems(a || [])).catch(() => {});
  }, []);

  const visible = items.filter((a) => !dismissedIds().includes(a.id));
  if (visible.length === 0) return null;

  // Only surface the single most recent update here so we don't flood the
  // start with IT messages. The rest live in the IT Support tab.
  const a = visible[0];
  const more = visible.length - 1;
  const c = CAT[a.category] || CAT.info;
  const Icon = c.icon;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 20px 0", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 10, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
        <Icon size={17} color={c.color} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
          {a.body && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{a.body}</div>}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            📣 {a.author || "IT"}
            {more > 0 && <span> · +{more} more in IT Support</span>}
          </div>
        </div>
        <button onClick={() => { dismiss(a.id); force((n) => n + 1); }} title="Dismiss" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
