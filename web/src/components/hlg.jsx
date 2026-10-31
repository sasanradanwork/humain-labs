// The HumAIn Labs group identifier (HLG) badge. It plays the same role as the green iD
// logo beside an ORCID iD: a circle in the theme colour with an H in the middle.
export function HlgBadge({ size = 18 }) {
  return (
    <svg className="hlg-badge" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="HumAIn Labs identifier">
      <circle cx="12" cy="12" r="12" style={{ fill: "var(--blue)" }} />
      <path d="M8 6.8v10.4M16 6.8v10.4M8 12h8" style={{ stroke: "var(--on-blue)", fill: "none" }} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
