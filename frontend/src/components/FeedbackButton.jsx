import { useState } from "react";
import { submitFeedback } from "../api.js";
import { ThumbsUp, ThumbsDown, X, Send } from "lucide-react";

const REASON_CHIPS = [
  "Wrong information",
  "Source not relevant",
  "Answer too vague",
  "Wrong language",
];

export default function FeedbackButton({ messageId, topic }) {
  const [selected, setSelected] = useState(null); // "up" | "down" | null
  const [busy, setBusy] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [commentText, setCommentText] = useState("");
  // showThanks mounts the element; thanksVisible drives opacity for a CSS fade-out.
  const [showThanks, setShowThanks] = useState(false);
  const [thanksVisible, setThanksVisible] = useState(false);

  function triggerThanks() {
    setShowThanks(true);
    setThanksVisible(true);
    setTimeout(() => setThanksVisible(false), 2000);
    setTimeout(() => setShowThanks(false), 2400);
  }

  async function rate(kind) {
    if (selected !== null || busy) return;
    setBusy(true);
    try {
      // Submit the same payload as before: messageId + rating (1 or -1),
      // plus the source SOP as topic when known (for per-topic analytics).
      await submitFeedback(messageId, kind === "up" ? 1 : -1, null, null, topic);
    } catch (e) {
      console.error("Feedback error:", e);
    } finally {
      setSelected(kind);
      setBusy(false);
      if (kind === "up") {
        triggerThanks();
      } else {
        setShowPanel(true);
      }
    }
  }

  function submitReason(reason) {
    // TODO: wire reason to /feedback once backend contract (reason, comment fields)
    // is agreed with the analytics team. Until then only log locally.
    console.log({ messageId, reason, comment: null });
    setShowPanel(false);
    setCommentText("");
    triggerThanks();
  }

  function submitComment() {
    const comment = commentText.trim();
    if (!comment) return;
    // TODO: wire comment to /feedback once backend contract (reason, comment fields)
    // is agreed with the analytics team. Until then only log locally.
    console.log({ messageId, reason: null, comment });
    setShowPanel(false);
    setCommentText("");
    triggerThanks();
  }

  function dismissPanel() {
    setShowPanel(false);
    setCommentText("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Thumbs row + transient thanks text */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <FeedbackBtn
          onClick={() => rate("up")}
          disabled={busy || selected !== null}
          active={selected === "up"}
          ariaLabel="Helpful"
        >
          <ThumbsUp
            size={16}
            strokeWidth={selected === "up" ? 2 : 1.5}
            fill={selected === "up" ? "currentColor" : "none"}
          />
        </FeedbackBtn>
        <FeedbackBtn
          onClick={() => rate("down")}
          disabled={busy || selected !== null}
          active={selected === "down"}
          ariaLabel="Not helpful"
        >
          <ThumbsDown
            size={16}
            strokeWidth={selected === "down" ? 2 : 1.5}
            fill={selected === "down" ? "currentColor" : "none"}
          />
        </FeedbackBtn>
        {showThanks && (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              opacity: thanksVisible ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            Thanks for your feedback
          </span>
        )}
      </div>

      {/* Inline reason panel — expands below thumbs on downvote, no modal */}
      {showPanel && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            padding: "12px 14px",
            marginTop: 2,
          }}
        >
          {/* Header: label + dismiss X */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
              }}
            >
              What was wrong?
            </span>
            <button
              onClick={dismissPanel}
              aria-label="Dismiss feedback panel"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                borderRadius: 6,
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Reason chips — small rectangular bordered buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {REASON_CHIPS.map((reason) => (
              <ReasonChip key={reason} label={reason} onClick={() => submitReason(reason)} />
            ))}
          </div>

          {/* Optional comment input + send */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Add a comment (optional)"
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                padding: "0 12px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-input)",
                height: 44,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={submitComment}
              aria-label="Submit comment"
              title="Submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                backgroundColor: "var(--accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Caption — always visible under the thumbs row */}
      <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
        Your feedback improves answers for all scientists.
      </span>
    </div>
  );
}

function ReasonChip({ label, onClick }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        padding: "0 12px",
        height: 44,
        minWidth: 44,
        fontSize: 12,
        fontWeight: 500,
        color: hover ? "var(--accent)" : "var(--text-secondary)",
        border: `1px solid ${hover ? "var(--accent-tint-border)" : "var(--border-color)"}`,
        borderRadius: 6,
        backgroundColor: pressed
          ? "var(--accent-tint)"
          : hover
          ? "rgba(0,102,204,0.04)"
          : "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "border-color 0.12s, color 0.12s, background-color 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function FeedbackBtn({ children, onClick, disabled, active, ariaLabel }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        border: "none",
        background: active
          ? "rgba(0,102,204,0.1)"
          : hover
          ? "var(--border-color)"
          : "transparent",
        cursor: disabled ? "default" : "pointer",
        color: active ? "var(--accent)" : hover ? "var(--text-secondary)" : "var(--text-muted)",
        borderRadius: 6,
        padding: 0,
        transition: "background 0.12s, color 0.12s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
