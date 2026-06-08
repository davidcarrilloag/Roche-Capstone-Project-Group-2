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
          <ThumbsUp size={14} strokeWidth={1.5} />
        </FeedbackBtn>
        <FeedbackBtn
          onClick={() => rate("down")}
          disabled={busy || selected !== null}
          active={selected === "down"}
          activeColor="#EF4444"
          ariaLabel="Not helpful"
        >
          <ThumbsDown size={14} strokeWidth={1.5} />
        </FeedbackBtn>
      </div>

      {showComment && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="What went wrong? (optional)"
            style={{
              flex: 1,
              border: "1px solid #E0E0E0",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              color: "#333333",
              backgroundColor: "#FFFFFF",
            }}
            onKeyDown={(e) => e.key === "Enter" && submitComment()}
            autoFocus
          />
          <button
            onClick={submitComment}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              backgroundColor: "#0066CC",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackBtn({ children, onClick, disabled, active, activeColor, ariaLabel }) {
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
        width: 28,
        height: 28,
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
        color: active ? activeColor : hover ? "#6B7280" : "#D1D5DB",
        borderRadius: 4,
        padding: 0,
        transition: "color 0.12s",
      }}
    >
      {children}
    </button>
  );
}
