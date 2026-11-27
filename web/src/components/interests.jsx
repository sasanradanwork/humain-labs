import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Research interests, drawn as a graph you move around rather than a list that grows down
// the page. The discipline is the hub; every path hangs off it. The frame is a fixed size
// however many interests there are — adding more makes the drawing bigger inside the
// frame, not the page longer — so you pan and zoom to get to what you want.

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

const CHAR = 5.5; // width of a character at the pill's font size
const PAD = 18;
const BADGE = 16; // the room a count badge needs on the right
const PILL_H = 24;
const ROW = 32; // vertical pitch between sibling leaves
const COLW = 162; // horizontal pitch between depths
const MAXW = 138;
const MARGIN = 18; // breathing room around the drawing

const pillWidth = (label, count = 0) => Math.min(MAXW, label.length * CHAR + PAD + (count ? BADGE : 0));
const clip = (label, count = 0) => {
  const fits = Math.floor((MAXW - PAD - (count ? BADGE : 0)) / CHAR);
  return label.length > fits ? label.slice(0, Math.max(1, fits - 1)) + "…" : label;
};

const ZOOM_GUTTER = 46; // the strip the zoom controls occupy down the right of the frame
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Pill({ node, onClick }) {
  const { label, count, open, hue } = node;
  const w = pillWidth(label, count);
  const kind = node.depth === 0 ? "hub" : count ? "branch" : "leaf";
  return (
    <g
      className={`ig-node ig-${kind}${open ? " is-open" : ""}${onClick ? " is-btn" : ""}`}
      style={hue != null ? { "--c": `var(--h${hue})` } : undefined}
      transform={`translate(${node.x - w / 2} ${node.y - PILL_H / 2})`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      aria-expanded={onClick ? !!open : undefined}
      aria-label={onClick ? `${label}, ${count} below` : undefined}
    >
      <title>{count ? `${label} — ${count} below` : label}</title>
      <rect width={w} height={PILL_H} rx={PILL_H / 2} />
      <text x={(w - (count ? BADGE : 0)) / 2} y={PILL_H / 2 + 3.5} textAnchor="middle">
        {clip(label, count)}
      </text>
      {count > 0 && (
        <g className="ig-count" transform={`translate(${w - 8} ${PILL_H / 2})`}>
          <circle r="7" />
          <text y="3" textAnchor="middle">
            {open ? "–" : count}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Lay the tree out left to right: a node sits at the vertical midpoint of its children,
 * and leaves are stacked one row apart. Collapsed nodes keep their children out of the
 * layout entirely, so closing a branch genuinely reclaims the space.
 */
function layout(branches, root, collapsed) {
  const build = (n, depth, key, hue) => {
    const shut = collapsed.has(key);
    const node = { key, label: n.label, depth, hue, count: n.children.length, open: !shut && n.children.length > 0 };
    node.kids = shut ? [] : n.children.map((c) => build(c, depth + 1, `${key}/${c.label}`, hue));
    return node;
  };

  const tops = branches.map((b, i) => build(b, root ? 1 : 0, b.label, HUES[i % HUES.length]));
  const roots = root ? [{ key: "", label: root, depth: 0, hue: null, count: 0, open: true, kids: tops }] : tops;

  let cursor = 0;
  const place = (n) => {
    n.x = n.depth * COLW;
    if (!n.kids.length) {
      n.y = cursor;
      cursor += ROW;
    } else {
      n.kids.forEach(place);
      n.y = (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2;
    }
  };
  roots.forEach(place);

  const nodes = [];
  const links = [];
  const walk = (n) => {
    nodes.push(n);
    for (const k of n.kids) {
      links.push({ key: `${n.key}>${k.key}`, a: n, b: k, hue: k.hue });
      walk(k);
    }
  };
  roots.forEach(walk);

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const w = pillWidth(n.label, n.count) / 2;
    x0 = Math.min(x0, n.x - w);
    x1 = Math.max(x1, n.x + w);
    y0 = Math.min(y0, n.y - PILL_H / 2);
    y1 = Math.max(y1, n.y + PILL_H / 2);
  }
  return {
    nodes,
    links,
    box: { x: x0 - MARGIN, y: y0 - MARGIN, w: x1 - x0 + MARGIN * 2, h: y1 - y0 + MARGIN * 2 },
  };
}

/**
 * @param interests the stored paths
 * @param root      the discipline they hang from — the hub of the graph
 */
export function InterestGraph({ interests, root }) {
  const branches = useMemo(() => interestTree(interests), [interests]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const { nodes, links, box } = useMemo(() => layout(branches, root, collapsed), [branches, root, collapsed]);

  const frameRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef(null);
  const dragged = useRef(false);

  // The frame is sized by CSS; the maths below works in its pixels, so measure it.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.w || !size.h || !box.w || !box.h) return;
    // The zoom controls sit in the bottom right, so the drawing is framed into the space
    // left of them rather than sliding underneath.
    const vw = Math.max(80, size.w - ZOOM_GUTTER);
    const k = clamp(Math.min(vw / box.w, size.h / box.h), MIN_ZOOM, 1.15);
    setView({ k, x: (vw - box.w * k) / 2 - box.x * k, y: (size.h - box.h * k) / 2 - box.y * k });
  }, [size.w, size.h, box.x, box.y, box.w, box.h]);

  // Frame it on arrival and whenever the interests themselves change, but not on every
  // open and close — that would yank the drawing out from under the pointer.
  const fitKey = `${size.w}x${size.h}|${branches.map((b) => b.label).join(",")}`;
  const lastFit = useRef("");
  useLayoutEffect(() => {
    if (lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    fit();
  }, [fitKey, fit]);

  const zoomAbout = useCallback((factor, px, py) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const s = k / v.k;
      return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
    });
  }, []);

  const DRAG_MIN = 4; // px of travel before a press counts as a drag rather than a click

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    // The zoom controls sit over the drawing; pressing one must not start a pan.
    if (e.target.closest && e.target.closest(".ig-zoom")) return;
    dragged.current = false;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, held: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    // The pointer is captured only once this is clearly a drag. Capturing it on press
    // would hand every click to the frame instead of the node or button beneath it.
    if (!d.held && d.moved > DRAG_MIN) {
      d.held = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (!d.held) return;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const endDrag = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // A press that travelled is a drag, not a tap on a node.
    dragged.current = d.moved > DRAG_MIN;
    drag.current = null;
    if (d.held) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Plain wheel keeps scrolling the page; the graph only takes the gesture when a
  // modifier says so, the way an embedded map does. React attaches wheel passively,
  // which cannot preventDefault, so this one is bound directly.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAbout(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [zoomAbout]);

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 80 : 28;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAbout(1.2, size.w / 2, size.h / 2);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomAbout(1 / 1.2, size.w / 2, size.h / 2);
    } else if (e.key === "0") {
      e.preventDefault();
      fit();
    }
  };

  if (!branches.length) return null;
  const spoken = (interests || [])
    .map((p) => [root, ...(Array.isArray(p) ? p : [p])].filter(Boolean).join(" → "))
    .join("; ");

  const toggle = (n) => () => {
    if (dragged.current) return; // the press that ended here was a pan
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(n.key) ? next.delete(n.key) : next.add(n.key);
      return next;
    });
  };

  const curve = (a, b) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  };

  return (
    <div className="igraph">
      <div
        className="ig-frame"
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label={`Research interests, as a graph you can move and zoom: ${spoken}`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg width="100%" height="100%" aria-hidden="true">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <g className="ig-links">
              {links.map((l) => (
                <path key={l.key} d={curve(l.a, l.b)} className={l.a.open ? "is-open" : ""} style={{ "--c": `var(--h${l.hue})` }} />
              ))}
            </g>
            {nodes.map((n) => (
              <Pill key={n.key || "__root"} node={n} onClick={n.count ? toggle(n) : undefined} />
            ))}
          </g>
        </svg>

        <div className="ig-zoom">
          <button type="button" onClick={() => zoomAbout(1.25, size.w / 2, size.h / 2)} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomAbout(1 / 1.25, size.w / 2, size.h / 2)} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button type="button" className="ig-fit" onClick={fit} aria-label="Fit to frame" title="Fit to frame">
            ⤢
          </button>
        </div>
      </div>
      <p className="small soft igraph-hint">Drag to move · + and − to zoom · click a node to open or close it</p>
    </div>
  );
}

