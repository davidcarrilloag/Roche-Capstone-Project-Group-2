import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../api.js";
import FeedbackButton from "./FeedbackButton.jsx";
import IncidentForm from "./IncidentForm.jsx";
import MessageBubble from "./MessageBubble.jsx";
import { Paperclip, Mic, ArrowUp, ChevronRight } from "lucide-react";

const WELCOME_SHORTCUTS = [
  "What trainings do I need as a new employee?",
  "How do I order lab consumables?",
  "Waste disposal procedure for chemical waste",
  "How do I file an IT support ticket?",
];

const QUICK_SHORTCUTS = [
  "Order consumables",
  "New employee guide",
  "Return materials",
  "Broken device",
  "Waste disposal",
];

const PLACEHOLDERS_EN = [
  "Ask about procedures, equipment, onboarding...",
  "Ask me about lab waste disposal...",
  "How do I order consumables?",
];

const PLACEHOLDERS_DE = [
  "Fragen zu Verfahren, Geräten, Einarbeitung...",
  "Ich kann auf Deutsch antworten...",
  "Wie bestelle ich Verbrauchsmaterialien?",
];

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

function suggestsTicket(text) {
  const t = text.toLowerCase();
  return (
    t.includes("incident") ||
    t.includes("ticket") ||
    t.includes("it support") ||
    t.includes("servicenow") ||
    t.includes("raise a request") ||
    t.includes("not working") ||
    t.includes("broken") ||
    t.includes("can't log") ||
    t.includes("cannot log")
  );
}

const FOLLOW_UP_RULES = [
  {
    keywords: ["waste", "disposal", "chemical", "hazardous"],
    suggestions: [
      "What containers are required for chemical waste?",
      "Who do I contact for waste pickup?",
      "Are there separate bins for biological waste?",
    ],
  },
  {
    keywords: ["consumables", "order", "ordering", "procurement", "purchase"],
    suggestions: [
      "How long does delivery take?",
      "What is the budget approval process?",
      "Can I order from external suppliers?",
    ],
  },
  {
    keywords: ["equipment", "maintenance", "broken", "repair", "device", "instrument"],
    suggestions: [
      "Who is responsible for equipment maintenance?",
      "How do I report a broken device?",
      "What is the calibration schedule?",
    ],
  },
  {
    keywords: ["onboarding", "new employee", "training", "orientation"],
    suggestions: [
      "What safety trainings are mandatory?",
      "How do I get lab access?",
      "Who is my assigned onboarding buddy?",
    ],
  },
  {
    keywords: ["storage", "cold", "freezer", "refrigerat", "temperature"],
    suggestions: [
      "What are the temperature requirements?",
      "How do I log cold storage incidents?",
      "What happens if temperature goes out of range?",
    ],
  },
  {
    keywords: ["ticket", "incident", "servicenow", "support", "it support"],
    suggestions: [
      "What information is needed to open a ticket?",
      "How do I check my ticket status?",
      "What is the typical response time?",
    ],
  },
  {
    keywords: ["safety", "ppe", "protective", "gloves", "goggles", "emergency"],
    suggestions: [
      "Where is the nearest safety shower?",
      "What PPE is required in my lab area?",
      "How do I report a safety incident?",
    ],
  },
  {
    keywords: ["access", "badge", "door", "permission", "login", "password"],
    suggestions: [
      "How do I request additional access?",
      "Who approves access requests?",
      "What do I do if I'm locked out?",
    ],
  },
];

function suggestFollowUps(text) {
  const t = text.toLowerCase();
  const seen = new Set();
  const results = [];
  for (const rule of FOLLOW_UP_RULES) {
    if (rule.keywords.some((kw) => t.includes(kw))) {
      for (const s of rule.suggestions) {
        if (!seen.has(s)) {
          seen.add(s);
          results.push(s);
        }
        if (results.length >= 3) return results;
      }
    }
  }
  return results;
}

