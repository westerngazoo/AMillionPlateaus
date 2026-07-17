// where-fits.js — "Where does this fit?" (R-0069). Pure.
//
// You follow your own sources (a YouTube channel, a paper). You paste the
// resource; a hand-off (R-0056) asks YOUR model which of YOUR topics it relates
// to — from the full list, so a single video can land on Rotors AND Spinors AND
// Maxwell; you paste the answer back and pin the resource to the matched topics
// (doc.add_resource, R-0023). Model-free at the app edge: the model work rides
// the hand-off tab; this module BUILDS the prompt and RESOLVES the model's
// returned topic NAMES to real plateau ids. Impure edges (clipboard, window.open,
// doc.add_resource) live in main.js. Unit-tested in where-fits.test.mjs.

// Normalize a topic name for tolerant matching: lowercase, collapse spaces, drop
// punctuation/diacritic-free-ish symbols so "Maxwell in One Equation: ∇F = J" and
// a model's "Maxwell in One Equation ∇F = J" resolve to the same topic.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();

/**
 * The hand-off prompt: hands the model the resource + the full topic list (grouped
 * by lens for legibility) and asks which topics it helps with, constrained to the
 * EXACT names so the answer resolves back cleanly. `topics` = [{ name, lens }].
 * Pure.
 */
export function whereFitsPrompt({ title = "", url = "", kind = "Video", topics = [] } = {}) {
  const label = [title, url].filter(Boolean).join(" — ") || "this resource";
  const byLens = new Map();
  for (const t of topics) {
    const k = t.lens || "Other";
    if (!byLens.has(k)) byLens.set(k, []);
    byLens.get(k).push(t.name);
  }
  const list = [...byLens.entries()]
    .map(([lens, names]) => `${lens}:\n  ${names.join("\n  ")}`)
    .join("\n\n");
  return [
    `I'm studying with this ${String(kind || "resource").toLowerCase()}: ${label}`,
    url ? "(add it as a source in this chat, then answer from its actual content.)" : "",
    "",
    "Here is my full list of study topics, grouped by lens:",
    "",
    list,
    "",
    "Which of these topics does this resource most directly help with? Reply with ONLY the EXACT topic names from the list above, one per line, most relevant first — nothing else.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Resolve a pasted model answer (topic names, one per line) to real topics.
 * Tolerant: strips list markers/quotes, matches on the normalized name (exact,
 * then a UNIQUE substring so a trailing clause still resolves; ambiguous → left
 * unmatched). `topics` = [{ id, name }]. Returns `{ matched:[{id,name}], unmatched:[raw] }`
 * with no duplicate ids. Pure + deterministic.
 */
export function matchTopics(pastedText, topics = []) {
  const list = Array.isArray(topics) ? topics : [];
  const byNorm = new Map();
  for (const t of list) {
    const n = norm(t.name);
    if (n && !byNorm.has(n)) byNorm.set(n, t);
  }
  const matched = [];
  const unmatched = [];
  const seen = new Set();
  for (const raw of String(pastedText || "").split("\n")) {
    const line = raw
      .replace(/^\s*(?:\d+[.)]|[-*•·])\s*/, "") // list markers
      .replace(/["'`]/g, "")
      .trim();
    if (!line) continue;
    const n = norm(line);
    if (!n) continue;
    let hit = byNorm.get(n);
    if (!hit) {
      const subs = list.filter((t) => {
        const tn = norm(t.name);
        return tn && (n.includes(tn) || tn.includes(n));
      });
      const ids = new Set(subs.map((t) => t.id));
      if (ids.size === 1) hit = subs[0]; // a UNIQUE topic (possibly several rows of one)
    }
    if (hit) {
      if (!seen.has(hit.id)) {
        seen.add(hit.id);
        matched.push({ id: hit.id, name: hit.name });
      }
    } else {
      unmatched.push(line.slice(0, 80));
    }
  }
  return { matched, unmatched };
}
