import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../api.js";
import FeedbackButton from "./FeedbackButton.jsx";
import IncidentForm from "./IncidentForm.jsx";
import MessageBubble from "./MessageBubble.jsx";
import ThinkingIndicator from "./ThinkingIndicator.jsx";
import rocheLogoBlue from "../assets/Roche_Logo_Blue.png";
import rocheLogoWhite from "../assets/Roche_Logo_White.png";
import { Paperclip, Mic, ArrowUp, ChevronRight } from "lucide-react";

const WELCOME_SHORTCUTS = {
  en: [
    "What trainings do I need as a new employee?",
    "How do I order lab consumables?",
    "Waste disposal procedure for chemical waste",
    "How do I file an IT support ticket?",
  ],
  de: [
    "Welche Schulungen benötige ich als neuer Mitarbeiter?",
    "Wie bestelle ich Laborverbrauchsmaterialien?",
    "Entsorgungsverfahren für Chemikalienabfälle",
    "Wie reiche ich ein IT-Support-Ticket ein?",
  ],
  fr: [
    "De quelles formations ai-je besoin en tant que nouvel employé ?",
    "Comment commander des consommables de laboratoire ?",
    "Procédure d'élimination des déchets chimiques",
    "Comment ouvrir un ticket de support informatique ?",
  ],
  it: [
    "Di quali formazioni ho bisogno come nuovo dipendente?",
    "Come ordino i materiali di consumo da laboratorio?",
    "Procedura di smaltimento dei rifiuti chimici",
    "Come apro un ticket di supporto IT?",
  ],
};

const UI_TEXT = {
  en: {
    labAssistant: "Lab Assistant",
    subtitle: "Ask anything about lab procedures, equipment, onboarding, or support.",
    stillTrouble: "Still having trouble? You can open a support ticket.",
    createTicket: "Create support ticket",
  },
  de: {
    labAssistant: "Labor-Assistent",
    subtitle: "Stellen Sie Fragen zu Laborabläufen, Geräten, Onboarding oder Support.",
    stillTrouble: "Haben Sie noch Probleme? Sie können ein Support-Ticket erstellen.",
    createTicket: "Support-Ticket erstellen",
  },
  fr: {
    labAssistant: "Assistant de laboratoire",
    subtitle: "Posez vos questions sur les procédures, les équipements, l'intégration ou le support.",
    stillTrouble: "Toujours un problème ? Vous pouvez ouvrir un ticket de support.",
    createTicket: "Créer un ticket de support",
  },
  it: {
    labAssistant: "Assistente di laboratorio",
    subtitle: "Chiedi qualsiasi cosa su procedure, attrezzature, onboarding o supporto.",
    stillTrouble: "Hai ancora problemi? Puoi aprire un ticket di supporto.",
    createTicket: "Crea ticket di supporto",
  },
};

const PLACEHOLDERS = {
  en: [
    "Try: how do I return expired reagents?",
    "Try: what PPE is required in my lab area?",
    "Try: how do I request cold storage access?",
  ],
  de: [
    "Wie gehe ich mit abgelaufenen Reagenzien um?",
    "Welche PSA ist in meinem Laborbereich erforderlich?",
    "Wie beantrage ich Zugang zur Kühllagerung?",
  ],
  fr: [
    "Comment retourner des réactifs périmés ?",
    "Quel EPI est requis dans ma zone de laboratoire ?",
    "Comment demander l'accès au stockage au froid ?",
  ],
  it: [
    "Come restituisco i reagenti scaduti?",
    "Quali DPI sono richiesti nella mia area di laboratorio?",
    "Come richiedo l'accesso alla conservazione a freddo?",
  ],
};

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

