// project.js — pure presentation. Maps a grade-1 GA position (e1,e2,e3) to a 2D
// canvas point via a fixed isometric projection (SPEC-0005 §2.3). No graph
// invariant depends on this; it is unit-testable without wasm.
//
//   screen_x = cx + scale * ( e1 - 0.5 * e2 )
//   screen_y = cy + scale * ( e3 - 0.5 * e2 )   // y grows downward on canvas
//
// e1 → right, e3 → down, e2 → up-left depth. Deterministic, so both tabs draw
// the same map.

export function project({ e1, e2, e3 }, { cx, cy, scale }) {
  return {
    x: cx + scale * (e1 - 0.5 * e2),
    y: cy + scale * (e3 - 0.5 * e2),
  };
}
