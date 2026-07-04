// renderers/canvas.js — the ONLY code that touches a 2D context (SPEC-0043 §2.3,
// RFC-0003 §4). `canvasRenderer(canvas).draw(frame)` mechanically replays a `Frame`
// (from viewpipeline.js) in the exact z-order render.js drew today, holding NO state
// between frames. Colours are semantic tokens in the `Frame`; the 12 hex constants
// live HERE, proven 1:1 with render.js's originals by a unit test (SPEC-0043 §2.3).
//
// Critical ordering nuance: the focus disc, its community bedrock ring, and its ✓
// are replayed PER NODE in one interleaved pass — NOT as three global tiers — so a
// later node's disc can paint over an earlier node's ✓/ring, exactly as before.
// Only names are a genuinely separate final pass. Full order:
//   path route → bridges(+captions) → shadow discs
//   → FOR EACH focus node: disc → communityRing → ✓
//   → names → focus ring → next-step ring → markers → peers

import { RADIUS } from "../viewpipeline.js";

// The progress/community/marker palette (byte-for-byte render.js:11-22, R-0033/
// R-0030/R-0031). The token→hex mapping below is the same decision render.js made
// inline, just named — a unit test asserts this table equals the current constants.
export const PALETTE = {
  UNEXPLORED: "#2f3e50", // never visited — a clickable node, not "locked"
  UNEXPLORED_RING: "#4a5d72",
  STUDYING: "#e0a64a", // visited, not yet quizzed
  MASTERED_FILL: "#ffd166", // quizzed — bedrock gold
  LIT_RING: "#fff3c4", // ring on a mastered disc
  COVERED: "#6fb6e0", // a bridge between two visited topics — your trail
  CANONICAL: "#bfe3ff", // outer ring on a community-approved topic (R-0031)
  BRIDGE: "rgba(180, 200, 220, 0.5)",
  LABEL: "rgba(220, 230, 240, 0.85)",
  MARKER: "#7fd0a0", // Floating trail-marker glyph (R-0014)
  MARKER_SOLID: "#ffd166", // Crystallized marker — bedrock gold (R-0015)
  MASTERED: "#5dcaa5", // mastered-topic ✓ glyph (R-0030)
};

// Token → hex, exactly the inline ternaries render.js used for the progress fill
// and the progress ring. Kept as named tables so a Phase-3 WebGL renderer can
// remap them without widening the parity surface.
export const FILL = {
  unexplored: PALETTE.UNEXPLORED,
  studying: PALETTE.STUDYING,
  mastered: PALETTE.MASTERED_FILL,
};
export const RING = {
  unexplored: PALETTE.UNEXPLORED_RING,
  lit: PALETTE.LIT_RING,
};

const SHADOW_RADIUS = 9; // context (out-of-focus) dot radius (implied by tier)
const PATH_STROKE = "rgba(159, 208, 255, 0.9)"; // R-0039 dashed route
const RING_STROKE = "#9fd0ff"; // R-0019/R-0039 focus + next-step rings

