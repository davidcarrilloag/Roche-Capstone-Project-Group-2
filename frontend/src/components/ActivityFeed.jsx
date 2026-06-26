import { useEffect, useState } from "react";
import { getActivity } from "../api.js";
import { HelpCircle, Lightbulb, Megaphone, CalendarDays } from "lucide-react";

const ICONS = {
  booking: { Icon: CalendarDays, color: "#0066CC" },
  question: { Icon: HelpCircle, color: "#7C3AED" },
  answer: { Icon: Lightbulb, color: "#16A34A" },
  announcement: { Icon: Megaphone, color: "#CA8A04" },
};

function ago(iso) {
  const t = new Date(iso + (iso && iso.endsWith("Z") ? "" : "Z"));
  if (isNaN(t)) return "";
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function ActivityFeed({ title = "Recent team activity", scheduleVariant = false }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getActivity(7).then((a) => setItems(a || [])).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  if (scheduleVariant) {
    return (
      <div style={{ marginTop: 36, textAlign: "left" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, opacity: 0.75 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {items.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 400, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500 }}>{e.actor}</span>{" "}{e.text}
                  {e.detail && (
                    <span style={{ opacity: 0.7 }}> · {e.detail}</span>
                  )}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, opacity: 0.7 }}>{ago(e.ts)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28, textAlign: "left" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((e, i) => {
          const { Icon, color } = ICONS[e.type] || ICONS.announcement;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 8px", borderRadius: 8 }}>
              <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{e.actor}</span> {e.text}
                </div>
                {e.detail && (
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.detail}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{ago(e.ts)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
