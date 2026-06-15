// render.js — draw the graph to a <canvas>. Pure presentation: no GA math (the
// projection lives in project.js; reachability comes from the wasm core). Lit
// plateaus are drawn solid; fogged ones dimmed and low-alpha (R-0005 AC4).

import { project } from "./project.js";
import { planLabels } from "./labels.js";

const LIT = "#ffd166";
const LIT_RING = "#fff3c4";
const FOG = "#3a4a5a";
const BRIDGE = "rgba(180, 200, 220, 0.5)";
const LABEL = "rgba(220, 230, 240, 0.85)";
const MARKER = "#7fd0a0"; // Floating trail-marker glyph (R-0014)
const MARKER_SOLID = "#ffd166"; // Crystallized marker — bedrock gold (R-0015)
const MASTERED = "#5dcaa5"; // mastered-topic ✓ (R-0030)
const RADIUS = 16;

/// Draw bridges, plateaus, markers, then remote-wizard silhouettes.
/// `plateaus`/`bridges`/`resources` are the DTO arrays from
/// `WasmGraph.plateaus()/bridges()/resources()`; `peers` is the ephemeral
/// presence list (`{ pubkey, plateau }`, R-0016); `reachable` is a Set of lit
/// plateau ids. Returns the per-plateau screen points for hit-testing — peers are
/// NOT added to it, so silhouettes are unclickable and never affect hit-testing.
export function render(ctx, { plateaus, bridges, reachable, view, resources = [], peers = [], focusedId = null, mastered = new Set() }) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const points = new Map();
  for (const p of plateaus) {
    points.set(p.id, project(p.position, view));
  }

  // Label level-of-detail (R-0024): decide which plateau names to draw so none
  // overlap (focused → lit → rest, greedy box-pack). Discs all draw regardless.
  const labelled = planLabels({ plateaus, points, reachable, focusedId });

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

    if (labelled.has(p.id)) {
      ctx.fillStyle = lit ? "#1b2330" : LABEL;
      ctx.font = lit ? "bold 12px system-ui, sans-serif" : "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, pt.x, pt.y + RADIUS + 14);
    }

    // Mastered ✓ (R-0030): a small green check at the disc's upper-right. Purely
    // additive — the disc radius / hit-test is unchanged.
    if (mastered.has(p.id)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = MASTERED;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", pt.x + RADIUS, pt.y - RADIUS + 4);
    }
    ctx.globalAlpha = 1;
  }

  // Travel focus ring (R-0019): a transient dashed halo around the topic the
  // visitor just travelled to, so the eye finds it. Camera highlight only — it
  // reads `focusedId` and nothing else; it does not affect reach/fog/hit-testing.
  if (focusedId) {
    const pt = points.get(focusedId);
    if (pt) {
      ctx.save();
      ctx.strokeStyle = "#9fd0ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, RADIUS + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
    // Crystallized markers are solid bedrock gold; Floating ones faint green
    // (R-0015). State is computed from votes in to_graph — never client-set.
    const crystallized = r.state === "Crystallized";
    ctx.globalAlpha = crystallized ? 1 : 0.6;
    ctx.fillStyle = crystallized ? MARKER_SOLID : MARKER;
    ctx.beginPath();
    ctx.arc(mx, my, crystallized ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LABEL;
    const n = Math.round(r.vote_count ?? 0);
    ctx.fillText(n > 0 ? `${r.title} · ${n}` : r.title, mx + 8, my + 3);
  }
  ctx.restore();

  // Remote-wizard silhouettes (ephemeral presence, R-0016), drawn last and to the
  // LEFT of the disc so they never collide with markers (on the right). Colour is
  // a deterministic hash of the pubkey; label is a short pubkey. Self is already
  // excluded by the presence layer; peers are NOT added to `points`.
  ctx.save();
  ctx.textAlign = "right";
  ctx.font = "10px system-ui, sans-serif";
  const here = new Map(); // plateauId → silhouettes already placed (for fanning)
  for (const w of peers) {
    const pt = points.get(w.plateau);
    if (!pt) continue; // their plateau isn't in our local graph → skip
    const i = here.get(w.plateau) ?? 0;
    here.set(w.plateau, i + 1);
    const sx = pt.x - RADIUS - 10 - i * 12;
    const sy = pt.y - RADIUS + i * 6;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = hueFor(w.pubkey);
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = LABEL;
    ctx.fillText(short(w.pubkey), sx - 8, sy + 3);
  }
  ctx.restore();

  return points;
}

// Deterministic hue from a pubkey — distinct, stable colours for distinct wizards.
// Pure presentation (no identity meaning beyond "tell them apart").
function hueFor(pubkey) {
  let h = 0;
  for (let i = 0; i < (pubkey?.length ?? 0); i++) h = (h * 31 + pubkey.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, 62%)`;
}

// A short, human-glanceable form of a pubkey for the silhouette label.
function short(pubkey) {
  return typeof pubkey === "string" && pubkey.length > 6 ? pubkey.slice(0, 6) : pubkey || "?";
}

export { RADIUS };
