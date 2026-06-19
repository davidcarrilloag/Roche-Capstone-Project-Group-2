import { useEffect, useState } from "react";
import { listBookings } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import { CalendarDays, MapPin, User, RotateCcw, ExternalLink } from "lucide-react";

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function endTime(time, duration) {
  const [h, m] = (time || "0:0").split(":").map((x) => parseInt(x, 10));
  const total = h * 60 + m + (duration || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function TeamSchedule() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const me = getIdentity();

  function load() {
    setLoading(true);
    listBookings()
      .then((list) => {
        const sorted = [...(list || [])].sort((a, b) =>
          (a.date + a.time).localeCompare(b.date + b.time)
        );
        setBookings(sorted);
        setError("");
      })
      .catch(() => setError("Couldn't load the schedule."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Group by date (already sorted).
  const groups = [];
  for (const b of bookings) {
    let g = groups.find((x) => x.date === b.date);
    if (!g) {
      g = { date: b.date, items: [] };
      groups.push(g);
    }
    g.items.push(b);
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }} className="chat-scroll">
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <CalendarDays size={20} strokeWidth={1.75} color="var(--accent)" />
            Team schedule
          </h1>
          <button
            onClick={load}
            title="Refresh"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--border-color)", background: "transparent",
              color: "var(--text-secondary)", fontSize: 12.5, fontFamily: "inherit",
            }}
          >
            <RotateCcw size={13} strokeWidth={1.75} /> Refresh
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 22px" }}>
          All equipment reservations across the lab. Yours are highlighted.
        </p>

        {loading && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}
        {error && <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>}

        {!loading && !error && bookings.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <CalendarDays size={32} strokeWidth={1.25} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <p style={{ fontSize: 14 }}>No reservations yet.</p>
            <p style={{ fontSize: 12.5 }}>Book equipment from the chat — it'll show up here for the whole team.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--text-muted)", marginBottom: 10, paddingLeft: 2,
              }}
            >
              {fmtDate(group.date)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map((b) => {
                const mine = me && b.user === me;
                return (
                  <div
                    key={b.reference}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 16px", borderRadius: 10,
                      backgroundColor: mine ? "var(--accent-tint)" : "var(--bg-card)",
                      border: `1px solid ${mine ? "var(--accent-tint-border)" : "var(--border-color)"}`,
                    }}
                  >
                    {/* Time block */}
                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 56 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{b.time}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{endTime(b.time, b.duration_minutes)}</div>
                    </div>
                    <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--border-color)" }} />
                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", marginBottom: 3 }}>
                        {b.equipment_name}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <User size={12} strokeWidth={1.75} /> {b.user || "—"}{mine ? " (you)" : ""}
                        </span>
                        {b.location && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MapPin size={12} strokeWidth={1.75} /> {b.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Right: reference + calendar link */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--text-muted)" }}>{b.reference}</div>
                      {b.calendar_link && (
                        <a
                          href={b.calendar_link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--accent)", marginTop: 2 }}
                        >
                          Calendar <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
