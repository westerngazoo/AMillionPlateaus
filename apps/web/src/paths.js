// paths.js — pure learning-path helpers (R-0039 / SPEC-0039). No DOM, no wasm.

export const PATH_KIND = 30082;

/**
 * Build a local path object. Validates title, dedupes steps preserving order.
 */
export function buildPath({ id, title, goal, steps = [] }) {
  if (!title || !String(title).trim()) throw new Error("title required");
  const seen = new Set();
  const ordered = [];
  for (const s of steps) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    ordered.push(s);
  }
  return {
    id: id || crypto.randomUUID(),
    title: String(title).trim(),
    goal: String(goal ?? "").trim(),
    steps: ordered,
  };
}

/** Derive domain ids for a path from plateau DTOs (binding seam, mirrors Rust). */
export function pathDomains(plateaus, stepIds) {
  const byId = new Map(plateaus.map((p) => [p.id, p.domain_id]));
  const out = [];
  for (const id of stepIds) {
    const d = byId.get(id);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** First step not yet mastered — the "next step" when following a path. */
export function nextPathStep(stepIds, mastered = new Set()) {
  for (const id of stepIds) {
    if (!mastered.has(id)) return id;
  }
  return null;
}

/**
 * The next-step HUD payload (R-0039): the first not-yet-mastered step plus its
 * 1-based position and the total. `null` when the path is empty or fully mastered
 * (the chip then hides). Pure — the DOM chip in main.js is a thin view over this.
 */
export function nextStepInfo(stepIds = [], mastered = new Set()) {
  const total = stepIds.length;
  const id = nextPathStep(stepIds, mastered);
  if (id === null) return null;
  return { id, position: stepIds.indexOf(id) + 1, total };
}

/** Progress along a path: mastered count / total. */
export function pathProgress(stepIds, mastered = new Set()) {
  if (!stepIds.length) return { done: 0, total: 0 };
  let done = 0;
  for (const id of stepIds) if (mastered.has(id)) done++;
  return { done, total: stepIds.length };
}

/**
 * Published paths from the verified event log. Latest per signer wins;
 * malformed events skipped; sorted by pubkey for determinism.
 */
export function publishedPaths(events = []) {
  const latest = new Map();
  for (const e of events) {
    if (!e || e.kind !== PATH_KIND) continue;
    let parsed;
    try {
      parsed = JSON.parse(e.content);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.title !== "string" || !Array.isArray(parsed.steps)) continue;
    const at = typeof e.created_at === "number" ? e.created_at : 0;
    const prev = latest.get(e.pubkey);
    if (!prev || at >= prev.created_at) {
      latest.set(e.pubkey, {
        pubkey: e.pubkey,
        id: parsed.id,
        title: parsed.title,
        goal: typeof parsed.goal === "string" ? parsed.goal : "",
        steps: parsed.steps.filter((s) => typeof s === "string"),
        domains: Array.isArray(parsed.domains) ? parsed.domains.filter((d) => typeof d === "string") : [],
        created_at: at,
      });
    }
  }
  return [...latest.values()].sort((a, b) =>
    a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0,
  );
}

/**
 * Rank published paths by their author's EARNED REACH (R-0035), best-first.
 * `reachOf(path)` maps a published-path object (which carries `pubkey` + `domains`)
 * to a numeric reach — the grade-1 reputation magnitude the app reads from the GA
 * core; the trust-weighting stays in Rust/wasm, this only orders by it. The default
 * gives every author reach 0, so ranking reduces to `publishedPaths`' pubkey order
 * (back-compatible). Non-mutating. Total order: reach desc → step-count desc →
 * pubkey asc, so equal-reach authors stay deterministic.
 */
export function rankPublishedPaths(paths = [], reachOf = () => 0) {
  return [...paths]
    .map((p) => ({ p, reach: Number(reachOf(p)) || 0 }))
    .sort(
      (a, b) =>
        b.reach - a.reach ||
        (b.p.steps?.length ?? 0) - (a.p.steps?.length ?? 0) ||
        (a.p.pubkey < b.p.pubkey ? -1 : a.p.pubkey > b.p.pubkey ? 1 : 0),
    )
    .map((x) => x.p);
}
