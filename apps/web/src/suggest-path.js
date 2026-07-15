// suggest-path.js — the suggested path (R-0053): the app PROPOSES your next
// route instead of leaving you in front of fifty islands. Two pure levels:
//
//   1. pickSuggested — choose the best EXISTING path for this learner:
//      momentum first (a started-but-unfinished path), then a path covering
//      the learner's current domain, then whichever is closest to done.
//   2. buildSuggestedRoute — when no existing path fits, GENERATE one: BFS
//      from where the learner stands, across the graph's bridges, collecting
//      UNMASTERED topics of their domain nearest-first (bridges in other
//      domains still act as connectors), capped so the suggestion is a walk,
//      not a syllabus.
//
// Both are deterministic (sorted tie-breaks) and grounded in signed data:
// real mastery, real bridges, real position — never a model's guess. $0.
// PURE: no DOM, no wasm handles, no storage. Tested in suggest-path.test.mjs.

import { pathProgress, pathDomains } from "./paths.js";

/**
 * The best existing path for this learner, or null when none has work left.
 * Ranking (lexicographic): started-but-unfinished first (momentum beats
 * novelty) → covers `domainId` → highest fraction already mastered (finish
 * lines motivate) → title (deterministic).
 */
export function pickSuggested({ paths = [], plateaus = [], mastered = new Set(), domainId = null } = {}) {
  const candidates = [];
  for (const p of paths) {
    if (!p || !Array.isArray(p.steps) || !p.steps.length) continue;
    const prog = pathProgress(p.steps, mastered);
    if (prog.done >= prog.total) continue; // finished — nothing to suggest
    candidates.push({
      p,
      key: [
        prog.done > 0 ? 0 : 1,
        domainId && pathDomains(plateaus, p.steps).includes(domainId) ? 0 : 1,
        -(prog.done / prog.total),
        String(p.title ?? ""),
      ],
    });
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) {
      if (a.key[i] < b.key[i]) return -1;
      if (a.key[i] > b.key[i]) return 1;
    }
    return 0;
  });
  return candidates[0]?.p ?? null;
}

// ── Lens-weighted proximity (R-0053 v2) ─────────────────────────────────────
// "Related" DEPENDS ON THE LENS: a persona's orientation (orient[].dir, a
// Grade-1 direction over Formal e1 / Empirical e2 / Creative e3) says which
// axes matter to them. Two topics far apart along an axis the lens emphasises
// are UNRELATED for that learner; distance along axes the lens ignores barely
// counts. So the metric weights each axis by the lens's emphasis.

/**
 * Per-axis weights from a lens direction. Normalised to sum 3 (so the unit
 * lens ≡ plain Euclidean), floored at 0.15 per axis so no axis fully vanishes
 * (a Formal-only lens still distinguishes topics that differ only Creatively).
 * Null/zero lens → [1, 1, 1] (no preference — plain distance).
 */
export function lensWeights(dir) {
  const raw = [Math.abs(dir?.e1 ?? 0), Math.abs(dir?.e2 ?? 0), Math.abs(dir?.e3 ?? 0)];
  const sum = raw[0] + raw[1] + raw[2];
  if (!sum) return [1, 1, 1];
  const floored = raw.map((v) => Math.max(0.15, (v / sum) * 3));
  const s2 = floored[0] + floored[1] + floored[2];
  return floored.map((v) => (v / s2) * 3);
}

/** Lens-weighted distance between two Grade-1 positions ({e1,e2,e3}). */
export function lensDistance(a, b, w = [1, 1, 1]) {
  const d1 = (a?.e1 ?? 0) - (b?.e1 ?? 0);
  const d2 = (a?.e2 ?? 0) - (b?.e2 ?? 0);
  const d3 = (a?.e3 ?? 0) - (b?.e3 ?? 0);
  return Math.sqrt(w[0] * d1 * d1 + w[1] * d2 * d2 + w[2] * d3 * d3);
}

/**
 * Generate a route when no existing path fits. Bridges decide WHAT is
 * reachable (breadth-first from `startId` — they are the graph's own "learn
 * these together" signal; out-of-domain neighbours traverse as connectors but
 * never enter the route); the LENS decides the ORDER: with a `lens` direction,
 * the route is a greedy chain that always hops to the lens-nearest unvisited
 * candidate (ties by name) — the most-related-under-your-focus topic comes
 * next. Without a lens it falls back to plain BFS ring order (name-sorted),
 * unchanged from v1. Capped at `max`; missing/foreign `startId` falls back to
 * the domain's first plateau by id; [] when everything in reach is mastered.
 */
export function buildSuggestedRoute({
  plateaus = [],
  bridges = [],
  mastered = new Set(),
  startId = null,
  domainId = null,
  lens = null,
  max = 7,
} = {}) {
  const byId = new Map(plateaus.map((p) => [p.id, p]));
  const inDomain = (id) => !domainId || byId.get(id)?.domain_id === domainId;
  const adj = new Map();
  for (const b of bridges) {
    if (!byId.has(b.from) || !byId.has(b.to)) continue;
    if (!adj.has(b.from)) adj.set(b.from, []);
    if (!adj.has(b.to)) adj.set(b.to, []);
    adj.get(b.from).push(b.to);
    adj.get(b.to).push(b.from);
  }
  const start =
    startId && byId.has(startId)
      ? startId
      : plateaus
          .filter((p) => inDomain(p.id))
          .map((p) => p.id)
          .sort()[0];
  if (!start) return [];

  // BFS discovery: everything bridge-reachable, in ring order. Candidates are
  // the unmastered in-domain plateaus among them (generously over-collected so
  // the lens has real choices to reorder).
  const seen = new Set([start]);
  const discovered = [start];
  let frontier = [start];
  const budget = Math.max(max * 4, 24);
  while (frontier.length && discovered.length < budget) {
    const next = [];
    for (const id of frontier) {
      const ns = (adj.get(id) ?? [])
        .filter((n) => !seen.has(n))
        .sort((a, b) => String(byId.get(a)?.name ?? "").localeCompare(String(byId.get(b)?.name ?? "")));
      for (const n of ns) {
        seen.add(n);
        next.push(n);
        discovered.push(n);
      }
    }
    frontier = next;
  }
  const candidates = discovered.filter((id) => !mastered.has(id) && inDomain(id));
  if (!lens) return candidates.slice(0, max); // v1 behaviour: BFS ring order

  // Lens chain: hop to the lens-nearest remaining candidate each time.
  const w = lensWeights(lens);
  const route = [];
  let cur = byId.get(start)?.position ?? { e1: 0, e2: 0, e3: 0 };
  const pool = new Set(candidates);
  while (route.length < max && pool.size) {
    let best = null;
    let bestKey = null;
    for (const id of pool) {
      const p = byId.get(id);
      const key = [lensDistance(cur, p?.position ?? {}, w), String(p?.name ?? "")];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = id;
        bestKey = key;
      }
    }
    pool.delete(best);
    route.push(best);
    cur = byId.get(best)?.position ?? cur;
  }
  return route;
}
