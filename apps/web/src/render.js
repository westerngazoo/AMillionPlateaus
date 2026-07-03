// render.js — draw the graph to a <canvas>. Pure presentation: no GA math (the
// projection lives in project.js). Discs are coloured by PROGRESS (R-0033):
// unexplored / studying (visited) / mastered (✓), with the covered trail drawn
// between visited topics. The map is browsable — nothing is dimmed/locked.

import { project } from "./project.js";
import { planLabels } from "./labels.js";
import { layoutGraph, bridgeNeighbors, DISC_RADIUS } from "./layout.js";

const RADIUS = DISC_RADIUS;

const LENS_RADIUS = 20;
const NEIGHBOR_RADIUS = 13;
const CONTEXT_RADIUS = 5;
const UNEXPLORED = "#2f3e50"; // never visited — a clickable node, not "locked"
const UNEXPLORED_RING = "#4a5d72";
const STUDYING = "#e0a64a"; // visited, not yet quizzed
const MASTERED_FILL = "#ffd166"; // quizzed — bedrock gold
const LIT_RING = "#fff3c4"; // ring on a mastered disc
const COVERED = "#6fb6e0"; // a bridge between two visited topics — your trail
const CANONICAL = "#bfe3ff"; // outer ring on a community-approved (crowd-mastered) topic (R-0031)
const BRIDGE = "rgba(180, 200, 220, 0.5)";
const LABEL = "rgba(220, 230, 240, 0.85)";
const MARKER = "#7fd0a0"; // Floating trail-marker glyph (R-0014)
const MARKER_SOLID = "#ffd166"; // Crystallized marker — bedrock gold (R-0015)
const MASTERED = "#5dcaa5"; // mastered-topic ✓ glyph (R-0030)

const CONTEXT_FILL = "rgba(35, 48, 62, 0.35)";
const CONTEXT_RING = "rgba(70, 90, 110, 0.25)";

function nodeTier(id, { lensId, neighbors }) {
  if (!lensId) return "full";
  if (id === lensId) return "lens";
  if (neighbors.has(id)) return "neighbor";
  return "context";
}

function discRadius(tier) {
  if (tier === "lens") return LENS_RADIUS;
  if (tier === "neighbor") return NEIGHBOR_RADIUS;
  if (tier === "context") return CONTEXT_RADIUS;
  return RADIUS;
}

/// Draw bridges, plateaus, markers, then remote-wizard silhouettes.
/// `plateaus`/`bridges`/`resources` are the DTO arrays from
/// `WasmGraph.plateaus()/bridges()/resources()`; `peers` is the ephemeral
/// presence list (`{ pubkey, plateau }`, R-0016); `visited`/`mastered` are Sets
/// of plateau ids that drive the progress colours + covered trail (R-0033/R-0030).
/// Returns the per-plateau screen points for hit-testing — peers are NOT added to
/// it, so silhouettes are unclickable and never affect hit-testing.
export function render(ctx, { plateaus, bridges, view, resources = [], peers = [], focusedId = null, lensId = null, lensMode = false, visited = new Set(), mastered = new Set(), community = new Set(), pathSteps = [], pathNext = null, layoutPreset = "study" }) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const raw = new Map();
  for (const p of plateaus) {
    raw.set(p.id, project(p.position, view));
  }
  const points = layoutGraph(raw, { bridges, preset: layoutPreset });
  const activeLens = lensMode && lensId ? lensId : null;
  const neighbors = activeLens ? bridgeNeighbors(activeLens, bridges) : new Set();

  // Learning-path route (R-0039): dashed line through followed steps, drawn under discs.
  if (pathSteps.length > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(159, 208, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let started = false;
    for (const id of pathSteps) {
      const pt = points.get(id);
      if (!pt) continue;
      if (!started) {
        ctx.moveTo(pt.x, pt.y);
        started = true;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    if (started) ctx.stroke();
    ctx.restore();
  }

  // Label level-of-detail (R-0024): which plateau names to draw so none overlap
  // (priority focused → in-progress → rest, greedy box-pack). The `visited` set is
  // the priority tier post-R-0033 (studied topics keep label priority).
  const labelled = planLabels({
    plateaus,
    points,
    reachable: visited,
    focusedId: activeLens ?? focusedId,
  });

  // Draw order: context shadows → bridges → foreground discs (lens reads on top).
  const drawOrder = [...plateaus].sort((a, b) => {
    const ta = nodeTier(a.id, { lensId: activeLens, neighbors });
    const tb = nodeTier(b.id, { lensId: activeLens, neighbors });
    const rank = (t) => (t === "context" ? 0 : t === "neighbor" ? 1 : 2);
    return rank(ta) - rank(tb);
  });

  // Bridges first, so plateau discs sit on top. A bridge between two VISITED
  // plateaus is "covered" — your trail (R-0033).
  ctx.font = "12px system-ui, sans-serif";
  for (const b of bridges) {
    const a = points.get(b.from);
    const c = points.get(b.to);
    if (!a || !c) continue;
    const covered = visited.has(b.from) && visited.has(b.to);
    ctx.lineWidth = covered ? 2.5 : 2;
    ctx.strokeStyle = covered ? COVERED : BRIDGE;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    if (b.concept) {
      ctx.fillStyle = LABEL;
      ctx.fillText(b.concept, (a.x + c.x) / 2 + 6, (a.y + c.y) / 2 - 6);
    }
  }

  // Plateaus — coloured by PROGRESS (R-0033). Focus lens shrinks distant nodes to shadows.
  for (const p of drawOrder) {
    const pt = points.get(p.id);
    const done = mastered.has(p.id);
    const studying = !done && visited.has(p.id);
    const tier = nodeTier(p.id, { lensId: activeLens, neighbors });
    const r = discRadius(tier);
    const isContext = tier === "context";

    ctx.save();
    if (isContext) ctx.globalAlpha = 0.45;

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    if (isContext) {
      ctx.fillStyle = CONTEXT_FILL;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = CONTEXT_RING;
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = done ? MASTERED_FILL : studying ? STUDYING : UNEXPLORED;
    ctx.fill();
    ctx.lineWidth = done ? 3 : tier === "lens" ? 2.5 : 1.5;
    ctx.strokeStyle = done ? LIT_RING : tier === "lens" ? "#9fd0ff" : UNEXPLORED_RING;
    ctx.stroke();

    // Community-approved (R-0031): an outer "bedrock" ring at RADIUS+4, overlaid on
    // the personal progress fill. Drawn after the disc, before the ✓/markers; the
    // hit radius (RADIUS) is unchanged. Composes all four cases (you / crowd / both
    // / neither) distinctly.
    if (community.has(p.id)) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = CANONICAL;
      ctx.stroke();
    }

    const showLabel = tier === "lens" || (tier !== "context" && labelled.has(p.id));
    if (showLabel) {
      ctx.fillStyle = done || studying ? "#1b2330" : LABEL;
      ctx.font = done || studying || tier === "lens" ? "bold 12px system-ui, sans-serif" : "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, pt.x, pt.y + r + 14);
    }

    if (done) {
      ctx.fillStyle = MASTERED;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", pt.x + r, pt.y - r + 4);
    }
    ctx.restore();
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
      ctx.arc(pt.x, pt.y, RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Path next-step ring (R-0039): highlight the next not-yet-mastered step.
  if (pathNext && pathNext !== focusedId) {
    const pt = points.get(pathNext);
    if (pt) {
      ctx.save();
      ctx.strokeStyle = "#9fd0ff";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, RADIUS + 6, 0, Math.PI * 2);
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
