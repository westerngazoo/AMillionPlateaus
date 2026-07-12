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

/**
 * Generate a route when no existing path fits: breadth-first from `startId`
 * over the bridge graph (bridges are the graph's own "learn these together"
 * signal), keeping the UNMASTERED plateaus of `domainId` in first-reached
 * order, capped at `max`. Out-of-domain neighbours still traverse (they
 * connect regions) but never enter the route. Deterministic: neighbours are
 * visited name-sorted. Missing/foreign `startId` falls back to the domain's
 * first plateau by id. Returns [] when everything in reach is mastered.
 */
export function buildSuggestedRoute({
  plateaus = [],
  bridges = [],
  mastered = new Set(),
  startId = null,
  domainId = null,
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

  const route = [];
  const take = (id) => {
    if (route.length < max && !mastered.has(id) && inDomain(id)) route.push(id);
  };
  const seen = new Set([start]);
  take(start);
  let frontier = [start];
  while (frontier.length && route.length < max) {
    const next = [];
    for (const id of frontier) {
      const ns = (adj.get(id) ?? [])
        .filter((n) => !seen.has(n))
        .sort((a, b) => String(byId.get(a)?.name ?? "").localeCompare(String(byId.get(b)?.name ?? "")));
      for (const n of ns) {
        seen.add(n);
        next.push(n);
        take(n);
      }
    }
    frontier = next;
  }
  return route;
}
