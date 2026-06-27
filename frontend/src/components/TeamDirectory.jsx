import { useEffect, useState } from "react";
import { membersDirectory, memberProfile } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import AskColleagueModal from "./AskColleagueModal.jsx";
import { t } from "../i18n.js";
import { ArrowLeft, MessageSquare, Lightbulb, CalendarDays, MapPin, Award } from "lucide-react";

const AVATAR_COLORS = ["#0066CC", "#7C3AED", "#0891B2", "#DB2777", "#EA580C", "#16A34A", "#CA8A04", "#475569"];

function initials(name) {
  const clean = (name || "").replace(/^dr\.?\s+/i, "").trim();
  const parts = clean.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
function colorFor(name) {
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function Avatar({ name, size = 44 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        backgroundColor: colorFor(name), color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}
function Tags({ expertise }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(expertise || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
        <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, backgroundColor: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent-tint-border)" }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function ProfileView({ id, onBack, language = "en" }) {
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ask, setAsk] = useState(false);
  const me = getIdentity();

  useEffect(() => {
    memberProfile(id).then(setP).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: 20 }}>{t(language, "common.loading")}</p>;
  if (!p) return null;
  const isMe = me && p.name === me;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 40px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
        <ArrowLeft size={14} /> {t(language, "people.allPeople")}
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <Avatar name={p.name} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
            {p.name} {isMe && <span style={{ fontSize: 12, color: "var(--accent)" }}>({t(language, "common.you")})</span>}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{p.role} · {p.team}</div>
        </div>
        {!isMe && (
          <button onClick={() => setAsk(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", backgroundColor: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <MessageSquare size={15} /> {t(language, "common.askMeet")}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 22 }}><Tags expertise={p.expertise} /></div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <Stat icon={Lightbulb} value={p.stats.answers} label={t(language, "people.answersContrib")} />
        <Stat icon={CalendarDays} value={p.stats.bookings} label={t(language, "people.bookings")} />
      </div>

      {/* Knowledge contributions */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Award size={16} color="var(--accent)" /> {t(language, "people.contributions")}
      </h2>
      {p.contributions.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>{t(language, "people.noContrib")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {p.contributions.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 14px", backgroundColor: "var(--bg-card)" }}>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 4 }}>Q: {c.question}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.5 }}>{c.answer}</div>
              {c.from_user && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{t(language, "people.askedBy")} {c.from_user}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Bookings */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>{t(language, "people.reservations")}</h2>
      {p.bookings.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t(language, "people.noReservations")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {p.bookings.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontWeight: 500 }}>{b.equipment_name}</span>
              <span style={{ color: "var(--text-muted)" }}>{b.date} · {b.time}</span>
              {b.location && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 12 }}><MapPin size={12} />{b.location}</span>}
            </div>
          ))}
        </div>
      )}

      {ask && <AskColleagueModal lockedMember={p.name} onClose={() => setAsk(false)} />}
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div style={{ flex: 1, border: "1px solid var(--border-color)", borderRadius: 10, padding: "14px 16px", backgroundColor: "var(--bg-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={16} color="var(--accent)" />
        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function TeamDirectory({ language = "en" }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const me = getIdentity();

  useEffect(() => {
    membersDirectory()
      // People = scientists only; the IT team lives in the IT Support tab.
      .then((m) => setMembers((m || []).filter((x) => !(x.team || "").startsWith("IT"))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (selected) {
    return (
      <div style={{ height: "100%", overflowY: "auto" }} className="chat-scroll">
        <ProfileView id={selected} onBack={() => setSelected(null)} language={language} />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }} className="chat-scroll">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 40px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>{t(language, "people.title")}</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 22px" }}>
          {t(language, "people.subtitle")}
        </p>

        {loading && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t(language, "common.loading")}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
          {members.map((m) => {
            const isMe = me && m.name === me;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                style={{
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${isMe ? "var(--accent)" : "var(--border-color)"}`,
                  borderRadius: 12, padding: 16, backgroundColor: "var(--bg-card)",
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "border-color 0.12s, transform 0.12s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = isMe ? "var(--accent)" : "var(--border-color)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={m.name} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name} {isMe && <span style={{ fontSize: 11, color: "var(--accent)" }}>({t(language, "common.you")})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                      {m.role}
                      {(m.team || "").startsWith("IT") && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "#fff", backgroundColor: "#7C3AED", padding: "1px 5px", borderRadius: 3 }}>IT</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.team}</div>
                <Tags expertise={m.expertise} />
                <div style={{ display: "flex", gap: 14, marginTop: 2, fontSize: 11.5, color: "var(--text-secondary)" }}>
                  <span>💡 {m.answers} {t(language, "people.answers")}</span>
                  <span>📅 {m.bookings} {t(language, "people.bookings")}</span>
                  {m.open_questions > 0 && <span style={{ color: "#EF4444" }}>● {m.open_questions} {t(language, "people.pending")}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
