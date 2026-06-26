import { useEffect, useState } from "react";
import { listAnnouncements } from "../api.js";
import { Wrench, AlertTriangle, Info, Check, ChevronDown, ChevronUp } from "lucide-react";

const CAT = {
  info: { icon: Info, color: "#0066CC", bg: "var(--accent-tint)", border: "var(--accent-tint-border)" },
  maintenance: { icon: Wrench, color: "#CA8A04", bg: "rgba(202,138,4,0.12)", border: "rgba(202,138,4,0.35)" },
  incident: { icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.35)" },
};

function getTrayStyle(items) {
  if (items.some((a) => a.category === "incident"))
    return { color: "#DC2626", bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.30)" };
  if (items.some((a) => a.category === "maintenance"))
    return { color: "#CA8A04", bg: "rgba(202,138,4,0.10)", border: "rgba(202,138,4,0.30)" };
  return { color: "#0066CC", bg: "var(--accent-tint)", border: "var(--accent-tint-border)" };
}

// Dismissals are per page load (in-memory) so alerts always show on reload.
export default function AnnouncementsBar() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [fading, setFading] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    listAnnouncements().then((a) => setItems(a || [])).catch(() => {});
  }, []);

  function dismiss(id) {
    setFading((f) => [...f, id]);
  }

  function onFadeEnd(id) {
    setDismissed((d) => [...d, id]);
    setFading((f) => f.filter((x) => x !== id));
  }

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const { color, bg, border } = getTrayStyle(visible);
  const label = `${visible.length} active alert${visible.length !== 1 ? "s" : ""}`;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 20px 0", width: "100%" }}>
      {/* Slim collapsed bar */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          borderRadius: expanded ? "8px 8px 0 0" : 8,
          backgroundColor: bg,
          border: `1px solid ${border}`,
          ...(expanded && { borderBottom: "none" }),
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color }}>{label}</span>
        {expanded
          ? <ChevronUp size={14} color={color} />
          : <ChevronDown size={14} color={color} />}
      </div>

      {/* Expanded list — slides in on mount */}
      {expanded && (
        <div
          className="alert-slide-down"
          style={{ border: `1px solid ${border}`, borderTop: "none", borderRadius: "0 0 8px 8px", backgroundColor: "var(--bg-card)", overflow: "hidden" }}
        >
          {visible.map((a) => {
            const c = CAT[a.category] || CAT.info;
            const Icon = c.icon;
            const isFading = fading.includes(a.id);
            return (
              <div
                key={a.id}
                className={isFading ? "alert-fade-out" : ""}
                onAnimationEnd={isFading ? () => onFadeEnd(a.id) : undefined}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderTop: `1px solid ${border}` }}
              >
                <Icon size={15} color={c.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
                  {a.body && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.45 }}>{a.body}</div>}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>📣 {a.author || "IT"}</div>
                </div>
                <button
                  className="alert-ack-btn"
                  onClick={(e) => { e.stopPropagation(); dismiss(a.id); }}
                  title="Got it"
                >
                  <Check size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
