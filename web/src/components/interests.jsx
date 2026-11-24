import { useEffect, useMemo, useState } from "react";

// Research interests, drawn as a graph you can open rather than a list that grows down
// the page. The discipline is the hub; each broad area is a branch off it; clicking a
// branch opens what sits under it. The drawing is a fixed height however many interests
// there are, which is the point — a stacked list got taller with every one added.

/** Fold the stored paths into a tree. Order follows first appearance, so it stays stable. */
export function interestTree(paths) {
  const root = [];
  for (const path of paths || []) {
    const steps = (Array.isArray(path) ? path : [path]).filter(Boolean);
    let level = root;
    for (const step of steps) {
      let node = level.find((n) => n.label === step);
      if (!node) {
        node = { label: step, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }
  return root;
}

// Text is measured rather than wrapped: an SVG has no line breaking, so each label is a
// pill sized to its own width and long ones are clipped with the full text on hover.
const HUES = [0, 1, 2, 3, 4, 5];

const CHAR = 6.15;
const PAD = 26;
const BADGE = 20; // the room a count badge needs on the right
const pillWidth = (label, count = 0, max = 196) => Math.min(max, label.length * CHAR + PAD + (count ? BADGE : 0));
const clip = (label, count = 0, max = 196) => {
  const fits = Math.floor((max - PAD - (count ? BADGE : 0)) / CHAR);
  return label.length > fits ? label.slice(0, Math.max(1, fits - 1)) + "…" : label;
};

function Pill({ x, y, label, kind, onClick, open, count, hue }) {
  const w = pillWidth(label, count);
  const h = 28;
  const Tag = onClick ? "g" : "g";
  return (
    <Tag
      className={`ig-node ig-${kind}${open ? " is-open" : ""}${onClick ? " is-btn" : ""}`}
      style={hue != null ? { "--c": `var(--h${hue})` } : undefined}
      transform={`translate(${x - w / 2} ${y - h / 2})`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      aria-expanded={onClick ? !!open : undefined}
    >
      <title>{count ? `${label} — ${count} below` : label}</title>
      <rect width={w} height={h} rx={h / 2} />
      <text x={(w - (count ? BADGE : 0)) / 2} y={h / 2 + 4} textAnchor="middle">
        {clip(label, count)}
      </text>
      {count > 0 && (
        <g className="ig-count" transform={`translate(${w - 9} ${h / 2})`}>
          <circle r="8" />
          <text y="3.5" textAnchor="middle">
            {open ? "–" : count}
          </text>
        </g>
      )}
    </Tag>
  );
}

/**
 * @param interests the stored paths
 * @param root      the discipline they hang from — the hub of the graph
 */
export function InterestGraph({ interests, root }) {
  const branches = useMemo(() => interestTree(interests), [interests]);
  // The first branch with anything under it starts open, so the graph never opens empty.
  const [openIdx, setOpenIdx] = useState(() => branches.findIndex((b) => b.children.length));
  // Below this width the arcs would overlap their own labels, so it becomes a plain tree.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!branches.length) return null;
  const spoken = (interests || [])
    .map((p) => [root, ...(Array.isArray(p) ? p : [p])].filter(Boolean).join(" → "))
    .join("; ");

  if (narrow) return <InterestTree interests={interests} root={root} />;

  // Laid out in columns rather than fanned on a circle: the hub on the left, the broad
  // areas beside it, and whatever is open in a third column. Opening a branch fills the
  // column to its right instead of pushing the page down, which is the whole point —
  // the old nested list grew taller with every interest added.
  const open = openIdx >= 0 && branches[openIdx] && branches[openIdx].children.length ? branches[openIdx] : null;
  const leafCount = open ? open.children.length : 0;
  const ROW = 46;
  const rows = Math.max(branches.length, leafCount, 1);
  const H = Math.max(150, rows * ROW + 36);
  const W = 780;
  const COL = { hub: 112, branch: 356, leaf: 630 };

  // Evenly spaced in the middle of the frame, whichever column they are in.
  const column = (n, centreOn = null) => {
    const span = (n - 1) * ROW;
    let top = H / 2 - span / 2;
    if (centreOn != null) top = Math.min(Math.max(20 + 14, centreOn - span / 2), H - 20 - 14 - span);
    return Array.from({ length: n }, (_, i) => top + i * ROW);
  };

  const bys = column(branches.length);
  const nodes = branches.map((b, i) => ({ ...b, x: COL.branch, y: bys[i] }));
  const openY = openIdx >= 0 && nodes[openIdx] ? nodes[openIdx].y : H / 2;
  const lys = leafCount ? column(leafCount, openY) : [];
  const leaves = open ? open.children.map((c, j) => ({ ...c, x: COL.leaf, y: lys[j] })) : [];
  const hub = { x: COL.hub, y: H / 2 };

  const curve = (a, b) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  };

  return (
    <div className="igraph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Research interests: ${spoken}`}>
        <g className="ig-links">
          {nodes.map((n, i) => (
            <path
              key={n.label}
              d={curve(hub, n)}
              className={i === openIdx ? "is-open" : ""}
              style={{ "--c": `var(--h${HUES[i % HUES.length]})` }}
            />
          ))}
          {leaves.map((l) => (
            <path key={l.label} d={curve(nodes[openIdx], l)} className="is-open" style={{ "--c": `var(--h${HUES[openIdx % HUES.length]})` }} />
          ))}
        </g>
        {root && <Pill x={hub.x} y={hub.y} label={root} kind="hub" />}
        {nodes.map((n, i) => (
          <Pill
            key={n.label}
            x={n.x}
            y={n.y}
            label={n.label}
            kind="branch"
            hue={HUES[i % HUES.length]}
            count={n.children.length}
            open={i === openIdx}
            onClick={n.children.length ? () => setOpenIdx(i === openIdx ? -1 : i) : undefined}
          />
        ))}
        {leaves.map((l) => (
          <Pill key={l.label} x={l.x} y={l.y} label={l.label} kind="leaf" hue={HUES[openIdx % HUES.length]} />
        ))}
      </svg>
      <p className="small soft igraph-hint">
        {branches.some((b) => b.children.length) ? "Open a branch to see what sits under it." : " "}
      </p>
    </div>
  );
}

/* The plain version: used on narrow screens, where a fanned graph cannot fit. */
function Branch({ nodes }) {
  if (!nodes.length) return null;
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.label}>
          <span className="node">{n.label}</span>
          <Branch nodes={n.children} />
        </li>
      ))}
    </ul>
  );
}

export function InterestTree({ interests, root }) {
  const nodes = interestTree(interests);
  if (!nodes.length) return null;
  const label = (interests || [])
    .map((p) => [root, ...(Array.isArray(p) ? p : [p])].filter(Boolean).join(" → "))
    .join("; ");
  return (
    <div className="itree" role="group" aria-label={`Research interests: ${label}`}>
      {root ? (
        <ul>
          <li>
            <span className="node node-root">{root}</span>
            <Branch nodes={nodes} />
          </li>
        </ul>
      ) : (
        <Branch nodes={nodes} />
      )}
    </div>
  );
}
