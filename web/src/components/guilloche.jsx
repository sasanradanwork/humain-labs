// The security pattern printed on the researcher record: lathe work done on the rounded
// rectangle the rest of the site is drawn with. Each ring is a little smaller than the
// one outside it and turned a fraction further, which is what gives the nest its drift.
// Geometric line work, drawn rather than tiled, so it stays crisp at any size.
//
// The geometry is fixed, so each pattern is worked out once when the module loads rather
// than on every render. Decorative only: it carries no information, so it is hidden from
// assistive software and never intercepts a click.

const W = 300;
const H = 260;

/** Nested rounded rectangles: lathe work on the shape the rest of the site is drawn with. */
function nested({ rings = 26, inset = 5.2, turn = 0.5 }) {
  const out = [];
  for (let i = 0; i < rings; i++) {
    const w = W - i * inset * 2;
    const h = H - i * inset * 1.9;
    if (w < 14 || h < 14) break;
    out.push({ x: -w / 2, y: -h / 2, w, h, r: Math.max(3, 34 - i * 1.1), t: i * turn });
  }
  return out;
}

const NESTED = nested({});

export function CardPattern({ className = "" }) {
  return (
    <svg className={`cardpat cp-nested ${className}`} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor">
        {NESTED.map((o, i) => (
          <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} rx={o.r} transform={`rotate(${o.t})`} />
        ))}
      </g>
    </svg>
  );
}
