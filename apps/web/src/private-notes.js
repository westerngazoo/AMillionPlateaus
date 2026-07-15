// private-notes.js — a per-topic Markdown notepad kept in THIS browser only (R-0056).
//
// Free-text scratch notes, one Markdown document per plateau, persisted to
// localStorage under `mp.privateNotes`. Same trust boundary as the private shelf
// (R-0052) and the model config: never synced, never in the CRDT, never on any
// channel — it is your private desk, not shared world state. Pure map operations;
// the storage read/write and the Markdown render live in main.js.

export const NOTES_KEY = "mp.privateNotes";

/** Load the `{ plateauId: markdown }` map. A missing/corrupt store → `{}`. */
export function loadNotes(storage) {
  try {
    const raw = storage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist the map. Storage errors (denied/full) are swallowed — the note still
 *  lives in memory for the session. */
export function saveNotes(storage, notes) {
  try {
    storage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    /* storage denied/full — non-fatal */
  }
}

/** The Markdown for `plateauId`, or "" if none. */
export function noteFor(notes, plateauId) {
  const v = notes?.[plateauId];
  return typeof v === "string" ? v : "";
}

/**
 * Return a NEW map with `plateauId`'s note set to `md`. An empty/whitespace-only
 * `md` DELETES the entry (an emptied notepad leaves no trace), so the store never
 * accumulates blank keys. Never mutates the input.
 */
export function setNote(notes, plateauId, md) {
  const next = { ...notes };
  if (typeof md === "string" && md.trim() !== "") next[plateauId] = md;
  else delete next[plateauId];
  return next;
}
