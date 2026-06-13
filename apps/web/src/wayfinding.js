// wayfinding.js — pure. Camera math for "travel to a topic" (SPEC-0019/R-0019).
// Returns the view origin {cx,cy} that places `position` at the canvas centre
// under project.js's fixed isometric projection:
//
//   project: x = cx + scale·(e1 − ½e2),  y = cy + scale·(e3 − ½e2)
//
// Solving x = width/2, y = height/2 for {cx,cy} inverts it. No GA, no graph
// state — travel only moves the camera; it never touches reachability/fog.
export function centerOn({ e1 = 0, e2 = 0, e3 = 0 }, { width, height }, scale) {
  return {
    cx: width / 2 - scale * (e1 - 0.5 * e2),
    cy: height / 2 - scale * (e3 - 0.5 * e2),
  };
}

// ── Zoom (R-0024) ──────────────────────────────────────────────────────────
// `scale` is screen-px per GA unit; zooming spreads/contracts the cluster while
// discs keep a fixed screen radius. Clamp keeps you out of the void / the dot.
export const SCALE_MIN = 80;
export const SCALE_MAX = 4000;
export const clampScale = (s) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

// Zoom `view` by `factor`, keeping the SCREEN point (sx,sy) fixed (cursor-
// anchored). project.js is affine in (cx,scale): x = cx + scale·(e1−½e2). The
// world-projected coord under the cursor is (sx−cx)/scale; solving the same
// projection for the new origin gives cx' = sx − k·(sx−cx) with k = scale'/scale.
// Anchoring in already-projected screen space, the −½e2 axis term never enters.
// At a clamp edge k == 1 → origin unchanged (no jump). Pure.
export function zoomAt(view, factor, sx, sy) {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { cx: sx - k * (sx - view.cx), cy: sy - k * (sy - view.cy), scale };
}
