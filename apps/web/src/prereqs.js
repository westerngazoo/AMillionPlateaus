// prereqs.js — "Before this, study…" (R-0070). Pure.
//
// A topic's prerequisites are the EARLIER steps of its curriculum path (R-0065)
// that you haven't studied yet. The authored path ORDER is the source of truth —
// NOT bridge direction, which suggest-path.js treats as undirected and which the
// seed data sets inconsistently (Motion is a "from" in some spine bridges). Given
// the path steps + the current topic + the set of done ids, list the missing
// prereqs in order; and build the hand-off prompt that walks you through them
// using the resources pinned on each (R-0023/R-0069). Impure edges (graph reads,
// clipboard, window.open) live in main.js. Unit-tested in prereqs.test.mjs.

/**
 * The earlier path steps (before `currentId`) not in `doneSet`, in path order.
 * Returns `[{ id, n }]` where `n` is the 1-based step number. Empty when the topic
 * isn't in the path, is its first step, or every earlier step is done. Pure.
 */
export function missingPrereqs(steps, currentId, doneSet) {
  const list = Array.isArray(steps) ? steps : [];
  const here = list.indexOf(currentId);
  if (here <= 0) return []; // not in the path, or already the first step
  const done = doneSet instanceof Set ? doneSet : new Set(Array.isArray(doneSet) ? doneSet : []);
  const out = [];
  for (let i = 0; i < here; i++) {
    if (!done.has(list[i])) out.push({ id: list[i], n: i + 1 });
  }
  return out;
}

/**
 * The hand-off study-plan prompt: the target topic + the ordered missing prereqs,
 * each annotated with the resources pinned on it (so the plan is built around what
 * you're actually studying from — R-0069). `prereqs` = `[{ n, name, resources:[{title, uri}] }]`.
 * Pure + deterministic.
 */
export function prereqPlanPrompt({ target = "this topic", pathTitle = "", prereqs = [] } = {}) {
  const block = (prereqs || [])
    .map((p) => {
      const res = (p.resources || [])
        .map((r) => `      - ${r.title}${r.uri ? ` (${r.uri})` : ""}`)
        .join("\n");
      return `${p.n}. ${p.name}\n${res || "      - (nothing pinned yet — suggest one good free resource)"}`;
    })
    .join("\n");
  return [
    `I want to study "${target}"${pathTitle ? ` (in "${pathTitle}")` : ""}, but I'm missing these prerequisites, in order:`,
    "",
    block,
    "",
    "Build me a tight study plan that takes me through these IN THIS ORDER and leaves me ready for the target. For each: the key ideas to learn, and which of the pinned resources to use (or one you suggest if none is pinned). Only what I actually need before the target — no filler.",
  ].join("\n");
}

// ── R-0100: add your own prerequisite ────────────────────────────────────────
// The curriculum's prereqs (above) come from PATH ORDER, so a dependency the plan
// doesn't sequence — e.g. Geometría Analítica underpins Óptica, but the plan lists
// them in the same cuatrimestre — never surfaces. A reader can add their own. Those
// live per-topic in localStorage (like R-0071 confusions), so they are personal and
// this-browser-only, not seeded into the shared graph.

/**
 * Merge the path-derived prereqs with the reader's own added ones for display.
 * Path steps come first (numbered, in path order); user-added ones follow
 * (unnumbered, `user:true` so the UI can offer a remove ✕). Deduped by id — a
 * user prereq that is ALSO a path step keeps the numbered path row — and
 * already-studied user prereqs are dropped (this list is "what's left to study").
 * `nameOf(id)` resolves a display name. Pure.
 */
export function combinePrereqs({ pathMissing = [], userIds = [], doneSet, nameOf = () => "" } = {}) {
  const done = doneSet instanceof Set ? doneSet : new Set(Array.isArray(doneSet) ? doneSet : []);
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(pathMissing) ? pathMissing : []) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, n: m.n, name: nameOf(m.id) || "…", user: false });
  }
  for (const id of Array.isArray(userIds) ? userIds : []) {
    if (!id || seen.has(id) || done.has(id)) continue;
    seen.add(id);
    out.push({ id, n: null, name: nameOf(id) || "…", user: true });
  }
  return out;
}

/**
 * Candidate topics for the "add a prerequisite" picker: name-substring matches of
 * `query`, EXCLUDING the topic itself and anything already listed as a prereq
 * (path or user). Case/diacritic-insensitive, capped, ranked prefix-first. Pure.
 * `topics` = [{id,name}]; `exclude` = Set/array of ids to omit.
 */
export function prereqCandidates(query, topics = [], exclude = [], limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const skip = exclude instanceof Set ? exclude : new Set(Array.isArray(exclude) ? exclude : []);
  const hits = [];
  const seen = new Set();
  for (const t of Array.isArray(topics) ? topics : []) {
    if (!t || !t.id || skip.has(t.id) || seen.has(t.id)) continue;
    const name = fold(t.name);
    const at = name.indexOf(q);
    if (at === -1) continue;
    seen.add(t.id);
    hits.push({ id: t.id, name: t.name, rank: at === 0 ? 0 : 1 });
  }
  hits.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return hits.slice(0, limit).map(({ id, name }) => ({ id, name }));
}

// Case- and diacritic-insensitive fold, so "optica" matches "Óptica".
function fold(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
