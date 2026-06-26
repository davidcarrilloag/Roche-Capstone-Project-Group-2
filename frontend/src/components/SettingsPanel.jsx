import { useEffect, useState } from "react";
import { X, Sun, Moon, Monitor, Mic, Globe, User, Trash2, Check } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/* ── Small building blocks ─────────────────────────────────── */

function Section({ icon: Icon, title, description, children }) {
  return (
    <div style={{ padding: "18px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon size={15} strokeWidth={1.75} color="var(--accent)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
      </div>
      {description && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "none",
        border: "none",
        padding: "7px 0",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
      <span
        style={{
          position: "relative",
          width: 38,
          height: 22,
          borderRadius: 11,
          flexShrink: 0,
          backgroundColor: checked ? "var(--accent)" : "var(--border-color)",
          transition: "background-color 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            transform: checked ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </span>
    </button>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 3,
        borderRadius: 9,
        backgroundColor: "var(--bg-main)",
        border: "1px solid var(--border-color)",
      }}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "7px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: active ? "var(--bg-card)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-secondary)",
              boxShadow: active ? "var(--shadow-card)" : "none",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Panel ─────────────────────────────────────────────────── */

export default function SettingsPanel({
  onClose,
  themeMode,
  onSetTheme,
  language,
  onSetLanguage,
  voiceEnabled,
  onSetVoiceEnabled,
  voiceAutoSend,
  onSetVoiceAutoSend,
  voiceAutoSpeak,
  onSetVoiceAutoSpeak,
  ticketCaller,
  onSetTicketCaller,
  onClearData,
}) {
  const [caller, setCaller] = useState(ticketCaller || "");
  const [cleared, setCleared] = useState(false);
  const [closing, setClosing] = useState(false);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 240);
  }

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitCaller() {
    onSetTicketCaller(caller.trim());
  }

  function handleClear() {
    if (!window.confirm("Clear chat history and reset this session? Your preferences are kept.")) return;
    onClearData();
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      className={closing ? "overlay-fade-out" : "overlay-fade-in"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        className={closing ? "drawer-slide-out" : "drawer-slide-in"}
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          backgroundColor: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Settings
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "none",
              background: "none",
              cursor: "pointer",
              borderRadius: 6,
              color: "var(--text-secondary)",
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }} className="chat-scroll">
          {/* Appearance */}
          <Section icon={Sun} title="Appearance" description="Choose how the assistant looks.">
            <Segmented options={THEME_OPTIONS} value={themeMode} onChange={onSetTheme} />
          </Section>

          {/* Language */}
          <Section
            icon={Globe}
            title="Default language"
            description="New chats start in this language. You can still switch any time."
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {LANGUAGES.map((l) => {
                const active = language === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => onSetLanguage(l.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                      backgroundColor: active ? "var(--accent-tint)" : "var(--bg-card)",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    {l.label}
                    {active && <Check size={14} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Voice */}
          <Section
            icon={Mic}
            title="Voice input"
            description="Dictate questions with the microphone. Works in Chrome and Edge."
          >
            <Toggle checked={voiceEnabled} onChange={onSetVoiceEnabled} label="Enable voice input" />
            <div style={{ opacity: voiceEnabled ? 1 : 0.4, pointerEvents: voiceEnabled ? "auto" : "none" }}>
              <Toggle
                checked={voiceAutoSend}
                onChange={onSetVoiceAutoSend}
                label="Send automatically when I stop speaking"
              />
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 8px", lineHeight: 1.4 }}>
                When off, the words just fill the box so you can edit before sending.
              </p>
            </div>
            <Toggle
              checked={voiceAutoSpeak}
              onChange={onSetVoiceAutoSpeak}
              label="Read answers aloud automatically"
            />
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4 }}>
              You can also read any answer with the 🔊 button on it.
            </p>
          </Section>

          {/* Ticket identity */}
          <Section
            icon={User}
            title="Your details for tickets"
            description="Pre-fills the caller when you open a ServiceNow ticket, so you don't retype it."
          >
            <input
              value={caller}
              onChange={(e) => setCaller(e.target.value)}
              onBlur={commitCaller}
              placeholder="e.g. jane.doe@roche.com"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                outline: "none",
              }}
            />
          </Section>

          {/* Data */}
          <Section
            icon={Trash2}
            title="Privacy & data"
            description="Chats live only in this browser. Clear them anytime."
          >
            <button
              onClick={handleClear}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid var(--border-color)",
                backgroundColor: "transparent",
                color: cleared ? "#16A34A" : "#DC2626",
              }}
            >
              {cleared ? <Check size={15} strokeWidth={2} /> : <Trash2 size={15} strokeWidth={1.75} />}
              {cleared ? "Chat history cleared" : "Clear chat history"}
            </button>
          </Section>

          <div style={{ height: 16 }} />
        </div>
      </div>
    </div>
  );
}
