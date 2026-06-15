import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, AlertCircle, ChevronRight, Volume2, Square } from "lucide-react";
import { ttsSupported, speak, stopSpeaking } from "../lib/tts.js";

// Inline-styled renderers for readable, scannable answers. listStyleType is set
// explicitly so bullet dots / numbers always show regardless of CSS resets.
const MD_COMPONENTS = {
  p: ({ node, ...props }) => (
    <p style={{ margin: "0 0 10px", lineHeight: 1.6 }} {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul
      style={{
        margin: "6px 0 12px",
        paddingLeft: 20,
        listStyleType: "disc",
        listStylePosition: "outside",
      }}
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      style={{
        margin: "6px 0 12px",
        paddingLeft: 22,
        listStyleType: "decimal",
        listStylePosition: "outside",
      }}
      {...props}
    />
  ),
  li: ({ node, ...props }) => (
    <li style={{ margin: "0 0 6px", paddingLeft: 4, lineHeight: 1.55 }} {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong style={{ fontWeight: 600, color: "var(--text-primary)" }} {...props} />
  ),
  em: ({ node, ...props }) => <em style={{ fontStyle: "italic" }} {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      style={{
        margin: "10px 0",
        padding: "8px 12px",
        borderLeft: "3px solid var(--accent, #0066CC)",
        background: "var(--accent-tint, #EBF3FB)",
        borderRadius: "0 6px 6px 0",
        color: "var(--text-secondary)",
        fontSize: 13,
      }}
      {...props}
    />
  ),
  hr: ({ node, ...props }) => (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--border-color, #E0E0E0)",
        margin: "12px 0",
      }}
      {...props}
    />
  ),
  h1: ({ node, ...props }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "12px 0 6px" }} {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "12px 0 6px" }} {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 style={{ fontSize: 13, fontWeight: 600, margin: "10px 0 4px" }} {...props} />
  ),
  a: ({ node, ...props }) => (
    <a
      style={{ color: "var(--accent, #0066CC)" }}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ node, ...props }) => (
    <code
      style={{
        background: "var(--border-subtle, #F3F4F6)",
        padding: "1px 5px",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "ui-monospace, monospace",
      }}
      {...props}
    />
  ),
};

function Markdown({ children }) {
  return <ReactMarkdown components={MD_COMPONENTS}>{children}</ReactMarkdown>;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Single source row — FileText icon, title, version tag, date, ChevronRight.
function SourceItem({ source, onOpenDocument }) {
  const [hover, setHover] = useState(false);
  if (!source || !source.title) return null;

  const clickable = typeof onOpenDocument === "function";

  function handleClick() {
    if (clickable) {
      onOpenDocument(source);
    }
    // TODO: open the specific document within DocumentsPanel once it exposes
    // a controlled selection API (currently its openDoc state is internal).
  }

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && handleClick() : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 4px",
        borderRadius: 5,
        backgroundColor: hover && clickable ? "var(--accent-tint)" : "transparent",
        cursor: clickable ? "pointer" : "default",
        transition: "background-color 0.12s",
      }}
    >
      <FileText
        size={12}
        strokeWidth={1.5}
        color="var(--text-muted)"
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {source.title}
        </span>
        {source.version && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-muted)",
              backgroundColor: "var(--border-subtle)",
              padding: "0px 5px",
              borderRadius: 3,
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            {source.version}
          </span>
        )}
        {source.date && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
            {source.date}
          </span>
        )}
      </div>
      {clickable && (
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          color={hover ? "var(--accent)" : "var(--text-muted)"}
          style={{ flexShrink: 0, transition: "color 0.12s" }}
        />
      )}
    </div>
  );
}

// Source list — rendered inside the assistant bubble with a top-border divider.
// Accepts an array so multiple sources can stack; label switches to "SOURCES" for >1.
function SourceList({ sources, onOpenDocument }) {
  const valid = (sources || []).filter((s) => s && s.title);
  if (valid.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 1,
        }}
      >
        {valid.length === 1 ? "SOURCE" : "SOURCES"}
      </div>
      {valid.map((source, idx) => (
        <SourceItem
          key={source.title + idx}
          source={source}
          onOpenDocument={onOpenDocument}
        />
      ))}
    </div>
  );
}

