// render.js — TRANSITIONAL SHIM (SPEC-0043 §5.3). The renderer has been split into
// a pure `viewModel(graph, positions, state) → Frame` (viewpipeline.js) and a
// mechanical `canvasRenderer`/`drawFrame` (renderers/canvas.js). This shim keeps
// the original `render(ctx, {…})` signature so the draw-call-log gate proves the
// extraction is byte-for-byte identical BEFORE main.js is rewired (§5.4). It does
// exactly what it always did: project → spreadNodes → compute the frame → draw it,
// returning the per-plateau screen points for hit-testing.

import { project } from "./project.js";
import { spreadNodes } from "./layout.js";
import { viewModel } from "./viewpipeline.js";
import { drawFrame } from "./renderers/canvas.js";

export function render(
  ctx,
  {
    plateaus,
    bridges,
    view,
    resources = [],
    peers = [],
    focusedId = null,
    visited = new Set(),
    mastered = new Set(),
    community = new Set(),
    pathSteps = [],
    pathNext = null,
    focusDomains = new Set(),
  },
) {
  const raw = new Map();
  for (const p of plateaus) {
    raw.set(p.id, project(p.position, view));
  }
  const positions = spreadNodes(raw);

  const frame = viewModel({ plateaus, bridges, resources }, positions, {
    visited,
    mastered,
    community,
    focusedId,
    focusDomains,
    pathSteps,
    pathNext,
    peers,
  });
  drawFrame(ctx, frame);

  // Peers are NOT in `positions`, so silhouettes stay unclickable (unchanged).
  return positions;
}
