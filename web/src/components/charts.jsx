// Small charts drawn inline, in the same spirit as the radar on the researcher cards:
// SVG rather than a charting library, so they stay sharp, follow the theme and cost nothing
// to download.
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
export function PointsBars({ rows, height = 150 }) {
  const data = [...rows].sort((a, b) => a.year - b.year);
  const top = Math.max(10, ...data.map((d) => d.points));
  const W = 320;
  const padL = 26, padB = 26, padT = 14;
  const plot = height - padB - padT;
  const slot = (W - padL) / data.length;
  const barW = Math.min(38, slot * 0.56);
  const y = (v) => padT + plot - (v / top) * plot;
  // Two ticks and a baseline: enough to read a height, quiet enough to stay out of the way.
  const ticks = [0, Math.round(top / 2), top];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} className="bars" role="img" aria-label={`Points by year: ${data.map((d) => `${d.year}, ${d.points} points`).join("; ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ax-grid" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="ax-label" x={padL - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const x = cx - barW / 2;
          const pubPts = d.publications * PUBLICATION_POINTS + d.firstAuthor * FIRST_AUTHOR_BONUS;
          const endPts = d.endorsements * ENDORSEMENT_POINTS;
          const base = y(0);
          const hPub = (pubPts / top) * plot;
          const hEnd = (endPts / top) * plot;
          // A 2px gap keeps the two segments from reading as one block.
          const gap = hPub > 0 && hEnd > 0 ? 2 : 0;
          const tip = d.points
            ? `${d.year}: ${d.points} points — ${plural(d.publications, "publication", "publications")}${
                d.firstAuthor ? ` (${d.firstAuthor} as first author)` : ""
              } and ${plural(d.endorsements, "peer endorsement", "peer endorsements")}.`
            : `${d.year}: nothing recorded.`;
          return (
            <g key={d.year} className="bar-g">
              <title>{tip}</title>
              {/* a full-height target, so the tooltip is easy to hit on a short bar */}
              <rect className="bar-hit" x={cx - slot / 2} y={padT} width={slot} height={plot} />
              {hPub > 0 && <rect className="bar-pub" x={x} y={base - hPub} width={barW} height={hPub} rx="4" />}
              {hEnd > 0 && <rect className="bar-end" x={x} y={base - hPub - gap - hEnd} width={barW} height={hEnd} rx="4" />}
              {d.points > 0 && (
                <text className="ax-value" x={cx} y={base - hPub - gap - hEnd - 5} textAnchor="middle">
                  {d.points}
                </text>
              )}
              <text className="ax-label" x={cx} y={height - 8} textAnchor="middle">
                {d.year}
              </text>
            </g>
          );
        })}
        <line className="ax-line" x1={padL} x2={W} y1={y(0)} y2={y(0)} />
      </svg>
      <div className="chart-key">
        <span>
          <i className="key-pub" /> From publications
        </span>
        <span>
          <i className="key-end" /> From peer endorsements
        </span>
      </div>
    </div>
  );
}

/** Publications per year, as a plain count. One series, so no legend: the heading names it. */
export function PubBars({ years, height = 110 }) {
  const data = [...years].sort((a, b) => a.year - b.year);
  if (!data.length) return null;
  const top = Math.max(1, ...data.map((d) => d.count));
  const W = 320;
  const padL = 20, padB = 22, padT = 12;
  const plot = height - padB - padT;
  const slot = (W - padL) / data.length;
  const barW = Math.min(30, slot * 0.54);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} className="bars" role="img" aria-label={`Publications by year: ${data.map((d) => `${d.year}, ${d.count}`).join("; ")}`}>
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = (d.count / top) * plot;
          const base = padT + plot;
          return (
            <g key={d.year} className="bar-g">
              <title>{`${d.year}: ${plural(d.count, "publication", "publications")}`}</title>
              <rect className="bar-hit" x={cx - slot / 2} y={padT} width={slot} height={plot} />
              {d.count > 0 && <rect className="bar-pub" x={cx - barW / 2} y={base - h} width={barW} height={h} rx="4" />}
              {d.count > 0 && (
                <text className="ax-value" x={cx} y={base - h - 4} textAnchor="middle">
                  {d.count}
                </text>
              )}
              <text className="ax-label" x={cx} y={height - 7} textAnchor="middle">
                {String(d.year).slice(2)}
              </text>
            </g>
          );
        })}
        <line className="ax-line" x1={padL} x2={W} y1={padT + plot} y2={padT + plot} />
      </svg>
    </div>
  );
}
