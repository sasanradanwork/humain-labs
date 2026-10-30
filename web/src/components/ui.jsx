import { useId } from "react";
import { hash, initials, rng, RADAR_AXES, radarScale, fmtDate, daysLeft, sortName } from "../lib/util.js";
import { S, AUTH } from "../lib/store.js";

/* ---------- icons ---------- */
const s = (p) => ({ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", ...p });
export const Icon = {
  search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" {...s()} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  globe: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" {...s({ strokeLinecap: "butt" })} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  ),
  inst: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" {...s({ strokeLinecap: "butt" })} aria-hidden="true">
      <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
    </svg>
  ),
  mail: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...s({ strokeLinecap: "butt" })} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
  linkedin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.1c0-1.22-.02-2.8-1.7-2.8-1.71 0-1.97 1.33-1.97 2.7V21h-4z" />
    </svg>
  ),
  scholar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3 1 9l11 6 9-4.91V17h2V9zM5 13.18v4L12 21l7-3.82v-4L12 17z" />
    </svg>
  ),
  book: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s({ strokeLinecap: "butt" })} aria-hidden="true">
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  x: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s()} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  down: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...s()} aria-hidden="true">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16" />
    </svg>
  ),
  sun: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s()} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s({ strokeLinejoin: "round" })} aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  clock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" {...s({ strokeWidth: 2.4 })} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" {...s({ strokeWidth: 3, strokeLinejoin: "round" })} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  ms: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  ),
  gh: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  ),
};

