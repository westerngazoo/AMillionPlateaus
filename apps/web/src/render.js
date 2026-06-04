// render.js — draw the graph to a <canvas>. Pure presentation: no GA math (the
// projection lives in project.js; reachability comes from the wasm core). Lit
// plateaus are drawn solid; fogged ones dimmed and low-alpha (R-0005 AC4).

import { project } from "./project.js";

const LIT = "#ffd166";
const LIT_RING = "#fff3c4";
const FOG = "#3a4a5a";
const BRIDGE = "rgba(180, 200, 220, 0.5)";
const LABEL = "rgba(220, 230, 240, 0.85)";
const MARKER = "#7fd0a0"; // trail-marker glyph (R-0014)
const RADIUS = 16;

/// Draw bridges, plateaus, then markers. `plateaus`/`bridges`/`resources` are the
/// DTO arrays from `WasmGraph.plateaus()/bridges()/resources()`; `reachable` is a
/// Set of lit plateau ids. Returns the per-plateau screen points for hit-testing.
export function render(ctx, { plateaus, bridges, reachable, view, resources = [] }) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const points = new Map();
  for (const p of plateaus) {
    points.set(p.id, project(p.position, view));
  }

  // Bridges first, so plateau discs sit on top.
  ctx.lineWidth = 2;
  ctx.strokeStyle = BRIDGE;
  ctx.font = "12px system-ui, sans-serif";
  for (const b of bridges) {
    const a = points.get(b.from);
    const c = points.get(b.to);
    if (!a || !c) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    if (b.concept) {
      ctx.fillStyle = LABEL;
      ctx.fillText(b.concept, (a.x + c.x) / 2 + 6, (a.y + c.y) / 2 - 6);
    }
  }

  // Plateaus.
  for (const p of plateaus) {
    const pt = points.get(p.id);
    const lit = reachable.has(p.id);
    ctx.globalAlpha = lit ? 1 : 0.35;

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = lit ? LIT : FOG;
    ctx.fill();
    if (lit) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = LIT_RING;
      ctx.stroke();
    }

    ctx.fillStyle = lit ? "#1b2330" : LABEL;
    ctx.font = lit ? "bold 12px system-ui, sans-serif" : "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, pt.x, pt.y + RADIUS + 14);
    ctx.globalAlpha = 1;
  }

  // Markers (trail markers / resources), anchored to their plateau (R-0014).
  // Drawn last so they sit on top; a Floating marker is faint, a Crystallized
  // one solid (R-0015). save/restore keeps font/textAlign/alpha self-contained.
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "10px system-ui, sans-serif";
  const placed = new Map(); // plateauId → markers already drawn (for stacking)
  for (const r of resources) {
    const pt = points.get(r.plateau_id);
    if (!pt) continue; // orphan anchor (plateau not present) → skip
    const i = placed.get(r.plateau_id) ?? 0;
    placed.set(r.plateau_id, i + 1);
    const mx = pt.x + RADIUS + 10;
    const my = pt.y - RADIUS + i * 14;
    ctx.globalAlpha = r.state === "Crystallized" ? 1 : 0.6;
    ctx.fillStyle = MARKER;
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LABEL;
    ctx.fillText(r.title, mx + 8, my + 3);
  }
  ctx.restore();

  return points;
}

export { RADIUS };
