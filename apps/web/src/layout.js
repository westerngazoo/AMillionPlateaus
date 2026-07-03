// layout.js — screen-space decluttering for plateau discs (R-0024 extension).
// Obsidian-style: strong repulsion + bridge-aware force layout so dense imports
// (many topics sharing similar GA coords) remain readable in 2D.

/** Default disc radius used by render.js — keep clearance proportional. */
export const DISC_RADIUS = 16;

/** Label sits below the disc — include in minimum separation. */
const LABEL_GAP = 22;

/**
 * Adaptive minimum centre distance — grows with graph size so imported vaults
 * (30–100 nodes) don't collapse into a single blob.
 */
export function adaptiveMinDist(nodeCount, { radius = DISC_RADIUS } = {}) {
  const base = radius * 3.5 + LABEL_GAP;
  const spread = Math.sqrt(Math.max(nodeCount, 1)) * (radius * 0.55);
  return Math.min(160, Math.max(52, base + spread));
}

/** Plateau ids connected to `id` by one bridge hop. */
export function bridgeNeighbors(id, bridges = []) {
  const out = new Set();
  for (const b of bridges) {
    if (b.from === id) out.add(b.to);
    if (b.to === id) out.add(b.from);
  }
  return out;
}

/**
 * Iterative pairwise separation (fast pre-pass).
 */
export function spreadNodes(points, { minDist = 52, iterations = 24 } = {}) {
  const out = new Map([...points].map(([pid, pt]) => [pid, { x: pt.x, y: pt.y }]));
  const ids = [...out.keys()];
  if (ids.length < 2) return out;

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = out.get(ids[i]);
        const b = out.get(ids[j]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= minDist) continue;
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
 * Obsidian-style force layout: repulsion between all pairs, weak attraction along
 * bridges so clusters stay connected but don't stack.
 */
export function forceLayout(points, { bridges = [], minDist = 52, iterations = 48 } = {}) {
  const out = spreadNodes(points, { minDist, iterations: Math.min(20, iterations) });
  const ids = [...out.keys()];
  if (ids.length < 2) return out;

  const repulse = minDist * minDist * 0.85;
  const attract = 0.018;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const a = out.get(idA);
        const b = out.get(idB);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minDist * 0.25) dist = minDist * 0.25;
        const force = repulse / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        disp.get(idA).x += fx;
        disp.get(idA).y += fy;
        disp.get(idB).x -= fx;
        disp.get(idB).y -= fy;
      }
    }

    for (const b of bridges) {
      const a = out.get(b.from);
      const c = out.get(b.to);
      if (!a || !c) continue;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const pull = attract * (dist - minDist * 1.2);
      const fx = (dx / dist) * pull;
      const fy = (dy / dist) * pull;
      disp.get(b.from).x += fx;
      disp.get(b.from).y += fy;
      disp.get(b.to).x -= fx;
      disp.get(b.to).y -= fy;
    }

    const damp = 0.85 - iter / iterations * 0.35;
    for (const id of ids) {
      const p = out.get(id);
      const d = disp.get(id);
      out.set(id, { x: p.x + d.x * damp, y: p.y + d.y * damp });
    }
  }

  return spreadNodes(out, { minDist, iterations: 8 });
}

/**
 * Full layout pipeline: project GA → Obsidian-style spread.
 */
export function layoutGraph(rawPoints, { bridges = [], mode = "obsidian" } = {}) {
  const minDist = adaptiveMinDist(rawPoints.size);
  if (mode === "spread" || rawPoints.size < 4) {
    return spreadNodes(rawPoints, { minDist, iterations: 30 });
  }
  return forceLayout(rawPoints, { bridges, minDist, iterations: 56 });
}

/** @deprecated use adaptiveMinDist */
export const DEFAULT_MIN_DIST = 52;
