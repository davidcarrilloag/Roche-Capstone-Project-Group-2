import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import ChatWindow from "../components/ChatWindow.jsx";
import { generateTitle } from "../api.js";
import { MessageSquare, Clock, FileText, Settings, Globe, RotateCcw, Search, Menu } from "lucide-react";

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

function RocheLogo({ color = "#FFFFFF" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

const BASE_NAV_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px 6px 9px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "#FFFFFF",
  fontSize: 13,
  fontFamily: "inherit",
  textAlign: "left",
  width: "100%",
  textDecoration: "none",
  lineHeight: "1.4",
};

function NavItem({ icon, label, active, onClick }) {
  const [hover, setHover] = useState(false);
  const on = active || hover;
  return (
    <button
      style={{
        ...BASE_NAV_STYLE,
        backgroundColor: on ? "rgba(0,0,0,0.15)" : "transparent",
        color: "#FFFFFF",
        borderLeft: on ? "3px solid #FFFFFF" : "3px solid transparent",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span style={{ display: "flex", color: "#FFFFFF" }}>{icon}</span>
      {label}
    </button>
  );
}

function NavLink({ icon, label, to }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      style={{
        ...BASE_NAV_STYLE,
        display: "flex",
        backgroundColor: hover ? "rgba(0,0,0,0.15)" : "transparent",
        color: "#FFFFFF",
        borderLeft: hover ? "3px solid #FFFFFF" : "3px solid transparent",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ display: "flex", color: "#FFFFFF" }}>{icon}</span>
      {label}
    </Link>
  );
}

function TopbarBtn({ children, title, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "none",
        background: "none",
        cursor: "pointer",
        color: hover ? "#0052A3" : "#0066CC",
        borderRadius: 4,
        padding: 0,
        transition: "color 0.12s",
      }}
    >
      {children}
    </button>
  );
}

// ── Session history ──────────────────────────────────────

function groupByDate(sessions) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const today = [], yesterday = [], earlier = [];
  sessions.forEach((s) => {
    const d = new Date(s.timestamp);
    if (d >= todayStart) today.push(s);
    else if (d >= yesterdayStart) yesterday.push(s);
    else earlier.push(s);
  });

  const groups = [];
  if (today.length) groups.push({ label: "Today", sessions: today });
  if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", sessions: earlier });
  return groups;
}

function SessionItem({ session, active, onClick }) {
  const [hover, setHover] = useState(false);
  const on = active || hover;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={session.title}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "5px 12px 5px 9px",
        borderRadius: 6,
        border: "none",
        borderLeft: on ? "3px solid rgba(255,255,255,0.6)" : "3px solid transparent",
        backgroundColor: on ? "rgba(0,0,0,0.12)" : "transparent",
        color: on ? "#FFFFFF" : "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: "1.6",
        transition: "background-color 0.1s, color 0.1s",
      }}
    >
      {session.title}
    </button>
  );
}

// ── Documents ────────────────────────────────────────────

const DOCUMENTS = [
  { title: "Chemical Waste Disposal SOP", category: "Safety" },
  { title: "New Employee Onboarding Guide", category: "Onboarding" },
  { title: "Equipment Maintenance Procedures", category: "Equipment" },
  { title: "Lab Consumables Ordering Guide", category: "Procurement" },
  { title: "Cold Storage Handling Protocol", category: "Storage" },
];

function DocumentCard({ title, category }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E0E0E0",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <FileText size={20} strokeWidth={1.5} color="#0066CC" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#333333", marginBottom: 4 }}>{title}</div>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            color: "#0066CC",
            backgroundColor: "#EBF3FB",
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          {category}
        </span>
      </div>
      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          fontSize: 12,
          color: hover ? "#FFFFFF" : "#0066CC",
          backgroundColor: hover ? "#0066CC" : "transparent",
          border: "1px solid #0066CC",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background-color 0.12s, color 0.12s",
        }}
      >
        View
      </button>
    </div>
  );
}

