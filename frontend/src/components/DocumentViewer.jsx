import { useState, useRef, useEffect } from "react";
import { ArrowLeft, X, ArrowUp } from "lucide-react";
import { sendMessage } from "../api.js";

function RocheLogo({ color = "#FFFFFF" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="22" height="22" aria-hidden="true">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

function MiniChat({ doc, language, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: genId(),
      role: "assistant",
      text: `Hi! I can answer questions about "${doc.title}". What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const query = input.trim();
    if (!query || busy) return;
    setMessages((prev) => [...prev, { id: genId(), role: "user", text: query }]);
    setInput("");
    setBusy(true);
    try {
      const res = await sendMessage(
        `Regarding the document "${doc.title}": ${query}`,
        language
      );
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          text: res.answer ?? res.message ?? "No response received.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="msg-fade-up"
      style={{
        position: "absolute",
        bottom: 90,
        left: "50%",
        transform: "translateX(-50%)",
        width: 360,
        height: 420,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E0E0E0",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #E0E0E0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderRadius: "16px 16px 0 0",
          backgroundColor: "#FAFAFA",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#001F5B" }}>Ask AI</div>
          <div
            style={{
              fontSize: 11,
              color: "#6B7280",
              marginTop: 1,
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.title}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9CA3AF",
            padding: 4,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#333333")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="chat-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="msg-fade-up"
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                backgroundColor: msg.role === "user" ? "#0066CC" : "#F5F5F5",
                color: msg.role === "user" ? "#FFFFFF" : "#333333",
                borderLeft: msg.role === "assistant" ? "3px solid #0066CC" : "none",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                lineHeight: 1.6,
                maxWidth: "85%",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="msg-fade-up" style={{ display: "flex" }}>
            <div
              style={{
                backgroundColor: "#F5F5F5",
                borderLeft: "3px solid #0066CC",
                borderRadius: 8,
                padding: "8px 12px",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
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

      {/* Input */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid #E0E0E0",
          flexShrink: 0,
          borderRadius: "0 0 16px 16px",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Ask about this document..."
            disabled={busy}
            style={{
              flex: 1,
              border: `1px solid ${inputFocused ? "#0066CC" : "#E0E0E0"}`,
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              color: "#333333",
              backgroundColor: "#FAFAFA",
              transition: "border-color 0.15s",
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "none",
              backgroundColor: "#0066CC",
              cursor: input.trim() && !busy ? "pointer" : "default",
              opacity: input.trim() && !busy ? 1 : 0.35,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "opacity 0.15s",
            }}
          >
            <ArrowUp size={13} strokeWidth={2} color="white" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DocumentViewer({ doc, language, onBack }) {
  const [miniChatOpen, setMiniChatOpen] = useState(false);

  return (
    <div
      className="doc-slide-in"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 40px 0", flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#0066CC",
            fontSize: 13,
            fontFamily: "inherit",
            padding: 0,
            marginBottom: 16,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Back to Documents
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1
              style={{ fontSize: 20, fontWeight: 600, color: "#001F5B", margin: "0 0 8px" }}
            >
              {doc.title}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#0066CC",
                  backgroundColor: "#EBF3FB",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {doc.category}
              </span>
              {doc.version && (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{doc.version}</span>
              )}
              {doc.lastUpdated && (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                  Updated {doc.lastUpdated}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{ height: 1, backgroundColor: "#E0E0E0", margin: "20px 0 0" }}
        />
      </div>

      {/* Document content */}
      <div
        className="chat-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "24px 40px 120px" }}
      >
        {(doc.content || []).map((section, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#001F5B",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {section.heading}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#333333",
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {section.text}
            </p>
          </div>
        ))}
      </div>

      {/* Floating AI button */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {!miniChatOpen && (
          <span
            className="chip-fade-up"
            style={{
              fontSize: 11,
              color: "#6B7280",
              backgroundColor: "rgba(255,255,255,0.9)",
              borderRadius: 8,
              padding: "3px 8px",
              border: "1px solid #E0E0E0",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            Ask AI about this doc
          </span>
        )}
        <button
          onClick={() => setMiniChatOpen((o) => !o)}
          title="Ask AI about this document"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "none",
            backgroundColor: miniChatOpen ? "#004FA3" : "#0066CC",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: miniChatOpen
              ? "0 4px 16px rgba(0,79,163,0.45)"
              : "0 4px 16px rgba(0,102,204,0.35)",
            transition: "background-color 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = miniChatOpen ? "#003D82" : "#0052A3";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,102,204,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = miniChatOpen ? "#004FA3" : "#0066CC";
            e.currentTarget.style.boxShadow = miniChatOpen
              ? "0 4px 16px rgba(0,79,163,0.45)"
              : "0 4px 16px rgba(0,102,204,0.35)";
          }}
        >
          <RocheLogo color="#FFFFFF" />
        </button>
      </div>

      {/* Mini chat panel */}
      {miniChatOpen && (
        <MiniChat
          doc={doc}
          language={language}
          onClose={() => setMiniChatOpen(false)}
        />
      )}
    </div>
  );
}
