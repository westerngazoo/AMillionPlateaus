// layout.js — pure screen-space decluttering for plateau discs (R-0024 extension).
// After the isometric projection, nearby topics can overlap visually; this spreads
// them apart while preserving relative structure. Pure + node-testable.

/** Minimum centre-to-centre distance between two plateau discs. Wider than the
 *  disc diameter (2×RADIUS = 32) so focus discs get Obsidian-style breathing room
 *  and their labels have somewhere to sit; the focus/context tier (render.js) does
 *  the rest of the decluttering by shrinking out-of-lens nodes to shadow dots. */
export const DEFAULT_MIN_DIST = 56;

/**
 * Iteratively separate overlapping nodes. Returns a new Map<id, {x,y}>.
 * `points` is the raw projected positions; `minDist` is the clearance target.
 */
export function spreadNodes(points, { minDist = DEFAULT_MIN_DIST, iterations = 10 } = {}) {
  const out = new Map([...points].map(([id, pt]) => [id, { x: pt.x, y: pt.y }]));
  const ids = [...out.keys()];
  if (ids.length < 2) return out;

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = out.get(ids[i]);
        const b = out.get(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          // Exactly-coincident nodes have no separation direction (dx=dy=0 would
          // make the push a zero vector and they'd never split — e.g. a drafted
          // plateau at the same sliders as a seed). Pick a deterministic angle
          // from the pair indices so every replica separates identically.
          const angle = ((i * 31 + j * 17) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        out.set(ids[i], { x: a.x - ux * push, y: a.y - uy * push });
        out.set(ids[j], { x: b.x + ux * push, y: b.y + uy * push });
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

/**
 * A force-directed layout for the graph.
 * Pulls connected nodes together (springs) and pushes all nodes apart (Coulomb).
 * Phase 2 (#52) sibling strategy to spreadNodes.
 */
export function forceLayout(points, { bridges = [], minDist = DEFAULT_MIN_DIST, iterations = 50, alpha = 0.5 } = {}) {
  const out = new Map([...points].map(([id, pt]) => [id, { x: pt.x, y: pt.y, vx: 0, vy: 0 }]));
  const ids = [...out.keys()];
  if (ids.length < 2) return out;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = out.get(ids[i]);
        const b = out.get(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          const angle = ((i * 31 + j * 17) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        if (dist < minDist * 2) {
          // Coulomb term, CAPPED: uncapped, a near-coincident pair gets
          // minDist²/dist² (thousands) and one kick flings the whole layout
          // off-canvas — a fresh 50-topic world rendered as a BLANK map, every
          // disc at ±3000px. Cap the pairwise force; the per-step clamp below
          // bounds the pile-up of many pairs.
          const force = Math.min((minDist * minDist) / (dist * dist), minDist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    for (const bridge of bridges) {
      const source = out.get(bridge.from);
      const target = out.get(bridge.to);
      if (!source || !target) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.hypot(dx, dy);
      if (dist > minDist) {
        const force = (dist - minDist) * 0.1;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    for (const id of ids) {
      const node = out.get(id);
      // Clamp the per-iteration displacement: no single step may move a node
      // more than minDist/4, whatever the surrounding pile-up sums to. This is
      // the stability guarantee — forces vanish once nodes clear minDist*2, so
      // a clamped walk converges NEAR its input instead of exploding off it.
      let sx = node.vx * alpha;
      let sy = node.vy * alpha;
      const step = Math.hypot(sx, sy);
      const maxStep = minDist / 4;
      if (step > maxStep) {
        sx *= maxStep / step;
        sy *= maxStep / step;
      }
      node.x += sx;
      node.y += sy;
      node.vx *= 0.5;
      node.vy *= 0.5;
    }
  }

  const final = new Map();
  for (const [id, node] of out) {
    final.set(id, { x: node.x, y: node.y });
  }
  return final;
}