// Map prior chat turns to the compact {role, text} history the backend uses
// for follow-up context.
function buildHistory(messages) {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        !m.isError &&
        !m.isSystemDivider &&
        m.text
    )
    .map((m) => ({ role: m.role, text: String(m.text) }))
    .slice(-8);
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
    keywords_de: ["abfall", "entsorgung", "chemisch", "gefährlich", "chemikalien"],
    suggestions: [
      "What containers are required for chemical waste?",
      "Who do I contact for waste pickup?",
      "Are there separate bins for biological waste?",
    ],
    suggestions_de: [
      "Welche Behälter werden für Chemikalienabfälle benötigt?",
      "Wen kontaktiere ich für die Abfallabholung?",
      "Gibt es separate Behälter für biologischen Abfall?",
    ],
  },
  {
    keywords: ["consumables", "order", "ordering", "procurement", "purchase"],
    keywords_de: ["verbrauchsmaterial", "bestell", "beschaffung", "einkauf", "lieferung"],
    suggestions: [
      "How long does delivery take?",
      "What is the budget approval process?",
      "Can I order from external suppliers?",
    ],
    suggestions_de: [
      "Wie lange dauert die Lieferung?",
      "Wie läuft der Budgetgenehmigungsprozess ab?",
      "Kann ich bei externen Lieferanten bestellen?",
    ],
  },
  {
    keywords: ["equipment", "maintenance", "broken", "repair", "device", "instrument"],
    keywords_de: ["gerät", "wartung", "defekt", "reparatur", "instrument", "kalibrierung", "ausrüstung"],
    suggestions: [
      "Who is responsible for equipment maintenance?",
      "How do I report a broken device?",
      "What is the calibration schedule?",
    ],
    suggestions_de: [
      "Wer ist für die Gerätewartung zuständig?",
      "Wie melde ich ein defektes Gerät?",
      "Wie ist der Kalibrierungsplan?",
    ],
  },
  {
    keywords: ["onboarding", "new employee", "training", "orientation"],
    keywords_de: ["einarbeitung", "neuer mitarbeiter", "schulung", "einführung", "ausbildung"],
    suggestions: [
      "What safety trainings are mandatory?",
      "How do I get lab access?",
      "Who is my assigned onboarding buddy?",
    ],
    suggestions_de: [
      "Welche Sicherheitsschulungen sind Pflicht?",
      "Wie erhalte ich Laborzugang?",
      "Wer ist mein zugewiesener Onboarding-Buddy?",
    ],
  },
  {
    keywords: ["storage", "cold", "freezer", "refrigerat", "temperature"],
    keywords_de: ["lagerung", "kühl", "gefrier", "kühlschrank", "temperatur", "kühllagerung"],
    suggestions: [
      "What are the temperature requirements?",
      "How do I log cold storage incidents?",
      "What happens if temperature goes out of range?",
    ],
    suggestions_de: [
      "Welche Temperaturanforderungen gelten?",
      "Wie melde ich Vorfälle in der Kühllagerung?",
      "Was passiert, wenn die Temperatur außerhalb des Bereichs liegt?",
    ],
  },
  {
    keywords: ["ticket", "incident", "servicenow", "support", "it support"],
    keywords_de: ["ticket", "vorfall", "incident", "support", "servicenow"],
    suggestions: [
      "What information is needed to open a ticket?",
      "How do I check my ticket status?",
      "What is the typical response time?",
    ],
    suggestions_de: [
      "Welche Informationen werden für ein Ticket benötigt?",
      "Wie kann ich meinen Ticketstatus prüfen?",
      "Wie lange ist die typische Reaktionszeit?",
    ],
  },
  {
    keywords: ["safety", "ppe", "protective", "gloves", "goggles", "emergency"],
    keywords_de: ["sicherheit", "psa", "schutzausrüstung", "handschuhe", "schutzbrille", "notfall"],
    suggestions: [
      "Where is the nearest safety shower?",
      "What PPE is required in my lab area?",
      "How do I report a safety incident?",
    ],
    suggestions_de: [
      "Wo befindet sich die nächste Sicherheitsdusche?",
      "Welche PSA ist in meinem Laborbereich erforderlich?",
      "Wie melde ich einen Sicherheitsvorfall?",
    ],
  },
  {
    keywords: ["access", "badge", "door", "permission", "login", "password"],
    keywords_de: ["zugang", "zugriff", "badge", "tür", "berechtigung", "anmeldung", "passwort", "ausgesperrt"],
    suggestions: [
      "How do I request additional access?",
      "Who approves access requests?",
      "What do I do if I'm locked out?",
    ],
    suggestions_de: [
      "Wie beantrage ich zusätzlichen Zugang?",
      "Wer genehmigt Zugriffsanfragen?",
      "Was tue ich, wenn ich ausgesperrt bin?",
    ],
  },
];

