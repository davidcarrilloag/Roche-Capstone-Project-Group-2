import { useEffect, useRef, useState } from "react";
import { listMembers } from "../api.js";
import { User, Check, ChevronUp } from "lucide-react";

// Current synthetic identity (the lab member you're acting as).
export function getIdentity() {
  try {
    return localStorage.getItem("labIdentity") || "";
  } catch {
    return "";
  }
}

export default function IdentityPicker() {
  const [members, setMembers] = useState([]);
  const [identity, setIdentity] = useState(getIdentity());
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    listMembers()
      .then((list) => {
        setMembers(list || []);
        // Default to the first member so there's always an identity.
        if (!getIdentity() && list && list[0]) select(list[0].name);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(name) {
    setIdentity(name);
    try {
      localStorage.setItem("labIdentity", name);
    } catch (e) {}
    setOpen(false);
  }

  const current = members.find((m) => m.name === identity);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            marginBottom: 6,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 40,
          }}
          className="chat-scroll"
        >
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-tint)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>
                  {m.role} · {m.team}
                </div>
              </div>
              {m.name === identity && <Check size={13} strokeWidth={2.5} color="var(--accent)" style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch identity"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          height: 44,
          padding: "0 8px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          backgroundColor: open ? "rgba(255,255,255,0.08)" : "transparent",
          color: "#FFFFFF",
          fontFamily: "inherit",
          transition: "background-color 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
        onMouseLeave={(e) => !open && (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <User size={14} strokeWidth={1.75} color="#FFFFFF" />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "#FFFFFF",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {identity || "Select identity"}
          </div>
          {current && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{current.team}</div>
          )}
        </div>
        <ChevronUp size={14} strokeWidth={2} color="rgba(255,255,255,0.6)" style={{ flexShrink: 0 }} />
      </button>
    </div>
  );
}
