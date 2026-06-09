import { useState } from "react";
import { submitFeedback } from "../api.js";
import { ThumbsUp, ThumbsDown } from "lucide-react";

export default function FeedbackButton({ messageId }) {
  const [selected, setSelected] = useState(null); // "up" | "down" | null
  const [busy, setBusy] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");

  async function rate(kind) {
    if (selected !== null || busy) return;
    setBusy(true);
    try {
      await submitFeedback(messageId, kind === "up" ? 1 : -1);
    } catch (e) {
      console.error("Feedback error:", e);
    } finally {
      setSelected(kind);
      setBusy(false);
      console.log("Feedback submitted:", { messageId, kind, timestamp: new Date().toISOString() });
      if (kind === "down") setShowComment(true);
    }
  }

  function submitComment() {
    if (commentText.trim()) {
      console.log("Feedback comment:", {
        messageId,
        comment: commentText.trim(),
        timestamp: new Date().toISOString(),
      });
    }
    setShowComment(false);
    setCommentText("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <FeedbackBtn
          onClick={() => rate("up")}
          disabled={busy || selected !== null}
          active={selected === "up"}
          activeColor="#0066CC"
          ariaLabel="Helpful"
        >
          <ThumbsUp size={18} strokeWidth={1.5} />
        </FeedbackBtn>
        <FeedbackBtn
          onClick={() => rate("down")}
          disabled={busy || selected !== null}
          active={selected === "down"}
          activeColor="#EF4444"
          ariaLabel="Not helpful"
        >
          <ThumbsDown size={18} strokeWidth={1.5} />
        </FeedbackBtn>
      </div>

      {showComment && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: 10,
            border: "1px solid var(--border-color)",
            padding: "12px 16px",
            marginTop: 4,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            What went wrong?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Tell us more (optional)"
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-input)",
              }}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              autoFocus
            />
            <button
              onClick={submitComment}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: "var(--accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackBtn({ children, onClick, disabled, active, activeColor, ariaLabel }) {
  const [hover, setHover] = useState(false);
  const activeBg = activeColor === "#0066CC" ? "rgba(0,102,204,0.1)" : "rgba(239,68,68,0.1)";
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
        background: active ? activeBg : hover ? "var(--border-color)" : "var(--border-subtle)",
        cursor: disabled ? "default" : "pointer",
        color: active ? activeColor : "var(--text-secondary)",
        borderRadius: "50%",
        padding: 0,
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {children}
    </button>
  );
}