function DocumentsPanel() {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const filtered = DOCUMENTS.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", backgroundColor: "#FFFFFF" }}>
      <div style={{ padding: "32px 40px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#001F5B", margin: "0 0 4px" }}>
          Documents
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px" }}>
          Browse and search documentation
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${searchFocused ? "#0066CC" : "#E0E0E0"}`,
            borderRadius: 8,
            padding: "0 12px",
            height: 40,
            backgroundColor: "#F5F5F5",
            marginBottom: 24,
            maxWidth: 480,
            transition: "border-color 0.15s",
          }}
        >
          <Search size={15} strokeWidth={1.5} color="#9CA3AF" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search documents..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 13,
              fontFamily: "inherit",
              color: "#333333",
              backgroundColor: "transparent",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          {filtered.length > 0 ? (
            filtered.map((doc) => (
              <DocumentCard key={doc.title} title={doc.title} category={doc.category} />
            ))
          ) : (
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>No documents match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root component ───────────────────────────────────────

export default function Chat() {
  const [language, setLanguage] = useState("en");
  const [toastDismissed, setToastDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Session state — messages are stored here and passed down to ChatWindow
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => genId());
  const titledSessions = useRef(new Set());

  useEffect(() => {
    const browserLang = navigator.language || "";
    if (browserLang.toLowerCase().startsWith("de") && !toastDismissed) {
      setLanguage("de");
      setToastDismissed(true);
    }
  }, []);

  // Generate an AI summary title after the first complete exchange
  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || titledSessions.current.has(session.id)) return;

    const hasUser = session.messages.some((m) => m.role === "user" && !m.isSystemDivider);
    const hasAssistant = session.messages.some((m) => m.role === "assistant" && !m.isSystemDivider);
    if (!hasUser || !hasAssistant) return;

    titledSessions.current.add(session.id);

    const payload = session.messages
      .filter((m) => !m.isSystemDivider && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, text: m.text }));

    generateTitle(payload)
      .then((data) => {
        if (!data.title) return;
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === session.id);
          if (idx < 0) return prev;
          return [...prev.slice(0, idx), { ...prev[idx], title: data.title }, ...prev.slice(idx + 1)];
        });
      })
      .catch(() => {});
  }, [sessions, activeSessionId]);

  function toggleLanguage() {
    setLanguage((l) => (l === "en" ? "de" : "en"));
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeMessages = activeSession?.messages ?? [];

  // Passed to ChatWindow — mirrors the React setState signature
  function setActiveMessages(updater) {
    setSessions((prev) => {
      const current = prev.find((s) => s.id === activeSessionId);
      const currentMsgs = current?.messages ?? [];
      const newMsgs = typeof updater === "function" ? updater(currentMsgs) : updater;

      const firstUser = newMsgs.find((m) => m.role === "user");
      const title = firstUser
        ? firstUser.text.length > 45
          ? firstUser.text.slice(0, 42) + "..."
          : firstUser.text
        : "New chat";

      const updated = {
        id: activeSessionId,
        title,
        messages: newMsgs,
        timestamp: current?.timestamp ?? new Date(),
      };
      const idx = prev.findIndex((s) => s.id === activeSessionId);
      if (idx >= 0) return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      return [...prev, updated];
    });
  }

  function startNewChat() {
    setActiveSessionId(genId());
    setActiveTab("chat");
  }

  function loadSession(sessionId) {
    setActiveSessionId(sessionId);
    setActiveTab("chat");
  }

  const savedSessions = sessions.filter((s) => s.messages.some((m) => m.role === "user"));
  const sessionGroups = groupByDate(savedSessions);
  const hasHistory = sessionGroups.length > 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── Sidebar ───────────────────────────────── */}
      <aside
        style={{
          width: sidebarOpen ? 240 : 0,
          flexShrink: 0,
          backgroundColor: "#0066CC",
          borderRight: "1px solid #004FA3",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.22s ease",
        }}
      >
        {/* Inner wrapper keeps content at full 240px even while animating */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "16px 12px",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 12, flexShrink: 0 }}>
            <RocheLogo color="#FFFFFF" />
            <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>Lab Assistant</span>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 8, flexShrink: 0 }} />

          {/* Primary nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            <NavItem
              icon={<MessageSquare size={16} strokeWidth={1.5} />}
              label="New chat"
              active={activeTab === "chat" && !activeMessages.some((m) => m.role === "user")}
              onClick={startNewChat}
            />
            <NavLink icon={<Clock size={16} strokeWidth={1.5} />} label="History" to="/dashboard" />
            <NavItem
              icon={<FileText size={16} strokeWidth={1.5} />}
              label="Documents"
              active={activeTab === "documents"}
              onClick={() => setActiveTab("documents")}
            />
          </nav>

          {/* Chat history list — scrollable, fills remaining space */}
          {hasHistory && (
            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "8px 0", flexShrink: 0 }} />
          )}
          <div
            className="chat-scroll"
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
          >
            {sessionGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "8px 12px 3px",
                  }}
                >
                  {group.label}
                </div>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionId && activeTab === "chat"}
                    onClick={() => loadSession(session.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Bottom nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 8 }} />
            <NavItem icon={<Settings size={16} strokeWidth={1.5} />} label="Settings" />
            <NavItem
              icon={<Globe size={16} strokeWidth={1.5} />}
              label={language.toUpperCase()}
              onClick={toggleLanguage}
            />
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          minWidth: 0,
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: 48,
            flexShrink: 0,
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E0E0E0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TopbarBtn
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <Menu size={16} strokeWidth={1.5} />
            </TopbarBtn>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#001F5B" }}>
              {activeTab === "documents" ? "Documents" : "Chat"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TopbarBtn
              title={`Switch to ${language === "en" ? "DE" : "EN"}`}
              onClick={toggleLanguage}
            >
              <Globe size={16} strokeWidth={1.5} />
            </TopbarBtn>
            <TopbarBtn title="New chat" onClick={startNewChat}>
              <RotateCcw size={16} strokeWidth={1.5} />
            </TopbarBtn>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "documents" ? (
            <DocumentsPanel />
          ) : (
            <ChatWindow
              key={activeSessionId}
              language={language}
              messages={activeMessages}
              setMessages={setActiveMessages}
            />
          )}
        </div>
      </main>
    </div>
  );
}
