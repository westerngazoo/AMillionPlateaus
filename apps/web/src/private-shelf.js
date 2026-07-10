// private-shelf.js — the private shelf (R-0052): per-plateau resources that are
// YOURS ALONE. A shelf row never enters the CRDT, never syncs to peers, never
// appears in the shared world — it lives in this browser's localStorage,
// keyed by plateau id. This is where a private book collection and Boox notes
// belong: on the topic, grounding your companion, invisible to everyone else.
//
// Mirrors the R-0036 proof pattern (private until published): a shelf row can
// be PROMOTED into the shared graph with an explicit publish action — the
// reverse is impossible (the CRDT is grow-only), which is exactly why private
// is the safe default for personal material.
//
// PURE: plain-data transforms over a { plateauId: [rows] } object. The single
// storage edge (localStorage) is injected. Tested in private-shelf.test.mjs.

export const SHELF_KEY = "mp.privateShelf";

/** Load the shelf map from storage; corrupt/missing → an empty shelf. */
export function loadShelf(storage) {
  try {
    const raw = storage.getItem(SHELF_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist the shelf map. Local only — never on the wire. */
export function saveShelf(storage, shelf) {
  storage.setItem(SHELF_KEY, JSON.stringify(shelf));
}

/** The rows shelved on one plateau (always an array). */
export function shelfFor(shelf, plateauId) {
  const rows = shelf?.[plateauId];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Add a row ({ id, title, kind, uri }) to a plateau's shelf. Returns a NEW
 * shelf — inputs are never mutated (same discipline as the slots/persona
 * lenses). The row's fields are assumed pre-normalised (buildResource).
 */
export function addToShelf(shelf, plateauId, row) {
  if (!plateauId || !row?.id) return shelf;
  return { ...shelf, [plateauId]: [...shelfFor(shelf, plateauId), row] };
}

/** Remove one row by id; a plateau whose shelf empties is dropped entirely. */
export function removeFromShelf(shelf, plateauId, rowId) {
  const rows = shelfFor(shelf, plateauId).filter((r) => r.id !== rowId);
  const next = { ...shelf };
  if (rows.length) next[plateauId] = rows;
  else delete next[plateauId];
  return next;
}
