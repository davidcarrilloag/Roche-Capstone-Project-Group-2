import { useState } from "react";
import ReactMarkdown from "react-markdown";

// Inline-styled renderers so Markdown (bold, bullets, headings) displays nicely
// without depending on global CSS.
const MD_COMPONENTS = {
  p: ({ node, ...props }) => <p style={{ margin: "0 0 8px" }} {...props} />,
  ul: ({ node, ...props }) => (
    <ul style={{ margin: "4px 0 8px", paddingLeft: 20 }} {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol style={{ margin: "4px 0 8px", paddingLeft: 20 }} {...props} />
  ),
  li: ({ node, ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
  strong: ({ node, ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
  h1: ({ node, ...props }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }} {...props} />,
  h2: ({ node, ...props }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }} {...props} />,
  h3: ({ node, ...props }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 4px" }} {...props} />,
  a: ({ node, ...props }) => (
    <a style={{ color: "var(--accent, #0066CC)" }} target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node, ...props }) => (
    <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3, fontSize: 12 }} {...props} />
  ),
};

function Markdown({ children }) {
  return <ReactMarkdown components={MD_COMPONENTS}>{children}</ReactMarkdown>;
}

const LONG_THRESHOLD = 280;

function isLongText(text) {
  return text.length > LONG_THRESHOLD || (text.match(/\n/g) || []).length > 3;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SourceCitation({ source }) {
  if (!source || !source.title) return null;
  const parts = [source.title, source.version, source.date].filter(Boolean);
  const label = parts.join(" · ");

  const baseStyle = {
    fontSize: 11,
    color: "var(--text-secondary)",
    marginTop: 6,
    display: "inline-block",
    fontFamily: "inherit",
  };

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...baseStyle, textDecoration: "none" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
      >
        {label} ↗
      </a>
    );
  }

  return <span style={baseStyle}>{label}</span>;
}

function ShowMoreToggle({ expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "block",
        marginTop: 8,
        fontSize: 12,
        color: "var(--accent)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      {expanded ? "Show less" : "Show more"}
    </button>
  );
}

function MessageContent({ message, expanded, onToggle, long }) {
  const { text, responseType = "plain", actionLabel, actionUrl } = message;

  const clampStyle =
    !expanded && long
      ? { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }
      : {};

  const textEl = (
    <div style={{ lineHeight: 1.6, ...clampStyle }}>
      <Markdown>{text}</Markdown>
    </div>
  );

  if (responseType === "steps") {
    const lines = text.split("\n").filter(Boolean);
    return (
      <div>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: "7px 0",
              borderBottom: i < lines.length - 1 ? "1px solid var(--border-color)" : "none",
              lineHeight: 1.6,
            }}
          >
            {line}
          </div>
        ))}
        {long && <ShowMoreToggle expanded={expanded} onToggle={onToggle} />}
      </div>
    );
  }

  if (responseType === "action") {
    return (
      <div>
        {textEl}
        {long && <ShowMoreToggle expanded={expanded} onToggle={onToggle} />}
        {actionLabel && (
          <a
            href={actionUrl ?? "#"}
            target={actionUrl ? "_blank" : "_self"}
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "4px 10px",
              fontSize: 12,
              border: "1px solid var(--accent)",
              borderRadius: 4,
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

  return (
    <>
      {textEl}
      {long && <ShowMoreToggle expanded={expanded} onToggle={onToggle} />}
    </>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bubbleHover, setBubbleHover] = useState(false);

  const long = !isUser && isLongText(message.text);
  const showConfidenceWarning =
    !isUser &&
    typeof message.confidence === "number" &&
    message.confidence < 0.6;

  function handleCopy() {
    navigator.clipboard?.writeText(message.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            backgroundColor: "var(--bubble-user-bg)",
            color: "var(--bubble-user-text)",
            borderRadius: 18,
            padding: "14px 18px",
            fontSize: 13,
            maxWidth: "70%",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Confidence warning */}
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

      {/* Bot bubble */}
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bubble-bot-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 18,
          boxShadow: "var(--shadow-card)",
          padding: "14px 18px",
          fontSize: 13,
          color: "var(--bubble-bot-text)",
          lineHeight: 1.5,
          maxWidth: "75%",
        }}
        onMouseEnter={() => setBubbleHover(true)}
        onMouseLeave={() => setBubbleHover(false)}
      >
        <MessageContent
          message={message}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
          long={long}
        />

        {/* Copy button — visible on bubble hover */}
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
      </div>

      {/* Source citation */}
      <SourceCitation source={message.source} />

      {/* Timestamp */}
      {message.timestamp && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      )}
    </div>
  );
}