/* ---------- the HumAIn Labs wordmark ---------- */
// Colours come from CSS variables, so it works on the light header and the dark homepage alike.
export function Logo({ animated = false, steam = animated, className = "logo" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      className={className + (animated ? " animated" : "")}
      viewBox={steam ? "30 -26 436 116" : "30 12 436 76"}
      role="img"
      aria-label="HumAIn Labs"
    >
      <defs>
        <clipPath id={`${id}-base`}>
          <rect x="-20" y="0" width="100" height="80" />
        </clipPath>
        <clipPath id={`${id}-flask`}>
          <path d="M19 20V40L2.5 71Q-1 80 8 80H48Q57 80 53.5 71L37 40V20Z" />
        </clipPath>
      </defs>
      <g fill="none" strokeWidth="9" strokeLinejoin="round" strokeLinecap="butt">
        <path className="lg-ink" transform="translate(40 0)" d="M0 20V80M44 20V80M0 50H44" />
        <path className="lg-ink" transform="translate(103 0)" d="M0 33.5V60A20 20 0 0 0 40 60M40 33.5V80" />
        <path className="lg-ink" transform="translate(160 0)" d="M0 33.5V80M0 56A18 18 0 0 1 36 56V80M36 56A18 18 0 0 1 72 56V80" />
        <path className="lg-acc" transform="translate(248 0)" d="M-1.8 84L27 22.5L55.8 84" clipPath={`url(#${id}-base)`} />
        <path className="lg-acc" transform="translate(319 0)" d="M0 20V80" />
        <path className="lg-ink" transform="translate(338 0)" d="M0 33.5V80M0 56A18 18 0 0 1 36 56V80" />
      </g>
      <g transform="translate(400 0)">
        <g clipPath={`url(#${id}-flask)`}>
          <g className="liquid">
            <path className="wave back lg-fill" d="M-10 57 q7 -3 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 V90 H-10 Z" />
            <path className="wave lg-fill" d="M-10 58 q7 -3.5 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 V90 H-10 Z" />
          </g>
          {animated && (
            <g className="lg-bubbles">
              {[[18, 76, 2.4, 0], [30, 77, 3, 0.7], [39, 75, 2, 1.4], [24, 74, 1.8, 2], [35, 78, 2.6, 1.1]].map(([cx, cy, r, d]) => (
                <circle key={cx} className="bubble" cx={cx} cy={cy} r={r} style={{ animationDelay: `${d}s` }} />
              ))}
            </g>
          )}
        </g>
        {steam && (
          <g className="lg-steam">
            {[[26, 2.6, 0.2, "-5px"], [30, 1.9, 1.3, "6px"], [28, 3.2, 2.3, "-1px"]].map(([cx, r, d, dx]) => (
              <circle key={`${cx}-${d}`} className="steam" cx={cx} cy="14" r={r} style={{ animationDelay: `${d}s`, "--dx": dx }} />
            ))}
          </g>
        )}
        <path
          className="lg-ink"
          d="M19 20V40L2.5 71Q-1 80 8 80H48Q57 80 53.5 71L37 40V20M11 20H45"
          fill="none"
          strokeWidth="9"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/* ---------- the homepage backdrop: dot field and orbit rings ---------- */
const HOME_DOTS =
  "20,100 20,540 20,660 20,700 20,740 20,820 60,180 60,260 60,300 60,540 60,660 60,780 60,820 100,60 100,100 100,180 100,300 100,460 100,500 100,540 100,580 100,660 100,700 100,740 100,820 100,860 140,20 140,100 140,140 140,180 140,220 140,340 140,580 140,740 180,20 180,60 180,220 180,260 180,500 180,700 180,740 180,780 180,860 220,60 220,100 220,140 220,180 220,340 220,820 220,860 260,180 260,220 260,500 260,620 260,860 300,20 300,180 300,260 300,380 300,420 300,460 300,500 300,540 300,580 340,20 340,100 340,140 340,180 340,420 340,460 340,500 340,580 340,620 340,700 340,740 340,780 340,820 380,20 380,100 380,140 380,260 380,300 380,460 380,500 380,580 380,620 380,660 380,860 420,60 420,140 420,180 420,380 420,540 420,660 420,700 420,780 460,180 460,300 460,340 460,460 460,500 460,580 460,700 460,780 460,820 460,860 500,20 500,140 500,300 500,340 500,380 500,420 500,500 500,540 500,580 500,860 540,20 540,100 540,140 540,220 540,260 540,340 540,460 540,500 540,780 540,860 580,100 580,220 580,260 580,300 580,460 580,620 580,660 580,780 580,820 580,860 620,60 620,180 620,220 620,260 620,340 620,420 620,540 620,580 660,100 660,420 660,460 660,580 660,660 660,780 700,20 700,100 700,140 700,180 700,420 700,580 700,620 700,660 740,60 740,100 740,220 780,60 780,100 780,140 780,180 780,300 780,380 780,420 780,500 780,540 780,580 780,620 780,660 780,820 780,860 820,20 820,60 820,100 820,140 820,380 820,420 820,460 820,500 820,540 820,660 820,700 820,820 860,140 860,220 860,260 860,420 860,460 860,500 860,540 860,700 860,780 900,20 900,60 900,100 900,340 900,420 900,460 900,580 900,620 900,780 900,860 940,60 940,140 940,220 940,260 940,340 940,740 940,820 940,860 980,20 980,60 980,100 980,260 980,300 980,540 980,620 980,860 1020,20 1020,60 1020,100 1020,140 1020,220 1020,300 1020,380 1020,420 1020,540 1020,740 1020,780 1020,860 1060,20 1060,220 1060,340 1060,380 1060,740 1060,780 1060,820 1100,220 1100,340 1100,380 1100,620 1100,660 1100,700 1100,820 1100,860 1140,20 1140,140 1140,180 1140,220 1140,260 1140,460 1140,500 1140,540 1140,580 1140,620 1140,700 1140,780 1140,860 1180,140 1180,180 1180,340 1180,460 1180,620 1180,660 1180,700 1180,860 1220,140 1220,260 1220,300 1220,500 1220,580 1220,620 1220,740 1220,820 1260,20 1260,100 1260,300 1260,340 1260,500 1260,700 1260,740 1260,780 1260,820 1260,860 1300,60 1300,100 1300,180 1300,500 1300,580 1300,700 1300,740 1340,20 1340,140 1340,260 1340,300 1340,460 1340,540 1340,580 1340,700 1340,740 1340,820 1380,60 1380,100 1380,140 1380,180 1380,340 1380,380 1380,580 1380,660 1380,700 1380,740 1380,780 1380,820 1420,60 1420,180 1420,340 1420,420 1420,460 1420,500 1420,700 1420,860";
const HOME_RINGS = [
  [1060, -240, 560, 2.2, 0.5], [1020, -100, 400, 2, 0.7], [960, 40, 200, 3, 0.45], [1480, -40, 520, 3.6, 0.85],
  [1500, 140, 480, 1.8, 0.5], [120, 1180, 460, 3, 0.7], [40, 1120, 300, 1.8, 0.5], [330, 1040, 170, 2.4, 0.4],
];
export function HomeBackdrop() {
  return (
    <svg className="home-bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="home-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" />
          <stop offset=".42" stopColor="#000" />
          <stop offset=".85" stopColor="#fff" />
        </radialGradient>
        <mask id="home-clear">
          <rect width="1440" height="900" fill="url(#home-fade)" />
        </mask>
      </defs>
      <g mask="url(#home-clear)">
        <g fill="#6D7DC6" opacity=".55">
          {HOME_DOTS.split(" ").map((xy) => {
            const [x, y] = xy.split(",");
            return <circle key={xy} cx={x} cy={y} r="2.4" />;
          })}
        </g>
        <g fill="none" stroke="#8191E4">
          {HOME_RINGS.map(([cx, cy, r, w, o]) => (
            <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} strokeWidth={w} opacity={o} />
          ))}
        </g>
        <circle cx="1210" cy="150" r="46" fill="#8191E4" />
      </g>
    </svg>
  );
}

/* ---------- generated cover art: a small field-plot of orbits and dots ---------- */
export function Cover({ seed, label = "" }) {
  const r = rng(hash(seed));
  const t = hash(label || seed) % 5;
  const bg = `var(--t${t}b)`;
  const fg = `var(--t${t}f)`;
  const dots = [];
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 9; y++)
      if (r() > 0.62) dots.push([10 + x * 20, 10 + y * 20]);
  const rings = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) rings.push([r() * 320, r() * 180, 30 + r() * 120, 1 + r() * 1.4, 0.25 + r() * 0.5]);
  const blob = [60 + r() * 200, 40 + r() * 100, 8 + r() * 14];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" style={{ fill: bg }} />
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" style={{ fill: fg }} opacity=".35" />
      ))}
      {rings.map(([cx, cy, rad, w, o], i) => (
        <circle key={i} cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={rad.toFixed(1)} fill="none" style={{ stroke: fg }} strokeWidth={w.toFixed(1)} opacity={o.toFixed(2)} />
      ))}
      <circle cx={blob[0].toFixed(1)} cy={blob[1].toFixed(1)} r={blob[2].toFixed(1)} style={{ fill: fg }} opacity=".85" />
    </svg>
  );
}