// Replay a Frame through a 2D context. Free function so render.js's transitional
// shim can share the exact same op sequence during migration (SPEC-0043 §5.3).
export function drawFrame(ctx, frame) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Path route (R-0039), UNDER the discs.
  if (frame.pathRoute) {
    ctx.save();
    ctx.strokeStyle = PATH_STROKE;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let started = false;
    for (const pt of frame.pathRoute) {
      if (started) {
        ctx.lineTo(pt.x, pt.y);
      } else {
        ctx.moveTo(pt.x, pt.y);
        started = true;
      }
    }
    if (started) ctx.stroke();
    ctx.restore();
  }

  // Bridges first, so discs sit on top; a covered bridge is the trail (R-0033).
  ctx.font = "12px system-ui, sans-serif";
  for (const e of frame.edges) {
    ctx.lineWidth = e.covered ? 2.5 : 2;
    ctx.strokeStyle = e.covered ? PALETTE.COVERED : PALETTE.BRIDGE;
    ctx.beginPath();
    ctx.moveTo(e.from.x, e.from.y);
    ctx.lineTo(e.to.x, e.to.y);
    ctx.stroke();
    if (e.caption !== null) {
      ctx.fillStyle = PALETTE.LABEL;
      ctx.fillText(e.caption, (e.from.x + e.to.x) / 2 + 6, (e.from.y + e.to.y) / 2 - 6);
    }
  }

  // Shadow (context) discs first — small radius, low alpha.
  for (const n of frame.nodes) {
    if (n.tier !== "shadow") continue;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(n.x, n.y, SHADOW_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = FILL[n.fill];
    ctx.fill();
    ctx.restore();
  }

  // Focus discs — disc → community bedrock ring → ✓, INTERLEAVED per node so a
  // later disc can overpaint an earlier node's decorations (pixel-preserving).
  for (const n of frame.nodes) {
    if (n.tier !== "focus") continue;
    ctx.beginPath();
    ctx.arc(n.x, n.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = FILL[n.fill];
    ctx.fill();
    ctx.lineWidth = n.mastered ? 3 : 1.5;
    ctx.strokeStyle = RING[n.ring];
    ctx.stroke();

    if (n.communityRing) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, RADIUS + 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.CANONICAL;
      ctx.stroke();
    }

    if (n.mastered) {
      ctx.fillStyle = PALETTE.MASTERED;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", n.x + RADIUS, n.y - RADIUS + 4);
    }
  }

  // Names LAST, so text is never occluded by a neighbouring disc. Focus only.
  for (const n of frame.nodes) {
    if (n.tier !== "focus" || n.label === null) continue;
    ctx.fillStyle = PALETTE.LABEL;
    ctx.font =
      n.fill === "unexplored" ? "12px system-ui, sans-serif" : "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(n.label, n.x, n.y + RADIUS + 14);
  }

  // Travel focus ring (R-0019).
  if (frame.overlays.focusRing) {
    const o = frame.overlays.focusRing;
    ctx.save();
    ctx.strokeStyle = RING_STROKE;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(o.x, o.y, RADIUS + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Path next-step ring (R-0039).
  if (frame.overlays.nextStepRing) {
    const o = frame.overlays.nextStepRing;
    ctx.save();
    ctx.strokeStyle = RING_STROKE;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(o.x, o.y, RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Markers (R-0014/R-0015), anchored to their plateau, stacked by i*14.
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "10px system-ui, sans-serif";
  for (const m of frame.markers) {
    const mx = m.x + RADIUS + 10;
    const my = m.y - RADIUS + m.stackIndex * 14;
    ctx.globalAlpha = m.crystallized ? 1 : 0.6;
    ctx.fillStyle = m.crystallized ? PALETTE.MARKER_SOLID : PALETTE.MARKER;
    ctx.beginPath();
    ctx.arc(mx, my, m.crystallized ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (m.caption !== null) {
      ctx.fillStyle = PALETTE.LABEL;
      ctx.fillText(m.caption, mx + 8, my + 3);
    }
  }
  ctx.restore();

  // Remote-wizard silhouettes (R-0016), LEFT of the disc, fanned.
  ctx.save();
  ctx.textAlign = "right";
  ctx.font = "10px system-ui, sans-serif";
  for (const w of frame.peers) {
    const sx = w.x - RADIUS - 10 - w.fanIndex * 12;
    const sy = w.y - RADIUS + w.fanIndex * 6;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = w.hue;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.LABEL;
    ctx.fillText(w.label, sx - 8, sy + 3);
  }
  ctx.restore();
}

/**
 * A canvas-2D renderer bound to one `<canvas>`. `draw(frame)` is the only public
 * surface (RFC-0003 §4: hit-testing is NOT on the renderer). Holds no per-frame
 * state — just the cached context.
 */
export function canvasRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  return {
    draw(frame) {
      drawFrame(ctx, frame);
    },
  };
}
