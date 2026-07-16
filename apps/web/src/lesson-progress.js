// lesson-progress.js — remember your place in the per-topic Teach-me lesson (R-0063).
//
// R-0060's guided lesson tracked the current step in a plain in-memory `let`, so
// leaving a topic — or reloading — always restarted the 7-step Feynman arc from
// step 1. This keeps a small per-topic map { [plateauId]: { step, done } } (in
// localStorage, THIS browser only — like the notepad/private shelf; never synced,
// never in the CRDT) so you RESUME where you left off, a finished topic reads as
// "reviewed", and a built course (R-0061) can show how far through it you are.
//
// PURE: every function here operates on plain progress objects and returns new
// ones — no localStorage, no DOM. The impure read/write edge lives in main.js
// (loadLessonProgress/saveLessonProgress), same split as loadPaths/savePaths.
// Unit-tested in lesson-progress.test.mjs.

// Clamp a step into the arc [0, total-1]; junk (NaN/negative/over) → nearest valid.
const clampStepTo = (step, total) => {
  const last = Math.max(0, (Number.isFinite(total) ? Math.trunc(total) : 1) - 1);
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(Math.trunc(step), last));
};

/**
 * The saved entry for a topic, or a fresh `{ step: 0, done: false }`. Defensive
 * against a malformed/absent map or entry (returns the default, never throws).
 */
export function entryOf(progress, id) {
  const e = progress && typeof progress === "object" ? progress[id] : null;
  const step = e && Number.isFinite(e.step) && e.step > 0 ? Math.trunc(e.step) : 0;
  return { step, done: !!(e && e.done) };
}

/**
 * A NEW map with topic `id` moved to `step` (clamped to the arc). `done` is
 * preserved — advancing through a reviewed topic again doesn't un-review it, and
 * merely reaching the last step is not "done" (that's `withDone`, on Finish).
 */
export function withStep(progress, id, step, total) {
  const base = progress && typeof progress === "object" ? progress : {};
  return { ...base, [id]: { step: clampStepTo(step, total), done: entryOf(progress, id).done } };
}

/** A NEW map marking topic `id` finished: `done: true`, parked on the last step. */
export function withDone(progress, id, total) {
  const base = progress && typeof progress === "object" ? progress : {};
  const last = Math.max(0, (Number.isFinite(total) ? Math.trunc(total) : 1) - 1);
  return { ...base, [id]: { step: last, done: true } };
}

/**
 * The Teach-me button label for a topic, reflecting saved progress:
 *   fresh    → "▶ Teach me this topic"
 *   mid-arc  → "▶ Resume — step k/n"
 *   finished → "✓ Reviewed — teach again"
 */
export function lessonButtonLabel(entry, total) {
  const e = entry || { step: 0, done: false };
  if (e.done) return "✓ Reviewed — teach again";
  if (e.step > 0) return `▶ Resume — step ${Math.trunc(e.step) + 1}/${total}`;
  return "▶ Teach me this topic";
}

/**
 * Roll a progress map up over a course path's ordered topic ids (R-0061). Returns
 * `{ done, total, nextIndex }` — `done` = finished topics, `nextIndex` = the first
 * not-yet-finished topic (or -1 when the whole course is done). Pure.
 */
export function courseSummary(progress, ids) {
  const list = Array.isArray(ids) ? ids : [];
  let done = 0;
  let nextIndex = -1;
  list.forEach((id, i) => {
    if (entryOf(progress, id).done) done += 1;
    else if (nextIndex === -1) nextIndex = i;
  });
  return { done, total: list.length, nextIndex };
}

/**
 * Which topic a "Continue →" from `hereIndex` should open (R-0064): the course's
 * first unfinished topic — standard resume semantics. Returns -1 (no button) when
 * the course is complete OR you are already ON that first-unfinished topic (just
 * study it). Pure; wraps `courseSummary`.
 */
export function continueIndex(progress, ids, hereIndex) {
  const { nextIndex } = courseSummary(progress, ids);
  return nextIndex === -1 || nextIndex === hereIndex ? -1 : nextIndex;
}