function suggestFollowUps(text, language = "en") {
  const t = text.toLowerCase();
  const seen = new Set();
  const results = [];
  const isDE = language === "de";
  for (const rule of FOLLOW_UP_RULES) {
    const keywords = isDE ? [...rule.keywords, ...(rule.keywords_de || [])] : rule.keywords;
    const suggestions = isDE ? (rule.suggestions_de || rule.suggestions) : rule.suggestions;
    if (keywords.some((kw) => t.includes(kw))) {
      for (const s of suggestions) {
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

function IncidentBtn({ onClick, label }) {
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
      {label}
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

export default function ChatWindow({ sessionId = "", language = "en", messages: propMessages, setMessages: propSetMessages, onOpenDocument, darkMode = false, voiceEnabled = true, voiceAutoSend = true }) {
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
  const placeholders = PLACEHOLDERS[language] || PLACEHOLDERS.en;

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
      const SWITCH_TEXT = {
        en: "─── Switched to English ───",
        de: "─── Auf Deutsch gewechselt ───",
        fr: "─── Passé en français ───",
        it: "─── Passato all'italiano ───",
      };
      const text = SWITCH_TEXT[language] || SWITCH_TEXT.en;
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
      const history = buildHistory(messages);
      const res = await sendMessage(query, language, sessionId, history);
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
      const history = buildHistory(messages.filter((m) => !m.isError));
      const res = await sendMessage(query, language, sessionId, history);
      setMessages((prev) => [...prev, buildAssistantMsg(res)]);
    } catch (err) {
      console.error("Retry error:", err);
      setMessages((prev) => [...prev, buildErrorMsg(err)]);
    } finally {
      setBusy(false);
    }
  }

  const SPEECH_LANG = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT" };

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    // Recognise in the user's selected language (EN/DE/FR/IT).
    recognition.lang = SPEECH_LANG[language] || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true; // stream words into the box as you speak
    recognition.maxAlternatives = 1;

    // Keep whatever was already typed and append the speech to it.
    const base = input ? input.trim() + " " : "";
    let finalTranscript = "";

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += chunk;
        else interim += chunk;
      }
      // Live preview: settled words + the in-progress phrase.
      setInput(base + finalTranscript + interim);
    };

    recognition.onend = () => {
      setRecording(false);
      const spoken = finalTranscript.trim();
      if (spoken) {
        const full = (base + spoken).trim();
        setInput(full);
        // Auto-send once you stop speaking, unless the user prefers to edit first.
        if (voiceAutoSend) send(full);
      }
    };

    recognition.onerror = (e) => {
      setRecording(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: "system",
            text: "🎤 Microphone access is blocked. Allow it in your browser to use voice input.",
            isSystemDivider: true,
            timestamp: new Date(),
          },
        ]);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setRecording(false);
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
                {(UI_TEXT[language] || UI_TEXT.en).labAssistant}
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
                {(UI_TEXT[language] || UI_TEXT.en).subtitle}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(WELCOME_SHORTCUTS[language] || WELCOME_SHORTCUTS.en).map((text) => (
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

              const followUps = isLastAssistant ? suggestFollowUps(msg.text, language) : [];

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
                        <FeedbackButton messageId={msg.id} topic={msg.source?.title} />
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
                            {(UI_TEXT[language] || UI_TEXT.en).stillTrouble}
                          </span>
                          <IncidentBtn
                            label={(UI_TEXT[language] || UI_TEXT.en).createTicket}
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
                  {speechSupported && voiceEnabled && (
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
