// Research interests drawn as a tree rather than a row of tags, so you can see how
// someone's work narrows: Technology → Human–computer interaction → Technostress.
//
// Each interest is stored as a path of steps. The researcher's discipline is the root,
// and paths that share their opening steps share those branches.

/** Fold a list of paths into a tree. Order follows first appearance, so it stays stable. */
export function interestTree(paths) {
  const root = [];
  for (const path of paths || []) {
    const steps = Array.isArray(path) ? path : [path];
    let level = root;
    for (const step of steps.filter(Boolean)) {
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

/**
 * @param interests  the stored paths
 * @param root       the discipline they hang from; omitted, the top steps stand alone
 */
export function InterestTree({ interests, root }) {
  const nodes = interestTree(interests);
  if (!nodes.length) return null;
  // Written out in order as well, so a screen reader gets the path rather than a list
  // of loose words, and so the shape survives if the connectors don't draw.
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
