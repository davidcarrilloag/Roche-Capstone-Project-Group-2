import { useEffect, useState } from "react";
import { membersDirectory } from "../api.js";
import { FlaskConical, Headset, ChevronDown, Check } from "lucide-react";

const PERSPECTIVES = [
  {
    name: "Dr. Marco Rossi",
    role: "Research Scientist · Molecular Biology",
    Icon: FlaskConical,
    color: "#0066CC",
    blurb: "See the app as a scientist: ask the assistant, book equipment and rooms, follow your team's activity, and reach colleagues or IT.",
  },
  {
    name: "Tom Becker",
    role: "IT Service Desk",
    Icon: Headset,
    color: "#7C3AED",
    blurb: "See the app as IT: answer scientists' questions, see what the lab is asking, and post updates to everyone.",
  },
];

function choose(name) {
  try {
    localStorage.setItem("labIdentity", name);
    localStorage.setItem("perspectiveChosen", "1");
  } catch (e) {}
  // Reload so every part of the app picks up the new identity cleanly.
  window.location.reload();
}

export default function PerspectiveLanding({ onClose }) {
  const [showAll, setShowAll] = useState(false);
  const [all, setAll] = useState([]);

  useEffect(() => {
    if (showAll && all.length === 0) {
      membersDirectory().then((m) => setAll(m || [])).catch(() => {});
    }
  }, [showAll, all.length]);

  return (
    <div
      className="fullscreen-fade-in"
      style={{
        position: "fixed", inset: 0, zIndex: 80,
        background: "linear-gradient(180deg, #001F5B 0%, #003380 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
          Roche Lab Assistant
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Choose a perspective</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 28px" }}>
          Experience the app the way each person would in real life.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {PERSPECTIVES.map((p) => (
            <button
              key={p.name}
              onClick={() => choose(p.name)}
              style={{
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16, padding: 22, color: "#fff",
                display: "flex", flexDirection: "column", gap: 12,
                transition: "background 0.15s, transform 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: p.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p.Icon size={24} color="#fff" strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>{p.role}</div>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{p.blurb}</div>
              <div style={{ marginTop: "auto", fontSize: 13, fontWeight: 600, color: "#fff" }}>Enter as {p.name.split(" ").slice(-1)[0]} →</div>
            </button>
          ))}
        </div>

        {/* Browse the full roster (demo flexibility) */}
        <button
          onClick={() => setShowAll((s) => !s)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 22, background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >
          Or pick someone else <ChevronDown size={15} style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {showAll && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: 260, overflowY: "auto", textAlign: "left" }} className="chat-scroll">
            {all.map((m) => (
              <button
                key={m.id}
                onClick={() => choose(m.name)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff" }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{m.role}{(m.team || "").startsWith("IT") ? " · IT" : ""}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {onClose && (
          <div style={{ marginTop: 22 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              Keep current view
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