function SuggestedFollowUps({ suggestions, onSelect }) {
  if (!suggestions.length) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 10,
        paddingLeft: 2,
      }}
    >
      {suggestions.map((s, i) => (
        <FollowUpChip key={s} text={s} delay={i * 60} onClick={() => onSelect(s)} />
      ))}
    </div>
  );
}

function FollowUpChip({ text, delay = 0, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="chip-fade-up"
      style={{
        padding: "5px 12px",
        fontSize: 12,
        border: `1px solid ${hover ? "#0066CC" : "#C7DEFA"}`,
        borderRadius: 14,
        background: hover ? "#EBF3FB" : "#F5F9FF",
        color: "#0066CC",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "border-color 0.12s, background 0.12s",
        textAlign: "left",
        lineHeight: 1.4,
        animationDelay: `${delay}ms`,
      }}
    >
      {text}
    </button>
  );
}

function RocheLogo({ color = "#0066CC" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

function WelcomeShortcut({ text, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 6,
        border: `1px solid ${hover ? "#0066CC" : "#E0E0E0"}`,
        cursor: "pointer",
        backgroundColor: "#FFFFFF",
        color: "#333333",
        fontSize: 13,
        fontFamily: "inherit",
        transition: "border-color 0.12s",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span>{text}</span>
      <ChevronRight size={14} strokeWidth={1.5} color="#0066CC" style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function ChatWindow({ sessionId = "", language = "en", messages: propMessages, setMessages: propSetMessages }) {
  const [internalMessages, setInternalMessages] = useState([]);
  const messages = propMessages !== undefined ? propMessages : internalMessages;
  const setMessages = propSetMessages !== undefined ? propSetMessages : setInternalMessages;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incidentContext, setIncidentContext] = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const endRef = useRef(null);
  const prevLangRef = useRef(language);
  const isFirstMount = useRef(true);

  const hasUserMessage = messages.some((m) => m.role === "user");
  const inputEmpty = !input.trim();
  const placeholders = language === "de" ? PLACEHOLDERS_DE : PLACEHOLDERS_EN;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Rotate placeholder every 3 s
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [language]);

  useEffect(() => {
    setPlaceholderIdx(0);
  }, [language]);

  // Language-switch system divider
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevLangRef.current = language;
      return;
    }
    if (prevLangRef.current !== language) {
      prevLangRef.current = language;
      const text =
        language === "de"
          ? "─── Auf Deutsch gewechselt ───"
          : "─── Switched to English ───";
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "system", text, isSystemDivider: true, timestamp: new Date() },
      ]);
    }
  }, [language]);

  async function send(text) {
    const query = (text ?? input).trim();
    if (!query || busy) return;

    setMessages((prev) => [
      ...prev,
      { id: genId(), role: "user", text: query, timestamp: new Date() },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await sendMessage(query, language, sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          text: res.answer ?? res.message ?? "No response received.",
          responseType: res.response_type ?? "plain",
          confidence: res.confidence ?? 1,
          source:
            res.source_doc || res.title
              ? {
                  title: res.source_doc ?? res.title,
                  version: res.source_version ?? res.version ?? null,
                  date: res.source_date ?? null,
                  url: res.drive_link ?? res.google_drive_link ?? null,
                }
              : null,
          actionLabel: res.action_label ?? null,
          actionUrl: res.action_url ?? null,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          text: `Sorry, something went wrong. Please try again.\n\n${err.message}`,
          responseType: "plain",
          confidence: 1,
          source: null,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function openIncident(botMsg, userText) {
    setIncidentContext({
      initialTitle: userText ? userText.slice(0, 80) : "Lab equipment issue",
      initialDescription: [
        userText ? `Issue reported:\n${userText}` : "",
        botMsg ? `Assistant response:\n${botMsg.text}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* ── Scrollable content ─────────────────── */}
      <div
        className="chat-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!hasUserMessage ? (
          /* Welcome / empty state */
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
            }}
          >
            <div style={{ width: "100%", maxWidth: 460 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <RocheLogo />
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#001F5B",
                  marginBottom: 6,
                }}
              >
                Lab Assistant
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "#333333",
                  marginBottom: 28,
                  lineHeight: 1.5,
                }}
              >
                Ask anything about lab procedures, equipment, onboarding, or support.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {WELCOME_SHORTCUTS.map((text) => (
                  <WelcomeShortcut key={text} text={text} onClick={() => send(text)} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message list */
          <div
            style={{
              maxWidth: 680,
              margin: "0 auto",
              padding: "24px 20px 8px",
              width: "100%",
            }}
          >
            {messages.map((msg, idx) => {
              if (msg.isSystemDivider) {
                return (
                  <div
                    key={msg.id}
                    className="msg-fade-up"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "16px 0",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{msg.text}</span>
                  </div>
                );
              }

              const prevUserMsg =
                msg.role === "assistant"
                  ? [...messages].slice(0, idx).reverse().find((m) => m.role === "user")
                  : null;

              const isLastAssistant =
                msg.role === "assistant" &&
                !busy &&
                messages.slice(idx + 1).every((m) => m.isSystemDivider);

              const followUps = isLastAssistant ? suggestFollowUps(msg.text) : [];

              return (
                <div key={msg.id} className="msg-fade-up" style={{ marginBottom: 16 }}>
                  <MessageBubble message={msg} />
                  {msg.role === "assistant" && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 6,
                          paddingLeft: 2,
                        }}
                      >
                        <FeedbackButton messageId={msg.id} />
                        {suggestsTicket(msg.text) && (
                          <button
                            onClick={() => openIncident(msg, prevUserMsg?.text)}
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              border: "1px solid #0066CC",
                              borderRadius: 4,
                              background: "none",
                              color: "#0066CC",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Create incident
                          </button>
                        )}
                      </div>
                      <SuggestedFollowUps
                        suggestions={followUps}
                        onSelect={(text) => send(text)}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {busy && (
              <div className="msg-fade-up" style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#F5F5F5",
                    borderLeft: "3px solid #0066CC",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ──────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 20px 16px",
          backgroundColor: "#F5F5F5",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ maxWidth: 680, margin: "0 auto" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#F5F5F5",
              border: `1px solid ${inputFocused ? "#0066CC" : "#E0E0E0"}`,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              padding: "0 12px",
              height: 44,
              transition: "border-color 0.15s",
            }}
          >
            <Paperclip size={15} strokeWidth={1.5} color="#9CA3AF" style={{ flexShrink: 0 }} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={placeholders[placeholderIdx]}
              disabled={busy}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 13,
                fontFamily: "inherit",
                color: "#333333",
                backgroundColor: "transparent",
                caretColor: "#0066CC",
              }}
            />
            <button
              type="submit"
              disabled={busy || inputEmpty}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                cursor: inputEmpty ? "default" : "pointer",
                backgroundColor: "#0066CC",
                flexShrink: 0,
                opacity: inputEmpty ? 0 : 1,
                transition: "opacity 0.15s",
                pointerEvents: inputEmpty ? "none" : "auto",
              }}
            >
              <ArrowUp size={14} strokeWidth={2} color="white" />
            </button>
            <Mic size={15} strokeWidth={1.5} color="#0066CC" style={{ flexShrink: 0 }} />
          </div>
        </form>

        {/* Quick text shortcuts */}
        <div
          className="shortcuts-scroll"
          style={{
            maxWidth: 680,
            margin: "8px auto 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
          }}
        >
          {QUICK_SHORTCUTS.map((label) => (
            <button
              key={label}
              onClick={() => send(label)}
              style={{
                flexShrink: 0,
                background: "#EBF3FB",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                color: "#0066CC",
                fontFamily: "inherit",
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                borderRadius: 16,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Incident modal */}
      {incidentContext && (
        <IncidentForm
          initialTitle={incidentContext.initialTitle}
          initialDescription={incidentContext.initialDescription}
          onClose={() => setIncidentContext(null)}
        />
      )}
    </div>
  );
}