export function Avatar({ name, size = 40 }) {
  const t = hash(name) % 5;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `var(--t${t}b)`, color: `var(--t${t}f)` }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* ---------- badges ---------- */
export function VerifiedBadge({ v, withDomain = true }) {
  if (!v) return null;
  const tip = `Institution email verified${v.domain ? ` (@${v.domain})` : ""}${v.at ? ` on ${fmtDate(v.at)}` : ""}`;
  return (
    <span className="verified" title={tip}>
      <Icon.check /> Verified{withDomain && v.domain ? <span className="vd">@{v.domain}</span> : null}
    </span>
  );
}
export const UnverifiedBadge = () => (
  <span className="unverified" title="This researcher hasn't verified an institution email yet">
    Not verified
  </span>
);
export function DeadlinePill({ study }) {
  const d = daysLeft(study);
  if (d === null) return null;
  if (d < 0)
    return (
      <span className="deadline closed">
        <Icon.clock /> Closed
      </span>
    );
  const text =
    d === 0 ? "Closes today"
    : d === 1 ? "Closes tomorrow"
    : d <= 14 ? `Closes in ${d} days`
    : `Closes ${new Date(study.closesAt + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  return (
    <span className={"deadline" + (d <= 7 ? " urgent" : "")} title={`Applications close on ${fmtDate(study.closesAt)}`}>
      <Icon.clock /> {text}
    </span>
  );
}
export function TrendChips({ t }) {
  return (
    <>
      {t.rising && <span className="chip-t rising">Rising</span>}
      {t.isNew && <span className="chip-t new">New</span>}
    </>
  );
}

/* ---------- links out ---------- */
export const LinkedInLink = ({ url, className = "btn btn-blue icon-btn" }) =>
  url ? (
    <a className={className} href={url} target="_blank" rel="noopener" aria-label="LinkedIn profile" title="LinkedIn profile">
      <Icon.linkedin />
    </a>
  ) : null;
export const ScholarLink = ({ url, className = "btn btn-blue icon-btn" }) =>
  url ? (
    <a className={className} href={url} target="_blank" rel="noopener" aria-label="Google Scholar profile" title="Google Scholar profile">
      <Icon.scholar />
    </a>
  ) : null;

/* ---------- publication radar ---------- */
// Each axis is scaled against the highest figure among researchers here, so the shapes
// differ from one another rather than all filling the chart.
function radarTops() {
  const tops = {};
  for (const [, key, floor] of RADAR_AXES) {
    tops[key] = Math.max(floor, ...S.researchers.map((r) => (r.metrics ? r.metrics[key] || 0 : 0)), AUTH.researcher?.metrics?.[key] || 0);
  }
  return tops;
}
export function Radar({ m, size = 64, labels = false }) {
  if (!m) return null;
  const tops = radarTops();
  // With labels the drawing needs room either side for the text, so the box is wider than it is tall.
  const viewW = labels ? size * 1.75 : size;
  const cx = viewW / 2;
  const cy = size / 2;
  const rMax = size / 2 - (labels ? 18 : 3.5);
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_AXES.length;
    return [cx + Math.cos(a) * rMax * f, cy + Math.sin(a) * rMax * f];
  };
  const ring = (f) => RADAR_AXES.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = RADAR_AXES.map(([, key], i) => pt(i, Math.max(0.06, radarScale(m[key], tops[key]))).map((n) => n.toFixed(1)).join(",")).join(" ");
  const tip = `${m.source || "OpenAlex"}: ${m.works} publications, ${m.citations} citations, h-index ${m.hIndex}, i10 ${m.i10}, ${m.recentWorks} published in the last 3 years${m.updatedAt ? ` (updated ${fmtDate(m.updatedAt)})` : ""}. Each axis is scaled against the highest figure among researchers here.`;
  return (
    <svg className="radar" viewBox={`0 0 ${viewW} ${size}`} width={viewW} height={size} role="img" aria-label={tip}>
      <title>{tip}</title>
      <polygon className="radar-grid" points={ring(1)} />
      <polygon className="radar-grid" points={ring(0.6)} />
      <polygon className="radar-grid" points={ring(0.3)} />
      {RADAR_AXES.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} className="radar-grid" x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} />;
      })}
      <polygon className="radar-shape" points={shape} />
      {labels &&
        RADAR_AXES.map(([label, key], i) => {
          const [x, y] = pt(i, 1.13);
          return (
            <text
              key={key}
              className="radar-label"
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              textAnchor={x < cx - 2 ? "end" : x > cx + 2 ? "start" : "middle"}
              dominantBaseline="middle"
            >
              {label}
              <tspan className="radar-val" dx="4">
                {m[key]}
              </tspan>
            </text>
          );
        })}
    </svg>
  );
}

/* ---------- interest sparkline ---------- */
export function Spark({ vals, w = 84, h = 26, area = false, className = "spark" }) {
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - 3 - v * (h - 6)]);
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none" aria-hidden="true">
      {area && <path className="spark-area" d={`${d} L${w} ${h} L0 ${h} Z`} />}
      <path className="spark-line" d={d} />
      {!area && <circle className="spark-dot" cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="2.5" />}
    </svg>
  );
}

export const sortByName = (a, b) => sortName(a.name).localeCompare(sortName(b.name));
