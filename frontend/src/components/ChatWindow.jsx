import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../api.js";
import FeedbackButton from "./FeedbackButton.jsx";
import IncidentForm from "./IncidentForm.jsx";
import BookingForm from "./BookingForm.jsx";
import MessageBubble from "./MessageBubble.jsx";
import ThinkingIndicator from "./ThinkingIndicator.jsx";
import rocheLogoBlue from "../assets/Roche_Logo_Blue.png";
import rocheLogoWhite from "../assets/Roche_Logo_White.png";
import { Paperclip, Mic, ArrowUp, ChevronRight, Phone, PhoneOff, Volume2 } from "lucide-react";
import { speak, stopSpeaking, ttsSupported } from "../lib/tts.js";

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
    bookPrompt: "Want to reserve it? Book the equipment in a few clicks.",
    bookEquipment: "Book equipment",
  },
  de: {
    labAssistant: "Labor-Assistent",
    subtitle: "Stellen Sie Fragen zu Laborabläufen, Geräten, Onboarding oder Support.",
    stillTrouble: "Haben Sie noch Probleme? Sie können ein Support-Ticket erstellen.",
    createTicket: "Support-Ticket erstellen",
    bookPrompt: "Möchten Sie es reservieren? Buchen Sie das Gerät mit wenigen Klicks.",
    bookEquipment: "Gerät buchen",
  },
  fr: {
    labAssistant: "Assistant de laboratoire",
    subtitle: "Posez vos questions sur les procédures, les équipements, l'intégration ou le support.",
    stillTrouble: "Toujours un problème ? Vous pouvez ouvrir un ticket de support.",
    createTicket: "Créer un ticket de support",
    bookPrompt: "Vous voulez le réserver ? Réservez l'équipement en quelques clics.",
    bookEquipment: "Réserver un équipement",
  },
  it: {
    labAssistant: "Assistente di laboratorio",
    subtitle: "Chiedi qualsiasi cosa su procedure, attrezzature, onboarding o supporto.",
    stillTrouble: "Hai ancora problemi? Puoi aprire un ticket di supporto.",
    createTicket: "Crea ticket di supporto",
    bookPrompt: "Vuoi prenotarlo? Prenota l'attrezzatura in pochi clic.",
    bookEquipment: "Prenota attrezzatura",
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

// Booking intent — checked against the user's message (EN/DE/FR/IT verbs).
function suggestsBooking(text) {
  const t = (text || "").toLowerCase();
  const verbs = ["book", "reserve", "reservation", "schedule the", "buchen", "reservieren", "réserver", "réservation", "prenota", "prenotare", "riservare"];
  const things = ["equipment", "centrifuge", "freezer", "pcr", "thermocycler", "microscope", "confocal", "plate reader", "fume hood", "autoclave", "mass spec", "spectrometer", "machine", "instrument", "gerät", "équipement", "attrezzatura", "microscopio", "centrifug"];
  const hasVerb = verbs.some((w) => t.includes(w));
  const hasThing = things.some((w) => t.includes(w));
  return hasVerb && hasThing;
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

const CALL_LABELS = {
  en: { title: "Voice conversation", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…", hint: "Speak naturally — I'll answer out loud. Tap to hang up.", hangup: "End call" },
  de: { title: "Sprachgespräch", listening: "Hört zu…", thinking: "Denkt nach…", speaking: "Spricht…", hint: "Sprich einfach — ich antworte laut. Tippen zum Auflegen.", hangup: "Auflegen" },
  fr: { title: "Conversation vocale", listening: "À l'écoute…", thinking: "Réflexion…", speaking: "Réponse…", hint: "Parlez naturellement — je réponds à voix haute. Touchez pour raccrocher.", hangup: "Raccrocher" },
  it: { title: "Conversazione vocale", listening: "In ascolto…", thinking: "Sto pensando…", speaking: "Sto parlando…", hint: "Parla pure — rispondo a voce. Tocca per terminare.", hangup: "Termina" },
};

export default function ChatWindow({ sessionId = "", language = "en", messages: propMessages, setMessages: propSetMessages, onOpenDocument, darkMode = false, voiceEnabled = true, voiceAutoSend = true, voiceAutoSpeak = false }) {
  const [internalMessages, setInternalMessages] = useState([]);
  const messages = propMessages !== undefined ? propMessages : internalMessages;
  const setMessages = propSetMessages !== undefined ? propSetMessages : setInternalMessages;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incidentContext, setIncidentContext] = useState(null);
  const [bookingContext, setBookingContext] = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micHover, setMicHover] = useState(false);
  const [clipHover, setClipHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  // Hands-free conversation ("call") mode.
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState("idle"); // listening | thinking | speaking
  const [callTranscript, setCallTranscript] = useState("");
  const endRef = useRef(null);
  const prevLangRef = useRef(language);
  const isFirstMount = useRef(true);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastQueryRef = useRef("");
  const lastSpokenRef = useRef(null);
  const callActiveRef = useRef(false);
  const callRecogRef = useRef(null);
  const callListenRef = useRef(null);
  const callHandleRef = useRef(null);
  // Always-current messages so the conversation loop builds correct history
  // even across re-renders (avoids stale-closure follow-ups).
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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

  // Auto-read the newest assistant answer aloud when the setting is on.
  // Skipped during a call — call mode handles its own speak→listen loop.
  useEffect(() => {
    if (!voiceAutoSpeak || callActive) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.isError) return;
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    speak(last.text, language);
  }, [messages, voiceAutoSpeak, language, callActive]);

  // Stop speech + any live call when leaving this chat.
  useEffect(
    () => () => {
      callActiveRef.current = false;
      stopSpeaking();
      try { callRecogRef.current?.stop?.(); } catch (e) {}
    },
    []
  );

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
    if (!query || busy) return null;
    lastQueryRef.current = query;

    setMessages((prev) => [
      ...prev,
      { id: genId(), role: "user", text: query, timestamp: new Date() },
    ]);
    setInput("");
    setBusy(true);

    let result = null;
    try {
      const history = buildHistory(messagesRef.current);
      const res = await sendMessage(query, language, sessionId, history);
      result = buildAssistantMsg(res);
      setMessages((prev) => [...prev, result]);
    } catch (err) {
      console.error("Chat error:", err);
      result = buildErrorMsg(err);
      setMessages((prev) => [...prev, result]);
    } finally {
      setBusy(false);
    }
    return result;
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

  // ── Hands-free conversation ("call") mode ─────────────────────────
  // Loop: listen (STT) → ask (RAG) → speak the answer (TTS) → listen again,
  // until the user hangs up. Refs hold the latest fn versions so the loop
  // never uses stale closures (current language + full history).

  function startCall() {
    if (callActiveRef.current) return;
    // Stop any one-shot mic / speech first.
    try { recognitionRef.current?.stop?.(); } catch (e) {}
    setRecording(false);
    stopSpeaking();
    callActiveRef.current = true;
    setCallActive(true);
    setCallTranscript("");
    callListenRef.current?.();
  }

  function endCall() {
    callActiveRef.current = false;
    setCallActive(false);
    setCallStatus("idle");
    setCallTranscript("");
    try { callRecogRef.current?.stop?.(); } catch (e) {}
    callRecogRef.current = null;
    stopSpeaking();
  }

  function callListen() {
    if (!callActiveRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { endCall(); return; }
    const recognition = new SR();
    recognition.lang = SPEECH_LANG[language] || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalTranscript = "";
    setCallStatus("listening");
    setCallTranscript("");

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += chunk;
        else interim += chunk;
      }
      setCallTranscript((finalTranscript + interim).trim());
    };

    recognition.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        endCall();
      }
      // no-speech / aborted are handled by onend (keep listening).
    };

    recognition.onend = () => {
      if (!callActiveRef.current) return;
      const spoken = finalTranscript.trim();
      if (spoken) {
        callHandleRef.current?.(spoken);
      } else {
        // Heard nothing — keep waiting for the user.
        setTimeout(() => { if (callActiveRef.current) callListenRef.current?.(); }, 350);
      }
    };

    callRecogRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setTimeout(() => { if (callActiveRef.current) callListenRef.current?.(); }, 500);
    }
  }

  async function callHandleTranscript(text) {
    if (!callActiveRef.current) return;
    setCallStatus("thinking");
    setCallTranscript("");
    const msg = await send(text);
    if (!callActiveRef.current) return;
    if (msg && !msg.isError && msg.text) {
      // Mark as spoken so the auto-read effect doesn't repeat it when the call ends.
      lastSpokenRef.current = msg.id;
      setCallStatus("speaking");
      speak(msg.text, language, {
        onEnd: () => { if (callActiveRef.current) callListenRef.current?.(); },
      });
    } else {
      // Error or empty answer — resume listening after a short beat.
      setTimeout(() => { if (callActiveRef.current) callListenRef.current?.(); }, 600);
    }
  }

  // Keep the refs pointing at the freshest versions every render.
  callListenRef.current = callListen;
  callHandleRef.current = callHandleTranscript;

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

  function openBooking(userText) {
    setBookingContext({ initialText: userText || "" });
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
                    language={language}
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

                      {/* Booking CTA — when the user asked to reserve equipment */}
                      {suggestsBooking(prevUserMsg?.text) && (
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
                          <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 200, lineHeight: 1.5 }}>
                            {(UI_TEXT[language] || UI_TEXT.en).bookPrompt}
                          </span>
                          <IncidentBtn
                            label={(UI_TEXT[language] || UI_TEXT.en).bookEquipment}
                            onClick={() => openBooking(prevUserMsg?.text)}
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

                {/* Right: Call + Mic + Send */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {speechSupported && voiceEnabled && ttsSupported() && (
                    <button
                      type="button"
                      title="Start a voice conversation"
                      onClick={startCall}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: "1.5px solid var(--border-color)",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
                    >
                      <Phone size={16} strokeWidth={1.5} color="var(--text-secondary)" />
                    </button>
                  )}
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

      {/* Equipment booking modal */}
      {bookingContext && (
        <BookingForm
          initialText={bookingContext.initialText}
          onClose={() => setBookingContext(null)}
        />
      )}

      {/* Voice conversation ("call") overlay */}
      {callActive && (() => {
        const cl = CALL_LABELS[language] || CALL_LABELS.en;
        const statusText =
          callStatus === "thinking" ? cl.thinking
          : callStatus === "speaking" ? cl.speaking
          : cl.listening;
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              backgroundColor: "rgba(8,15,30,0.72)",
              backdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 26,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
              {cl.title}
            </div>

            {/* Animated orb reflecting the current state */}
            <div
              className={callStatus === "speaking" ? "call-orb call-orb-speaking" : callStatus === "listening" ? "call-orb call-orb-listening" : "call-orb"}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: callStatus === "thinking" ? "rgba(255,255,255,0.12)" : "var(--accent)",
              }}
            >
              {callStatus === "speaking"
                ? <Volume2 size={40} strokeWidth={1.5} color="#FFFFFF" />
                : callStatus === "thinking"
                ? <span style={{ display: "flex", gap: 4 }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
                : <Mic size={40} strokeWidth={1.5} color="#FFFFFF" />}
            </div>

            <div style={{ fontSize: 16, fontWeight: 500, color: "#FFFFFF" }}>{statusText}</div>

            {/* Live transcript of what the user is saying */}
            <div style={{ minHeight: 24, maxWidth: 520, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {callTranscript || (callStatus === "listening" ? "" : "")}
            </div>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", maxWidth: 360, textAlign: "center" }}>{cl.hint}</div>

            {/* Hang up */}
            <button
              onClick={endCall}
              title={cl.hangup}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginTop: 6,
                padding: "12px 22px",
                borderRadius: 999,
                border: "none",
                backgroundColor: "#DC2626",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <PhoneOff size={18} strokeWidth={2} />
              {cl.hangup}
            </button>
          </div>
        );
      })()}
    </div>
  );
}
