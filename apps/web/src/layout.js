// layout.js — pure screen-space decluttering for plateau discs (R-0024 extension).
// After the isometric projection, nearby topics can overlap visually; this spreads
// them apart while preserving relative structure. Pure + node-testable.

/** Minimum centre-to-centre distance between two plateau discs. */
export const DEFAULT_MIN_DIST = 40; // 2×RADIUS(16) + label gap

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
