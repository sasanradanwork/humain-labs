// Small charts drawn inline, in the same spirit as the radar on the researcher cards:
// SVG rather than a charting library, so they stay sharp, follow the theme and cost nothing
// to download.
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { PUB_METRICS, metricShare, fmtDate } from "../lib/util.js";
import { S, AUTH } from "../lib/store.js";
import { ENDORSEMENT_POINTS, FIRST_AUTHOR_BONUS, PUBLICATION_POINTS } from "../lib/ranking.js";
import { plural } from "../lib/util.js";

/** 71 -> "71st". Used wherever a percentile is written out. */
export function ordinal(n) {
  if (n == null) return "—";
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}

/**
 * Where a researcher's points came from, year by year.
 *
 * One measure on one axis — points — split into the two things that earn them, so the
 * bar height is the score itself and the split explains it. Counts live in the tooltip
 * rather than on a second axis.
 */
/* ---- the standing panel's three readings ---- */

const SOURCES = [
  { key: "pub", label: "Publications", each: PUBLICATION_POINTS, count: (d) => d.publications },
  { key: "first", label: "First author", each: FIRST_AUTHOR_BONUS, count: (d) => d.firstAuthor },
  { key: "end", label: "Endorsements", each: ENDORSEMENT_POINTS, count: (d) => d.endorsements },
];

/** Catmull-Rom through the points, as cubics: a curve that passes through every year
 *  rather than a spline that wanders off the data. */
