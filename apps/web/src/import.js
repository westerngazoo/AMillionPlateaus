// import.js — pure helpers for the Obsidian/world import flow (Track B3 / R-0021).
//
// The actual CRDT merge happens in wasm (`doc.merge_bytes`); these helpers turn the
// BEFORE/AFTER graph snapshots into a human summary — how many plateaus / bridges /
// resources the import ADDED versus how many were already present (overlap). Pure:
// no DOM, no wasm, no network — the merge is the app's concern, the accounting is
// ours, so it is node-testable. Deterministic.

/**
 * Extract the id lists of a graph snapshot (DTO arrays from `WasmGraph`). This is
 * the "parse" step: a graph → the flat id sets we diff. Missing arrays default to
 * empty; entries without an `id` are skipped (defensive against partial DTOs).
 */
export function graphIds({ plateaus = [], bridges = [], resources = [] } = {}) {
  const ids = (arr) => arr.map((x) => x?.id).filter((id) => id != null);
  return {
    plateaus: ids(plateaus),
    bridges: ids(bridges),
    resources: ids(resources),
  };
}

/**
 * Count how many ids in `afterIds` are new vs. already in `beforeIds`. Both are
 * de-duplicated so a snapshot listing the same id twice never inflates the count.
 * Returns `{ added, overlap, total }` where total = added + overlap.
 */
export function diffCount(beforeIds = [], afterIds = []) {
  const before = new Set(beforeIds);
  let added = 0;
  let overlap = 0;
  for (const id of new Set(afterIds)) {
    if (before.has(id)) overlap++;
    else added++;
  }
  return { added, overlap, total: added + overlap };
}

/**
 * The full import summary: per-kind `{ added, overlap, total }` from BEFORE/AFTER
 * id snapshots (each `{ plateaus, bridges, resources }`, as `graphIds` returns).
 * Pure + deterministic.
 */
export function importSummary(before = {}, after = {}) {
  return {
    plateaus: diffCount(before.plateaus, after.plateaus),
    bridges: diffCount(before.bridges, after.bridges),
    resources: diffCount(before.resources, after.resources),
  };
}

/** True when the import added nothing new (every kind's `added` is 0). */
export function isEmptyImport(summary) {
  return (
    (summary?.plateaus?.added ?? 0) === 0 &&
    (summary?.bridges?.added ?? 0) === 0 &&
    (summary?.resources?.added ?? 0) === 0
  );
}

/**
 * A one-line human summary for the import status chip. Names the source, the
 * per-kind additions, and (if any) the overlap already present. Pure formatting.
 */
export function formatImportSummary(summary, name = "world") {
  if (isEmptyImport(summary)) {
    return `imported "${name}" — nothing new, it's all already in your world`;
  }
  const { plateaus, bridges, resources } = summary;
  const added = `+${plateaus.added} plateaus, +${bridges.added} bridges, +${resources.added} resources`;
  const overlaps = [];
  if (plateaus.overlap) overlaps.push(`${plateaus.overlap} plateaus`);
  if (bridges.overlap) overlaps.push(`${bridges.overlap} bridges`);
  if (resources.overlap) overlaps.push(`${resources.overlap} resources`);
  const tail = overlaps.length ? ` · ${overlaps.join(", ")} already present` : "";
  return `imported "${name}" — ${added}${tail}`;
}
