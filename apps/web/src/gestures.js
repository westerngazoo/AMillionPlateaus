// gestures.js — pure two-pointer pinch reducer (R-0037 / SPEC-0037). No DOM, no state.
// Given two frames of a two-finger gesture — each `{ a:{x,y}, b:{x,y} }` in CANVAS px —
// returns the scale `factor` between them and the midpoint `(cx,cy)` to zoom about, i.e.
// the args for the existing R-0024 `zoomAt(view, factor, cx, cy)`. Coincident points or
// any non-finite/≤0 result ⇒ `factor: 1` (a no-op), so a malformed frame can never push
// NaN/∞/0 into `zoomAt`. Deterministic; unit-tested in gestures.test.mjs.

export function pinch(prev, cur) {
  const d0 = Math.hypot(prev.a.x - prev.b.x, prev.a.y - prev.b.y);
  const d1 = Math.hypot(cur.a.x - cur.b.x, cur.a.y - cur.b.y);
  let factor = d0 > 0 ? d1 / d0 : 1;
  if (!Number.isFinite(factor) || factor <= 0) factor = 1;
  return { factor, cx: (cur.a.x + cur.b.x) / 2, cy: (cur.a.y + cur.b.y) / 2 };
}