function curve(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * How the score was built up, source by source: points carried forward year on year, so
 * each line only ever rises and the gap between them is what that source has been worth
 * over a career. The figure at the right of each line is where it has reached.
 */
export function PointsCurves({ rows }) {
  const years = [...rows].sort((a, b) => a.year - b.year);
  // The drawing is sized in its own units, so a box drawn for a desktop column turns to
  // thread when it is shown 300px wide. Measure, and use a squarer box with the names
  // dropped when there isn't room for them.
  const boxRef = useRef(null);
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTight(e.contentRect.width < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = tight ? 188 : 172;
  const W = tight ? 420 : 820;
  const padL = 8, padT = 14, padB = tight ? 26 : 24;
  const padR = tight ? 52 : 124;
  const plot = height - padT - padB;
  const run = [0, 0, 0];
  const series = SOURCES.map(() => []);
  years.forEach((d, i) => {
    SOURCES.forEach((s, k) => {
      run[k] += s.count(d) * s.each;
      series[k].push({ i, v: run[k] });
    });
  });
  const top = Math.max(10, ...run);
  const x = (i) => padL + (i / Math.max(1, years.length - 1)) * (W - padL - padR);
  const y = (v) => padT + plot - (v / top) * plot;
  const paths = series.map((pts) => pts.map((p) => ({ x: x(p.i), y: y(p.v) })));
  const lastX = x(years.length - 1);

  // Two lines can finish within a few points of each other, and their end labels would
  // then sit on top of one another: space them out, keep them in the box, and run a
  // hairline back to the dot for any that had to move.
  const GAP = 30;
  const label = paths
    .map((pts, k) => ({ k, at: pts[pts.length - 1].y, y: pts[pts.length - 1].y }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < label.length; i++) label[i].y = Math.max(label[i].y, label[i - 1].y + GAP);
  const over = label[label.length - 1].y - (height - padB);
  if (over > 0) label.forEach((l) => (l.y = Math.max(padT + 8, l.y - over)));
  const labelY = [];
  label.forEach((l) => (labelY[l.k] = l.y));

  return (
    <div className="curves-box" ref={boxRef}>
    <svg className={"curves" + (tight ? " is-tight" : "")} viewBox={`0 0 ${W} ${height}`} role="img"
      aria-label={`Points carried forward: ${SOURCES.map((s, k) => `${s.label} ${run[k]}`).join(", ")}`}>
      <defs>
        {SOURCES.map((s) => (
          <linearGradient key={s.key} id={`cg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop className={`cg-${s.key}`} offset="0%" stopOpacity=".15" />
            <stop className={`cg-${s.key}`} offset="100%" stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {[0, top / 2, top].map((t) => (
        <line key={t} className="cv-grid" x1={padL} x2={lastX} y1={y(t)} y2={y(t)} />
      ))}
      {/* Where the latest year falls, so the end figures read against one line. */}
      <line className="cv-now" x1={lastX} x2={lastX} y1={padT - 6} y2={y(0)} />

      {paths.map((pts, k) => (
        <g key={SOURCES[k].key} className={`cv cv-${SOURCES[k].key}`}>
          <path className="cv-area" d={`${curve(pts)} L${lastX} ${y(0)} L${padL} ${y(0)} Z`} fill={`url(#cg-${SOURCES[k].key})`} />
          <path className="cv-line" d={curve(pts)} />
          <circle className="cv-dot" cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.4" />
          {/* name over value at the line's end, so the chart needs no legend of its own */}
          {Math.abs(labelY[k] - pts[pts.length - 1].y) > 2 && (
            <path className="cv-tie" d={`M${lastX + 4} ${pts[pts.length - 1].y} L${lastX + 8} ${labelY[k]}`} />
          )}
          {!tight && <text className="cv-name" x={lastX + 12} y={labelY[k] - 7}>{SOURCES[k].label}</text>}
          <text className="cv-val" x={lastX + 10} y={labelY[k] + (tight ? 4 : 9)}>{run[k]}</text>
        </g>
      ))}

      {years.map((d, i) =>
        tight && i !== 0 && i !== years.length - 1 ? null : (
          <text key={d.year} className="cv-year" x={x(i)} y={height - 8}
            textAnchor={i === 0 ? "start" : i === years.length - 1 ? "end" : "middle"}>
            {d.year}
          </text>
        )
      )}
    </svg>
    </div>
  );
}

/**
 * What was actually done this year, and what each part was worth. Bars rather than a
 * dot per thing: a researcher with thirty papers would otherwise get a wall of dots,
 * and the share of the year is the part worth comparing anyway.
 */
export function PointsMix({ row }) {
  const parts = SOURCES.map((s) => ({ ...s, n: s.count(row), pts: s.count(row) * s.each }));
  const total = parts.reduce((t, p) => t + p.pts, 0) || 1;
  return (
    <div className="pmix">
      {parts.map((p) => (
        <div className={`pmix-r pmix-${p.key}` + (p.n ? "" : " is-none")} key={p.key}>
          <span className="pmix-label">
            <i aria-hidden="true" />
            {p.label}
          </span>
          <b className="pmix-n">{p.n}</b>
          <span className="pmix-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((p.pts / total) * 100)}%` }} />
          </span>
          <span className="pmix-pts">
            {p.pts} <span>pts</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Where they have ranked, year by year: a tick per year, the latest one called out.
 * A percentile is a position rather than an amount, so it is kept away from the points
 * above it and drawn on its own scale.
 */
export function PercentileTicks({ rows, height = 92 }) {
  const years = [...rows].sort((a, b) => a.year - b.year);
  const W = 300, padL = 6, padR = 8, padT = 16, padB = 22;
  const plot = height - padT - padB;
  const slot = (W - padL - padR) / years.length;
  const now = years[years.length - 1];
  return (
    <svg className="pticks" viewBox={`0 0 ${W} ${height}`} role="img"
      aria-label={`Percentile by year: ${years.map((d) => `${d.year}, ${d.percentile == null ? "unranked" : ordinal(d.percentile)}`).join("; ")}`}>
      <line className="pt-base" x1={padL} x2={W - padR} y1={padT + plot} y2={padT + plot} />
      {years.map((d, i) => {
        const cx = padL + slot * i + slot / 2;
        const h = d.percentile == null ? 0 : (d.percentile / 100) * plot;
        const last = i === years.length - 1;
        return (
          <g key={d.year} className={"pt" + (last ? " is-now" : "") + (d.percentile == null ? " is-blank" : "")}>
            <title>{`${d.year}: ${d.percentile == null ? "unranked" : `${ordinal(d.percentile)} percentile`}`}</title>
            <line className="pt-stem" x1={cx} x2={cx} y1={padT + plot} y2={padT + plot - h} />
            {d.percentile != null && <circle className="pt-cap" cx={cx} cy={padT + plot - h} r={last ? 4 : 2.6} />}
          </g>
        );
      })}
      <text className="pt-first" x={padL} y={height - 7}>{years[0].year}</text>
      <text className="pt-now" x={W - padR} y={height - 7} textAnchor="end">
        {now.percentile == null ? "unranked" : `now ${ordinal(now.percentile)}`}
      </text>
    </svg>
  );
}

/** The highest figure for each measure among the researchers listed here. */
function fieldTops() {
  const tops = {};
  for (const [, key, floor] of PUB_METRICS)
    tops[key] = Math.max(floor, ...S.researchers.map((r) => (r.metrics ? r.metrics[key] || 0 : 0)), AUTH.researcher?.metrics?.[key] || 0);
  return tops;
}

/**
 * The published record in figures. Each one carries a bar showing how it stands against
 * the highest figure among researchers here — the comparison the old radar made, but
 * readable as numbers rather than a shape.
 */
export function PubFigures({ m }) {
  if (!m) return null;
  const tops = fieldTops();
  return (
    <div className="pfigs">
      {PUB_METRICS.map(([label, key]) => (
        <div className="pfig" key={key}>
          <span className="pfig-k">{label}</span>
          <b className="pfig-v">{(m[key] || 0).toLocaleString()}</b>
          <span className="pfig-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(2, Math.round(metricShare(m[key], tops[key]) * 100))}%` }} />
          </span>
        </div>
      ))}
      <p className="pfig-note">
        From {m.source || "OpenAlex"}, updated {fmtDate(m.updatedAt)}. Each bar is the figure against the highest among
        researchers here.
      </p>
    </div>
  );
}

/**
 * A career on one axis. Roles, editorships and memberships all carry the years they ran,
 * so they are drawn as spans against a shared scale instead of four lists of dates: the
 * overlaps, the gaps and what is still running are the things a reader is after, and none
 * of them survive being written out as "2019–2023" four columns apart.
 *
 * Items are { kind, title, org, from, to } for a span, or { kind, title, at } for a
 * moment. A span with no end is still running and is drawn to the present.
 */
export function CareerSpans({ items, limit }) {
  const now = new Date().getFullYear();
  // The scale comes from the whole career even when only the first few rows are drawn,
  // so opening the rest slides nothing sideways.
  const years = items.flatMap((i) => [i.from, i.to, i.at].filter(Boolean));
  if (!years.length) return null;
  const first = Math.min(...years);
  const last = Math.max(now, ...years);
  const pad = Math.max(1, Math.round((last - first) * 0.04));
  const lo = first - pad, hi = last + pad;
  const at = (y) => ((y - lo) / (hi - lo)) * 100;

  // A tick every five or ten years, whichever keeps the axis readable.
  const step = hi - lo > 26 ? 10 : 5;
  const ticks = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push(y);

  return (
    <div className="xp">
      <div className="xp-grid">
        <div className="xp-lines" style={{ gridRow: `1 / ${(limit ? Math.min(limit, items.length) : items.length) + 1}` }} aria-hidden="true">
          {ticks.map((y) => (
            <span key={y} style={{ left: `${at(y)}%` }} />
          ))}
          <span className="xp-now" style={{ left: `${at(now)}%` }} />
        </div>

        {(limit ? items.slice(0, limit) : items).map((it, i) => {
          const running = it.from && !it.to;
          // Every cell names its row. The lines behind them span the whole grid, and a
          // row left to place itself would be bumped past them instead of over them.
          const row = { gridRow: i + 1 };
          const fromPct = at(it.from ?? it.at);
          const toPct = at(it.to ?? (it.from ? now : it.at));
          return (
            <Fragment key={i}>
              <div className="xp-l" style={row} data-kind={it.kind}>
                <i aria-hidden="true" />
                <b>{it.title}</b>
                {it.org && <span>{it.org}</span>}
              </div>
              <div className="xp-t" style={row} data-kind={it.kind}>
                {it.at ? (
                  <i className="xp-mark" style={{ left: `${fromPct}%` }} title={`${it.title}, ${it.at}`} />
                ) : (
                  <i
                    className={"xp-bar" + (running ? " is-now" : "")}
                    style={{ left: `${fromPct}%`, width: `${Math.max(1.2, toPct - fromPct)}%` }}
                    title={`${it.from}–${it.to || "present"}`}
                  />
                )}
              </div>
              {/* The years get a column of their own: inside the track a long bar would
                  run straight over them. */}
              <span className="xp-when" style={row}>{it.at ? it.at : `${it.from}–${it.to || "now"}`}</span>
            </Fragment>
          );
        })}

        <div className="xp-axis" style={{ gridRow: (limit ? Math.min(limit, items.length) : items.length) + 1 }} aria-hidden="true">
          {ticks.map((y) => (
            <span key={y} style={{ left: `${at(y)}%` }}>
              {y}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
