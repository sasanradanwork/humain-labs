// The HumAIn Labs group identifier (HLG) badge. It plays the same role as the green iD
// logo beside an ORCID iD: a circle in the theme colour with an H in the middle.
import { useRef } from "react";

// Spins the coin about three turns, slowing steadily, then leaves it still. Hovering on
// after that does not start it again; it spins again only after the pointer has left and returned.
function spinOnce(el) {
  if (!el || el.dataset.spinning === "1") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  el.dataset.spinning = "1";
  const dur = 4200;
  const turns = 3;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out: fast at first, slow at the end
    if (t < 1) {
      el.style.transform = `rotateY(${ease * turns * 360}deg)`;
      requestAnimationFrame(tick);
    } else {
      el.style.transform = "rotateY(0deg)";
      el.dataset.spinning = "0";
    }
  };
  requestAnimationFrame(tick);
}

export function HlgBadge({ size = 18, spin = false }) {
  const ref = useRef(null);
  return (
    <svg
      ref={ref}
      className={"hlg-badge" + (spin ? " hlg-spin" : "")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="HumAIn Labs identifier"
      onPointerEnter={spin ? () => spinOnce(ref.current) : undefined}
      style={spin ? { display: "inline-block", transformOrigin: "50% 50%", transformBox: "fill-box" } : undefined}
    >
      <circle cx="12" cy="12" r="12" style={{ fill: "var(--blue)" }} />
      <path d="M8 6.8v10.4M16 6.8v10.4M8 12h8" style={{ stroke: "var(--on-blue)", fill: "none" }} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
