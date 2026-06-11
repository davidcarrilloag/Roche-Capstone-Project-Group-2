import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../api.js";
import FeedbackButton from "./FeedbackButton.jsx";
import IncidentForm from "./IncidentForm.jsx";
import MessageBubble from "./MessageBubble.jsx";
import ThinkingIndicator from "./ThinkingIndicator.jsx";
import rocheLogoBlue from "../assets/Roche_Logo_Blue.png";
import rocheLogoWhite from "../assets/Roche_Logo_White.png";
import { Paperclip, Mic, ArrowUp, ChevronRight } from "lucide-react";

const WELCOME_SHORTCUTS = [
  "What trainings do I need as a new employee?",
  "How do I order lab consumables?",
  "Waste disposal procedure for chemical waste",
  "How do I file an IT support ticket?",
];

const PLACEHOLDERS_EN = [
  "Try: how do I return expired reagents?",
  "Try: what PPE is required in my lab area?",
  "Try: how do I request cold storage access?",
];

const PLACEHOLDERS_DE = [
  "Wie gehe ich mit abgelaufenen Reagenzien um?",
  "Welche PSA ist in meinem Laborbereich erforderlich?",
  "Wie beantrage ich Zugang zur Kühllagerung?",
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
        padding: "10px 14px",
        minHeight: 44,
        fontSize: 12,
        border: `1px solid ${hover ? "var(--accent)" : "var(--border-color)"}`,
        borderRadius: 6,
        background: hover ? "var(--accent-tint)" : "var(--bg-card)",
        color: hover ? "var(--accent)" : "var(--text-primary)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "border-color 0.12s, background 0.12s, color 0.12s",
        textAlign: "left",
        lineHeight: 1.4,
        animationDelay: `${delay}ms`,
      }}
    >
      {text}
    </button>
  );
}

