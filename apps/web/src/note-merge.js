// note-merge.js — close the write-on-Boox loop without ever losing writing (R-0106).
//
// R-0105 hands a topic from the laptop to the Boox and lands you in its notepad.
// Then you write with the stylus… and the writing was STRANDED: the world (R-0081)
// and profile (R-0101) auto-push, but notepads only moved on an explicit tap of
// Push ↑, and the laptop only saw it on an explicit Pull ↓. Miss either tap and the
// note simply isn't there on the other device.
//
// Auto-syncing notes is not the same problem as auto-syncing the graph. The graph is
// a CRDT — merges are always safe. A notepad is free-form text, and the existing
// manual Pull says so honestly: "replaced the local note". A human chose that. A
// BACKGROUND pull must never make that choice, because the cost of being wrong is
// destroyed writing.
//
// So this module carries a THREE-WAY merge against a per-device BASELINE — the text
// this device last agreed with the repo on:
//   • only the remote moved → fast-forward (safe, silent)
//   • only we moved         → push
//   • both moved            → CONFLICT: keep BOTH, never pick a winner
// The conflict output is plain Markdown with both versions under headings, so you
// resolve it by reading and deleting, not by guessing what was lost.
//
// PURE: text in, text out — no DOM, no storage, no network, no clock.

/** Where each device remembers the text it last synced, per topic. LOCAL ONLY:
 *  it describes THIS device's agreement with the repo, so it must not sync. */
export const NOTE_BASE_KEY = "mp.noteBase";

/** Notes are compared with trailing whitespace normalised — an editor adding a
 *  final newline is not a real edit and must not manufacture a conflict. */
export function normalizeNote(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}

const same = (a, b) => normalizeNote(a) === normalizeNote(b);

/**
 * Build the both-kept text for a real conflict. Mine first (you are looking at this
 * device), then the other side under a heading naming where it came from. Obeys the
 * markdown.js subset: a heading is its own block, one line per paragraph, no
 * blockquote (`>` would render literally).
 */
export function conflictText(local, remote, fromDevice = "your other device") {
  const mine = normalizeNote(local);
  const theirs = normalizeNote(remote);
  return [
    mine,
    "",
    `## ⚠️ Also written on ${fromDevice}`,
    "",
    "Both versions are kept — delete whichever you don't want.",
    "",
    theirs,
    "",
  ].join("\n");
}

/**
 * Three-way merge of one note. `base` is what this device last synced (undefined
 * when it has never synced this note). Returns
 * `{ action, text, changed }` where action is:
 *   'in-sync'  — identical; just record the baseline
 *   'pull'     — only the remote moved; fast-forward local to `text` (safe)
 *   'push'     — only we moved; send `text` up
 *   'conflict' — both moved; `text` keeps BOTH and must be shown to the human
 * `changed` says whether the local text should be replaced with `text`.
 */
export function mergeNote({ local, remote, base, fromDevice } = {}) {
  const l = normalizeNote(local);
  const r = normalizeNote(remote);
  const hasBase = base !== undefined && base !== null;
  const b = hasBase ? normalizeNote(base) : null;

  if (same(l, r)) return { action: "in-sync", text: l, changed: false };

  // Never seen before on this device: an empty side is not an edit, it's absence.
  if (!hasBase) {
    if (!l) return { action: "pull", text: r, changed: true }; // nothing local to lose
    if (!r) return { action: "push", text: l, changed: false }; // nothing remote yet
    // Both sides have text and we have no baseline to judge by — the only safe
    // answer is to keep both.
    return { action: "conflict", text: conflictText(l, r, fromDevice), changed: true };
  }

  const localMoved = l !== b;
  const remoteMoved = r !== b;
  if (remoteMoved && !localMoved) return { action: "pull", text: r, changed: true };
  if (localMoved && !remoteMoved) return { action: "push", text: l, changed: false };
  // Both moved away from the shared baseline — the genuine conflict.
  return { action: "conflict", text: conflictText(l, r, fromDevice), changed: true };
}

/** Baselines are a plain `{ plateauId: text }` map; junk entries are dropped. */
export function parseBaselines(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === "string" && k && typeof v === "string") out[k] = v;
  }
  return out;
}

/** Record what this device now agrees with the repo on, for one topic. */
export function setBaseline(baselines, plateauId, text) {
  if (!plateauId) return parseBaselines(baselines);
  return { ...parseBaselines(baselines), [plateauId]: normalizeNote(text) };
}

/** The baseline for a topic, or undefined when this device has never synced it. */
export function baselineFor(baselines, plateauId) {
  const map = parseBaselines(baselines);
  return Object.prototype.hasOwnProperty.call(map, plateauId) ? map[plateauId] : undefined;
}

/** A short status line for the merge outcome, for the notepad's status span. */
export function describeMerge(action, fromDevice = "your other device") {
  switch (action) {
    case "pull":
      return `📥 Synced this note from ${fromDevice}`;
    case "push":
      return "☁️ Backing this note up…";
    case "conflict":
      return `⚠️ Edited in both places — BOTH versions kept below, delete one`;
    default:
      return "";
  }
}
