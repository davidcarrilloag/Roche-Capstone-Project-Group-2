import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, AlertCircle, ChevronRight } from "lucide-react";

// Inline-styled renderers — numbered lists render as proper <ol> with good spacing.
const MD_COMPONENTS = {
  p: ({ node, ...props }) => <p style={{ margin: "0 0 10px" }} {...props} />,
  ul: ({ node, ...props }) => (
    <ul style={{ margin: "6px 0 10px", paddingLeft: 22, lineHeight: 1.7 }} {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol style={{ margin: "6px 0 10px", paddingLeft: 22, lineHeight: 1.7 }} {...props} />
  ),
  li: ({ node, ...props }) => (
    <li style={{ marginBottom: 6, lineHeight: 1.6 }} {...props} />
  ),
  strong: ({ node, ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
  h1: ({ node, ...props }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 6px" }} {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 6px" }} {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 4px" }} {...props} />
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
        background: "#F3F4F6",
        padding: "1px 4px",
        borderRadius: 3,
        fontSize: 12,
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
        gap: 10,
        padding: "6px 0",
        borderRadius: 6,
        backgroundColor: hover && clickable ? "var(--accent-tint)" : "transparent",
        cursor: clickable ? "pointer" : "default",
        transition: "background-color 0.12s",
        minHeight: 44,
      }}
    >
      <FileText
        size={14}
        strokeWidth={1.5}
        color="var(--text-secondary)"
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {source.title}
        </div>
        {(source.version || source.date) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            {source.version && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  backgroundColor: "var(--border-subtle)",
                  padding: "1px 6px",
                  borderRadius: 3,
                  letterSpacing: "0.02em",
                }}
              >
                {source.version}
              </span>
            )}
            {source.date && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {source.date}
              </span>
            )}
          </div>
        )}
      </div>
      {clickable && (
        <ChevronRight
          size={14}
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
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 2,
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
export default function MessageBubble({ message, onRetry, onOpenDocument }) {
  const isUser = message.role === "user";
  const isError = message.isError === true;
  const [copied, setCopied] = useState(false);
  const [bubbleHover, setBubbleHover] = useState(false);

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
            maxWidth: "72%",
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

        {/* Copy button — visible on hover */}
        <button
          onClick={handleCopy}
          aria-label="Copy message"
          title={copied ? "Copied!" : "Copy"}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 11,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 3,
            fontFamily: "inherit",
            opacity: bubbleHover ? 1 : 0,
            transition: "opacity 0.12s",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>

        {/* Source list — attached inside bubble, below a top-border divider */}
        {message.source && (
          <SourceList
            sources={[message.source]}
            onOpenDocument={onOpenDocument}
          />
        )}
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
