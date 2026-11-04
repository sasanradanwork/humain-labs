// The HumAIn Labs group identifier (HLG) badge. It plays the same role as the green iD
// logo beside an ORCID iD: a circle in the theme colour with an H in the middle.
import { useRef } from "react";

// Turns the coin about three times, slowing to a stop, then leaves it still. The turn is drawn
// as a 2D squash (scaleX) on a wrapper element, so it works in every browser without 3D transforms.
// Hovering or tapping after it has stopped does not start it again until the pointer leaves.
function spinOnce(el) {
  if (!el || el.dataset.spinning === "1") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  el.dataset.spinning = "1";
  const dur = 4200;
  const turns = 3;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out: quick at first, slow at the end
    if (t < 1) {
      el.style.transform = `scaleX(${Math.cos(ease * turns * 2 * Math.PI).toFixed(3)})`;
      requestAnimationFrame(tick);
    } else {
      el.style.transform = "";
      el.dataset.spinning = "0";
    }
  };
  requestAnimationFrame(tick);
}

export function HlgBadge({ size = 18, spin = false }) {
  const ref = useRef(null);
  const svg = (
    <svg
      className="hlg-badge"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="HumAIn Labs identifier"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="12" style={{ fill: "var(--blue)" }} />
      <path d="M8 6.8v10.4M16 6.8v10.4M8 12h8" style={{ stroke: "var(--on-blue)", fill: "none" }} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
  if (!spin) return svg;
  return (
    <span
      ref={ref}
      className="hlg-wrap hlg-spin"
      onPointerEnter={() => spinOnce(ref.current)}
      onClick={() => spinOnce(ref.current)}
    >
      {svg}
    </span>
  );
}
