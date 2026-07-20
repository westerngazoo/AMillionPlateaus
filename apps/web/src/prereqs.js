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
