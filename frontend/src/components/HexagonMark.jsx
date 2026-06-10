// Wide Roche-style hexagon — pointed left/right, 2:1 aspect ratio (viewBox 64×32).
// Accepts pathClassName to attach animation classes to the polygon directly.
export default function HexagonMark({
  size = 36,
  stroke = "currentColor",
  strokeWidth = 2.5,
  className = "",
  pathClassName = "",
  style = {},
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.5)}
      viewBox="0 0 64 32"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, display: "block", ...style }}
    >
      <polygon
        points="2,16 14,3 50,3 62,16 50,29 14,29"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={pathClassName}
      />
    </svg>
  );
}