// Subtle amber error card — no red alarm. Raw API errors never shown in the friendly message.
function ErrorCard({ onRetry, errorDetail }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        border: "1px solid #D6B96B",
        backgroundColor: "#FFFCF0",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <AlertCircle
          size={16}
          strokeWidth={1.5}
          color="#92710B"
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <span style={{ fontSize: 13, color: "#5C4606", lineHeight: 1.6 }}>
          Something went wrong while getting your answer.
        </span>
      </div>
      {/* TODO: remove this technical detail line behind a flag before the final demo */}
      {errorDetail && (
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {errorDetail}
        </span>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          autoFocus
          style={{
            alignSelf: "flex-start",
            padding: "8px 18px",
            minHeight: 44,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid #92710B",
            borderRadius: 6,
            backgroundColor: hover ? "#92710B" : "transparent",
            color: hover ? "#FFFFFF" : "#92710B",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background-color 0.12s, color 0.12s",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Renders message body. Steps and plain both go through Markdown so numbered
// lists display correctly. Action type additionally renders a CTA link.
function MessageContent({ message }) {
  const { text, responseType = "plain", actionLabel, actionUrl } = message;

  const body = (
    <div style={{ lineHeight: 1.6 }}>
      <Markdown>{text}</Markdown>
    </div>
  );

  if (responseType === "action") {
    return (
      <div>
        {body}
        {actionLabel && (
          <a
            href={actionUrl ?? "#"}
            target={actionUrl ? "_blank" : "_self"}
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "6px 12px",
              fontSize: 12,
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--accent)",
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            {actionLabel}
          </a>
        )}
      </div>
    );
  }

  return body;
}

// Props:
//   message      – message object (role, text, isError, errorDetail, source, confidence, …)
//   onRetry      – () => void — passed only for isError messages
//   onOpenDocument – (source) => void — opens document in Documents tab
export default function MessageBubble({ message, onRetry, onOpenDocument, language = "en" }) {
  const isUser = message.role === "user";
  const isError = message.isError === true;
  const [copied, setCopied] = useState(false);
  const [bubbleHover, setBubbleHover] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = ttsSupported();

  // Stop speech if this bubble unmounts while talking.
  useEffect(() => () => { if (speaking) stopSpeaking(); }, [speaking]);

  function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speak(message.text, language, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }

  const showConfidenceWarning =
    !isUser &&
    !isError &&
    typeof message.confidence === "number" &&
    message.confidence < 0.6;

  function handleCopy() {
    navigator.clipboard?.writeText(message.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── User bubble ──────────────────────────────────────────
  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            backgroundColor: "var(--bubble-user-bg)",
            color: "var(--bubble-user-text)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            maxWidth: "60%",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  // ── Error card ───────────────────────────────────────────
  if (isError) {
    return <ErrorCard onRetry={onRetry} errorDetail={message.errorDetail} />;
  }

  // ── Assistant bubble ─────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Low-confidence warning */}
      {showConfidenceWarning && (
        <div
          style={{
            borderLeft: "2px solid #F59E0B",
            backgroundColor: "#FFFBEB",
            padding: "8px 12px",
            marginBottom: 8,
            borderRadius: "0 4px 4px 0",
            fontSize: 12,
            color: "#92400E",
            lineHeight: 1.5,
          }}
        >
          Limited information found — please verify with your team lead or check the full SOP documentation.
        </div>
      )}

      {/* Flat bubble — border only, no shadow (Linear-style) */}
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bubble-bot-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 10,
          padding: "14px 18px",
          fontSize: 13,
          color: "var(--bubble-bot-text)",
          lineHeight: 1.5,
        }}
        onMouseEnter={() => setBubbleHover(true)}
        onMouseLeave={() => setBubbleHover(false)}
      >
        <MessageContent message={message} />

        {/* Source list — attached inside bubble, below a top-border divider */}
        {message.source && (
          <SourceList
            sources={[message.source]}
            onOpenDocument={onOpenDocument}
          />
        )}

        {/* Action row — bottom-right: read aloud + copy */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 2,
            marginTop: 10,
          }}
        >
          {canSpeak && (
            <button
              onClick={toggleSpeak}
              aria-label={speaking ? "Stop reading" : "Read aloud"}
              title={speaking ? "Stop" : "Read aloud"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 24,
                color: speaking ? "var(--accent)" : "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderRadius: 5,
                fontFamily: "inherit",
                transition: "color 0.12s, background-color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--border-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {speaking ? <Square size={13} strokeWidth={2} /> : <Volume2 size={15} strokeWidth={1.75} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy message"
            title={copied ? "Copied!" : "Copy"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              height: 24,
              padding: "0 8px",
              fontSize: 11,
              color: copied ? "var(--accent)" : "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 5,
              fontFamily: "inherit",
              transition: "color 0.12s, background-color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--border-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Timestamp */}
      {message.timestamp && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 4,
            paddingLeft: 2,
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      )}
    </div>
  );
}
