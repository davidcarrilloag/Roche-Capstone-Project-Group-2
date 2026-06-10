// Hexagon thinking indicator — CSS keyframes only, no animation libraries.
// Animations defined in index.css under "ThinkingIndicator".
import HexagonMark from "./HexagonMark.jsx";

export default function ThinkingIndicator() {
  return (
    <div style={{ padding: "10px 2px" }}>
      <HexagonMark
        size={32}
        stroke="var(--accent)"
        strokeWidth={2.5}
        pathClassName="thinking-hexagon-path"
      />
    </div>
  );
}
