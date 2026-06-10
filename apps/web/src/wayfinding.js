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
