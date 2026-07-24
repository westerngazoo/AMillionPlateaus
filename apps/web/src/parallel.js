// parallel.js — study one topic in two formalisms at once (R-0097). Pure.
//
// R-0096 gave every cuatrimestre-1–3 course an alternative-formalism TWIN living
// in its own lens (GA or SIA), joined by a cross-lens bridge whose concept is
// exactly `alternative formulation of`. That uniform label is the handle: this
// module turns those edges into a pairing, so the app can show a course and its
// twin SIDE BY SIDE and walk both routes in step.
//
// Nothing here is degree-specific. Any two lenses joined by that concept pair up
// — an adopted lens (R-0093) that brings its own twins works the same way.

export const TWIN_CONCEPT = "alternative formulation of";

/**
 * id → counterpart id, in BOTH directions. A twin edge is authored as
 * twin → course, but you may be reading either side, so the map answers from
 * whichever end you are on. First edge wins if a topic somehow has two twins:
 * the pairing must be a stable function, not order-dependent chaos.
 */
export function twinMap(bridges) {
  const m = new Map();
  for (const b of Array.isArray(bridges) ? bridges : []) {
    if (!b || b.concept !== TWIN_CONCEPT || !b.from || !b.to || b.from === b.to) continue;
    if (!m.has(b.from)) m.set(b.from, b.to);
    if (!m.has(b.to)) m.set(b.to, b.from);
  }
  return m;
}

/** The counterpart of `id`, or null. `map` is an optional prebuilt twinMap. */
export function twinOf(id, bridges, map) {
  if (!id) return null;
  const m = map instanceof Map ? map : twinMap(bridges);
  return m.get(id) ?? null;
}

/**
 * Walk a path and pair every step with its twin:
 *   [{ left, right|null, hasTwin }]
 * `left` is always the step as the path lists it; `right` is the counterpart, or
 * null where none is written yet (later cuatrimestres). Callers render the null
 * case as "no parallel view yet" rather than hiding the step — the gap is
 * information, not an error.
 */
export function pairPath(steps, bridges, map) {
  const m = map instanceof Map ? map : twinMap(bridges);
  return (Array.isArray(steps) ? steps : [])
    .filter(Boolean)
    .map((left) => {
      const right = m.get(left) ?? null;
      return { left, right, hasTwin: right !== null };
    });
}

/**
 * Locate a topic within a paired path, matching on EITHER side — you may have
 * arrived from the course lens or from the twin lens. Returns the index, or -1.
 */
export function indexOfPair(pairs, id) {
  if (!id) return -1;
  return (Array.isArray(pairs) ? pairs : []).findIndex(
    (p) => p && (p.left === id || p.right === id),
  );
}

/**
 * Step to the adjacent pair — this is "jump across paths": one control moves BOTH
 * panes, because the two routes are the same syllabus seen twice. `dir` is +1 or
 * -1. Returns the pair, or null at either end (so the caller can disable the
 * button rather than wrap around silently).
 *
 * `onlyTwinned: true` skips steps that have no counterpart, so a reader following
 * the parallel route lands only where both views actually exist.
 */
export function stepPair(pairs, id, dir, { onlyTwinned = false } = {}) {
  const list = Array.isArray(pairs) ? pairs : [];
  const at = indexOfPair(list, id);
  if (at === -1) return null;
  const d = dir >= 0 ? 1 : -1;
  for (let i = at + d; i >= 0 && i < list.length; i += d) {
    if (!onlyTwinned || list[i].hasTwin) return list[i];
  }
  return null;
}

/**
 * A one-line orientation for the split header: "Step 4 of 49 · 10 with a parallel
 * view". Pure string building; the caller supplies the labels.
 */
export function pairPosition(pairs, id) {
  const list = Array.isArray(pairs) ? pairs : [];
  const at = indexOfPair(list, id);
  const twinned = list.filter((p) => p.hasTwin).length;
  return { index: at, total: list.length, twinned, found: at !== -1 };
}
