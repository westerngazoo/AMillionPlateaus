// hittest.js — pure screen-space hit-testing over the last-drawn placement map
// (SPEC-0043 §2.4 / RFC-0003 §4). Lifts `main.js`'s node-pick loop + `pickBridge`
// into one function over `positions` (the same `Map<id,{x,y}>` the renderer drew),
// decoupled from drawing. It is NOT a method on the renderer: a future 3D renderer
// supplies its own raycast `hitTest` over its own placements.
//
// A disc wins over a bridge (matching main.js precedence). We iterate `positions`
// KEYS, not `graph.plateaus()` — so `hitTest` is TOTAL by construction and can
// never dereference a missing point (the pre-extraction loop did `points.get(p.id).x`
// with no guard, a latent NPE once draw and click read different sets). The only
// observable difference: a plateau authored/synced between a draw and a click is
// clickable one frame later — imperceptible (the next draw is immediate), safer.

import { pickBridge } from "./wayfinding.js";

// Disc hit radius — unchanged from the pre-refactor node-pick (render.js RADIUS).
export const RADIUS = 16;

/**
 * The id of the element under (x,y), or null. Discs first (nearest within RADIUS,
 * ties broken last-wins to match `d <= best`), then bridges via `pickBridge`.
 * `positions` is the drawn placement map; `bridges`/`tol` ride the options bag so
 * the primary signature stays `hitTest(positions, x, y)` (SPEC-0043 §2.4).
 */
export function hitTest(positions, x, y, { bridges = [], tol = 6 } = {}) {
  let hitId = null;
  let best = RADIUS * RADIUS; // inclusive: a cursor exactly RADIUS away still hits
  for (const [id, pt] of positions) {
    const d = (pt.x - x) ** 2 + (pt.y - y) ** 2;
    if (d <= best) {
      best = d;
      hitId = id;
    }
  }
  if (hitId !== null) return hitId; // a disc under the cursor wins over any bridge
  return pickBridge({ bridges, points: positions, mx: x, my: y, tol });
}
