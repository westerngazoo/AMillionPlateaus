// labels.js — pure label decluttering for the map (R-0024 / SPEC-0024).
//
// Decides WHICH plateau labels to draw so none overlap. The discs always draw
// (they convey the shape/density at 630 nodes); only labels are culled. Pure: no
// canvas — a label's width is estimated from its name length so this is
// node-testable. Greedy + deterministic: candidates are ordered by priority
// (focused → lit → rest, stable by input order within a tier) and each is kept
// only if its box clears every box already kept. O(n·kept) — ~0.1 ms at 630.

const CHAR_W = 6.6; // ~px per char at 12px system-ui (lit labels are bold/wider)
const LINE_H = 14; // label box height
const RADIUS = 16; // disc radius — the label sits just below the disc

/** The screen-space box a plateau's label would occupy (centered under the disc). */
export function labelBox(name, pt) {
  const w = Math.max(12, (name?.length ?? 0) * CHAR_W);
  return { x: pt.x - w / 2, y: pt.y + RADIUS + 4, w, h: LINE_H };
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Estimated box for any midpoint-anchored caption (bridge concepts, resource titles). */
export function captionBox(text, x, y) {
  const w = Math.max(12, (text?.length ?? 0) * CHAR_W);
  return { x: x - w / 2, y: y - LINE_H / 2, w, h: LINE_H };
}

/**
 * Generic greedy box declutter — the same discipline planLabels applies to names,
 * for ANY caption layer (bridge concepts, resource titles). `candidates` is
 * [{ key, box }] in priority order; `obstacles` are boxes already committed
 * (e.g. the kept name labels) that candidates must clear but never displace.
 * Deterministic; returns the Set of kept keys.
 */
export function planBoxes(candidates, { obstacles = [] } = {}) {
  const kept = new Set();
  const boxes = [...obstacles];
  for (const { key, box } of candidates) {
    if (boxes.some((b) => overlaps(box, b))) continue;
    boxes.push(box);
    kept.add(key);
  }
  return kept;
}

/**
 * The Set of plateau ids whose label should render this frame. `plateaus` is the
 * DTO array, `points` the id→{x,y} screen map, `reachable` the lit Set,
 * `focusedId` the travelled-to id (or null). Priority focused(0) → lit(1) →
 * rest(2), stable by input index within a tier; each label kept only if its box
 * clears all kept boxes.
 */
export function planLabels({ plateaus, points, reachable, focusedId = null }) {
  const rank = (p) => (p.id === focusedId ? 0 : reachable.has(p.id) ? 1 : 2);
  const ordered = plateaus
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);

  const kept = new Set();
  const boxes = [];
  for (const { p } of ordered) {
    const pt = points.get(p.id);
    if (!pt) continue; // off-graph / missing point → no label
    const box = labelBox(p.name, pt);
    if (boxes.some((b) => overlaps(box, b))) continue; // would collide → drop this frame
    boxes.push(box);
    kept.add(p.id);
  }
  return kept;
}