function IncidentBtn({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "10px 20px",
        minHeight: 44,
        fontSize: 13,
        fontWeight: 500,
        backgroundColor: hover ? "var(--accent-tint)" : "transparent",
        color: "var(--accent)",
        border: "1.5px solid var(--accent)",
        borderRadius: 22,
        cursor: "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
        transition: "background-color 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      Create support ticket
    </button>
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
        padding: "18px 16px",
        minHeight: 64,
        borderRadius: 10,
        border: `1px solid ${hover ? "var(--accent-tint-border)" : "var(--border-color)"}`,
        borderLeft: `3px solid ${hover ? "var(--accent)" : "transparent"}`,
        cursor: "pointer",
        backgroundColor: "var(--bg-card)",
        color: hover ? "var(--accent-hover)" : "var(--text-primary)",
        fontSize: 15,
        fontWeight: 500,
        fontFamily: "inherit",
        transition: "border-color 0.12s, box-shadow 0.15s, transform 0.12s, color 0.12s",
        width: "100%",
        textAlign: "left",
        boxShadow: hover ? "0 4px 12px rgba(0,102,204,0.12)" : "0 1px 3px rgba(0,0,0,0.05)",
        transform: hover ? "translateY(-1px)" : "none",
      }}
    >
      <span style={{ lineHeight: 1.4 }}>{text}</span>
      <ChevronRight size={16} strokeWidth={2} color="var(--accent)" style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function ChatWindow({ sessionId = "", language = "en", messages: propMessages, setMessages: propSetMessages, onOpenDocument, darkMode = false }) {
  const [internalMessages, setInternalMessages] = useState([]);
  const messages = propMessages !== undefined ? propMessages : internalMessages;
  const setMessages = propSetMessages !== undefined ? propSetMessages : setInternalMessages;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incidentContext, setIncidentContext] = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micHover, setMicHover] = useState(false);
  const [clipHover, setClipHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const endRef = useRef(null);
  const prevLangRef = useRef(language);
  const isFirstMount = useRef(true);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastQueryRef = useRef("");

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

  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  function buildAssistantMsg(res) {
    return {
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
    };
  }

  function buildErrorMsg(err) {
    return {
      id: genId(),
      role: "assistant",
      isError: true,
      errorDetail: err ? (err.message || String(err)) : null,
      text: "",
      responseType: "plain",
      confidence: 1,
      source: null,
      timestamp: new Date(),
    };
  }

  async function send(text) {
    const query = (text ?? input).trim();
    if (!query || busy) return;
    lastQueryRef.current = query;

    setMessages((prev) => [
      ...prev,
      { id: genId(), role: "user", text: query, timestamp: new Date() },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await sendMessage(query, language, sessionId);
      setMessages((prev) => [...prev, buildAssistantMsg(res)]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, buildErrorMsg(err)]);
    } finally {
      setBusy(false);
    }
  }

  async function retryLastQuery() {
    const query = lastQueryRef.current;
    if (!query || busy) return;
    // Remove any existing error messages, keep user messages intact
    setMessages((prev) => prev.filter((m) => !m.isError));
    setBusy(true);
    try {
      const res = await sendMessage(query, language, sessionId);
      setMessages((prev) => [...prev, buildAssistantMsg(res)]);
    } catch (err) {
      console.error("Retry error:", err);
      setMessages((prev) => [...prev, buildErrorMsg(err)]);
    } finally {
      setBusy(false);
    }
  }

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => prev + (prev ? " " : "") + transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
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
        backgroundColor: "var(--bg-main)",
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
              background: "radial-gradient(ellipse 60% 50% at 50% 42%, var(--accent-tint) 0%, var(--bg-main) 70%)",
            }}
          >
            <div style={{ width: "100%", maxWidth: 460 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{
                  padding: "14px 22px",
                  borderRadius: 20,
                  background: "var(--accent-tint)",
                  boxShadow: "0 0 0 10px var(--accent-tint)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <img
                    src={darkMode ? rocheLogoWhite : rocheLogoBlue}
                    alt="Roche"
                    style={{ height: 44, width: "auto", display: "block" }}
                  />
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}
              >
                Lab Assistant
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 20,
                  lineHeight: 1.5,
                }}
              >
                Ask anything about lab procedures, equipment, onboarding, or support.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              maxWidth: 740,
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
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg.text}</span>
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
                <div key={msg.id} className="msg-fade-up" style={{ marginBottom: 20 }}>
                  <MessageBubble
                    message={msg}
                    onRetry={msg.isError ? retryLastQuery : undefined}
                    onOpenDocument={onOpenDocument}
                  />
                  {msg.role === "assistant" && !msg.isError && (
                    <>
                      {/* Feedback row */}
                      <div style={{ marginTop: 8 }}>
                        <FeedbackButton messageId={msg.id} />
                      </div>

                      {/* Incident action row — separated, prominent */}
                      {suggestsTicket(msg.text) && (
                        <div
                          style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: "1px solid var(--border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: "var(--text-primary)",
                              minWidth: 200,
                              lineHeight: 1.5,
                            }}
                          >
                            Still having trouble? You can open a support ticket.
                          </span>
                          <IncidentBtn
                            onClick={() => openIncident(msg, prevUserMsg?.text)}
                          />
                        </div>
                      )}

                      {/* At most 2 follow-up suggestions, rectangular style */}
                      <SuggestedFollowUps
                        suggestions={followUps.slice(0, 2)}
                        onSelect={(text) => send(text)}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* Thinking indicator */}
            {busy && (
              <div className="msg-fade-up" style={{ marginBottom: 16 }}>
                <ThinkingIndicator />
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
          padding: "16px 20px",
          backgroundColor: "var(--bg-main)",
        }}
      >
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div
              style={{
                borderRadius: 16,
                backgroundColor: "var(--bg-input)",
                border: `1.5px solid ${inputFocused ? "var(--border-focus)" : "var(--border-color)"}`,
                boxShadow: "var(--shadow-input)",
                minHeight: 56,
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.15s",
                overflow: "hidden",
              }}
            >
              {/* Row 1: Textarea */}
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={placeholders[placeholderIdx]}
                disabled={busy}
                rows={1}
                style={{
                  border: "none",
                  outline: "none",
                  resize: "none",
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  backgroundColor: "transparent",
                  padding: "14px 16px",
                  maxHeight: 160,
                  overflowY: "auto",
                  caretColor: "var(--accent)",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  display: "block",
                }}
              />

              {/* Row 2: Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderTop: "1px solid var(--border-subtle)",
                  flexShrink: 0,
                  flexWrap: "nowrap",
                }}
              >
                {/* Left: Paperclip attachment ghost button */}
                <button
                  type="button"
                  aria-label="Attach file"
                  onMouseEnter={() => setClipHover(true)}
                  onMouseLeave={() => setClipHover(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <Paperclip size={16} strokeWidth={1.5} color={clipHover ? "var(--accent)" : "var(--text-muted)"} />
                </button>

                {/* Right: Mic + Send */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {speechSupported && (
                    <button
                      type="button"
                      title={recording ? "Stop recording" : "Voice input"}
                      onClick={toggleRecording}
                      onMouseEnter={() => setMicHover(true)}
                      onMouseLeave={() => setMicHover(false)}
                      className={recording ? "inline-mic-pulse" : ""}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: `1.5px solid ${recording || micHover ? "var(--accent)" : "var(--border-color)"}`,
                        backgroundColor: recording ? "var(--accent)" : "transparent",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                        transition: "border-color 0.15s, background-color 0.15s",
                      }}
                    >
                      <Mic size={16} strokeWidth={1.5} color={recording ? "#FFFFFF" : micHover ? "var(--accent)" : "var(--text-secondary)"} />
                    </button>
                  )}
                  {/* Send button — always visible for touchscreen users */}
                  <button
                    type="submit"
                    disabled={inputEmpty || busy}
                    aria-label="Send message"
                    onMouseEnter={() => !inputEmpty && !busy && setSendHover(true)}
                    onMouseLeave={() => setSendHover(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor:
                        inputEmpty || busy
                          ? "var(--border-color)"
                          : sendHover
                          ? "var(--accent-hover)"
                          : "var(--accent)",
                      cursor: inputEmpty || busy ? "default" : "pointer",
                      padding: 0,
                      flexShrink: 0,
                      transition: "background-color 0.15s",
                      opacity: inputEmpty ? 0.5 : 1,
                    }}
                  >
                    <ArrowUp size={16} strokeWidth={2} color="white" />
                  </button>
                </div>
              </div>
            </div>
          </form>
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
