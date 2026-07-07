// viewpipeline.js — the pure view model (SPEC-0043 §2.1/§2.2, RFC-0003 §4).
//
// `viewModel(graph, positions, state) → Frame`. It owns EVERY styling, emphasis,
// colour-token, label/caption, marker/peer, and z-tier decision that `render.js`
// used to make inline — with NO `ctx` reference anywhere, so it is unit- and
// snapshot-testable exactly like `labels.js`. The renderer (`renderers/canvas.js`)
// is a mechanical replay of the `Frame`; the hex palette lives there.
//
// The `Frame` is derived block-by-block from `render.js` and preserves the
// co-occurrence a single node can carry — `ring:"lit"` (progress) AND
// `communityRing:true` (bedrock) AND `mastered:true` (✓) are three DISTINCT
// decorations, never folded into one field.

import { planLabels, planBoxes, labelBox, captionBox } from "./labels.js";

// The disc radius — the geometry authority for declutter boxes here AND the draw
// offsets in the renderer (which imports it). Equal to the hit radius (hittest.js).
export const RADIUS = 16;

/**
 * @param graph     `{ plateaus, bridges, resources }` (DTO arrays).
 * @param positions `Map<id,{x,y}>` — the placed + decluttered screen points.
 * @param state     `{ visited, mastered, community, focusedId, focusDomains,
 *                     pathSteps, pathNext, peers }`.
 * @returns Frame — everything a renderer needs for one paint, free of `ctx`.
 */
export function viewModel(
  { plateaus = [], bridges = [], resources = [] },
  positions,
  {
    visited = new Set(),
    mastered = new Set(),
    community = new Set(),
    focusedId = null,
    focusDomains = new Set(),
    pathSteps = [],
    pathNext = null,
    peers = [],
    groundedPlateaus = new Map(),
  } = {},
) {
  // Focus + context (PR #42): plateaus in the lens's domains — plus anything you've
  // touched (visited/mastered/focused) OR any step of the path you're following —
  // are FULL; the rest are shadow dots. A followed path lights its whole route
  // regardless of lens, so the journey a learner chose is never dimmed to context
  // (R-0044-adjacent, ported from the pre-seam render.js). No focus set ⇒
  // everything full. `viewModel` OWNS this emphasis model.
  const pathStepSet = new Set(pathSteps);
  const inFocus = (p) =>
    focusDomains.size === 0 ||
    focusDomains.has(p.domain_id) ||
    pathStepSet.has(p.id) ||
    visited.has(p.id) ||
    mastered.has(p.id) ||
    p.id === focusedId;

  // Learning-path route (R-0039): resolved to the existing points, drawn under
  // discs. `null` (not `[]`) below 2 steps — matches the `pathSteps.length > 1`
  // gate, so the renderer's route branch is a pure null-check.
  let pathRoute = null;
  if (pathSteps.length > 1) {
    pathRoute = [];
    for (const id of pathSteps) {
      const pt = positions.get(id);
      if (!pt) continue;
      pathRoute.push({ x: pt.x, y: pt.y });
    }
  }

  // Label LOD (R-0024): which focus-plateau names survive the greedy box-pack.
  // Shadow (out-of-focus) plateaus are excluded from labelling entirely.
  const focusPlateaus = plateaus.filter(inFocus);
  const focusIds = new Set(focusPlateaus.map((p) => p.id));
  const labelled = planLabels({
    plateaus: focusPlateaus,
    points: positions,
    reachable: visited,
    focusedId,
  });

  // Caption declutter: bridge concepts + resource titles go through the SAME
  // greedy pack as names, with the kept name labels as immovable obstacles.
  const nameBoxes = plateaus
    .filter((p) => labelled.has(p.id))
    .map((p) => labelBox(p.name, positions.get(p.id)));

  const conceptCandidates = [];
  for (const b of bridges) {
    const a = positions.get(b.from);
    const c = positions.get(b.to);
    if (!a || !c || !b.concept) continue;
    // Only caption a connection touching the focus region (context stays quiet).
    if (!focusIds.has(b.from) && !focusIds.has(b.to)) continue;
    conceptCandidates.push({
      key: b.id,
      box: captionBox(b.concept, (a.x + c.x) / 2 + 6, (a.y + c.y) / 2 - 6),
    });
  }
  const captionedBridges = planBoxes(conceptCandidates, { obstacles: nameBoxes });

  // Edges (bridges): a line for every bridge with both endpoints present; a
  // caption only when the concept survived declutter. `covered` = the trail
  // between two visited topics (R-0033).
  const edges = [];
  for (const b of bridges) {
    const a = positions.get(b.from);
    const c = positions.get(b.to);
    if (!a || !c) continue;
    const covered = visited.has(b.from) && visited.has(b.to);
    edges.push({
      from: { x: a.x, y: a.y },
      to: { x: c.x, y: c.y },
      covered,
      caption: b.concept && captionedBridges.has(b.id) ? b.concept : null,
    });
  }

  // Nodes — in plateaus order, tagged by tier so the renderer can replay the
  // shadow pass, the interleaved focus pass, and the names pass in source order.
  // Shadow nodes carry ONLY {id,x,y,fill} meaningfully; every decoration is
  // null/false. A shadow node is never "studying" (visited ⇒ focus), so its fill
  // is only "mastered" or "unexplored".
  const nodes = [];
  for (const p of plateaus) {
    const pt = positions.get(p.id);
    if (!inFocus(p)) {
      nodes.push({
        id: p.id,
        x: pt.x,
        y: pt.y,
        tier: "shadow",
        fill: mastered.has(p.id) ? "mastered" : "unexplored",
        ring: null,
        communityRing: false,
        mastered: false,
        label: null,
        groundedWith: null,
      });
      continue;
    }
    const done = mastered.has(p.id);
    const studying = !done && visited.has(p.id);
    nodes.push({
      id: p.id,
      x: pt.x,
      y: pt.y,
      tier: "focus",
      fill: done ? "mastered" : studying ? "studying" : "unexplored",
      ring: done ? "lit" : "unexplored",
      communityRing: community.has(p.id),
      mastered: done,
      label: labelled.has(p.id) ? p.name : null,
      groundedWith: groundedPlateaus.get(p.id) || null,
    });
  }

  // Markers (R-0014/R-0015): dots anchored to their plateau, stacked by i*14.
  // The DOT signals the resource TYPE (coloured by `kind` in the renderer); the
  // title lives in the study drawer, NOT on the map — the always-on captions made
  // the map text-soup, so `caption` is null (kept for a future hover/opt-in).
  // x/y is the dot's FINAL screen position (the stack offset applied HERE, once —
  // the renderer replays it verbatim, and `hitMarkers` hit-tests the same point),
  // and each dot carries `{id, plateauId}` so a CLICK on it opens the study
  // drawer at that resource — post-declutter the dot is the resource's only
  // visible trace, so it must be interactive, not draw-only.
  const markers = [];
  {
    const placed = new Map();
    for (const r of resources) {
      const pt = positions.get(r.plateau_id);
      if (!pt) continue; // orphan anchor → skip (the DOT never draws either)
      const i = placed.get(r.plateau_id) ?? 0;
      placed.set(r.plateau_id, i + 1);
      markers.push({
        id: r.id,
        plateauId: r.plateau_id,
        x: pt.x + RADIUS + 10,
        y: pt.y - RADIUS + i * 14,
        crystallized: r.state === "Crystallized",
        kind: r.kind ?? null,
        caption: null,
      });
    }
  }

  // Peers (R-0016): silhouettes to the LEFT of the disc, fanned; colour is a
  // deterministic hue of the pubkey, label a short pubkey. Never added to any
  // hit-test set — presentation only.
  const peerViews = [];
  {
    const here = new Map();
    for (const w of peers) {
      const pt = positions.get(w.plateau);
      if (!pt) continue;
      const i = here.get(w.plateau) ?? 0;
      here.set(w.plateau, i + 1);
      peerViews.push({
        x: pt.x,
        y: pt.y,
        fanIndex: i,
        hue: hueFor(w.pubkey),
        label: short(w.pubkey),
      });
    }
  }

  // Overlay rings (R-0019/R-0039): resolved to their point, or null when the
  // target id is absent/unset (the renderer never strokes a missing ring).
  const focusPt = focusedId ? positions.get(focusedId) : null;
  const nextPt = pathNext && pathNext !== focusedId ? positions.get(pathNext) : null;
  const overlays = {
    focusRing: focusPt ? { x: focusPt.x, y: focusPt.y } : null,
    nextStepRing: nextPt ? { x: nextPt.x, y: nextPt.y } : null,
  };

  return { edges, pathRoute, nodes, markers, peers: peerViews, overlays };
}

// Deterministic hue from a pubkey — distinct, stable colours for distinct wizards.
// Pure presentation (no identity meaning beyond "tell them apart").
export function hueFor(pubkey) {
  let h = 0;
  for (let i = 0; i < (pubkey?.length ?? 0); i++) h = (h * 31 + pubkey.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, 62%)`;
}

// A short, human-glanceable form of a pubkey for the silhouette label.
export function short(pubkey) {
  return typeof pubkey === "string" && pubkey.length > 6 ? pubkey.slice(0, 6) : pubkey || "?";
}
