// lesson-progress.test.mjs — node --test, pure (R-0063).
import test from "node:test";
import assert from "node:assert/strict";
import { entryOf, withStep, withDone, lessonButtonLabel, courseSummary, continueIndex } from "./lesson-progress.js";

const TOTAL = 7; // LESSON_STEPS.length

test("entryOf returns the saved entry, or a safe default, and never throws", () => {
  assert.deepEqual(entryOf({ a: { step: 3, done: false } }, "a"), { step: 3, done: false });
  assert.deepEqual(entryOf({ a: { step: 6, done: true } }, "a"), { step: 6, done: true });
  // unknown id / empty / malformed → default
  assert.deepEqual(entryOf({}, "missing"), { step: 0, done: false });
  assert.deepEqual(entryOf(null, "x"), { step: 0, done: false });
  assert.deepEqual(entryOf({ a: { step: -4, done: 1 } }, "a"), { step: 0, done: true }); // junk step floored, truthy done
  assert.deepEqual(entryOf({ a: { step: NaN } }, "a"), { step: 0, done: false });
});

test("withStep clamps into the arc, preserves done, and doesn't mutate the input", () => {
  const before = {};
  const m1 = withStep(before, "a", 3, TOTAL);
  assert.deepEqual(m1.a, { step: 3, done: false });
  assert.deepEqual(before, {}, "input map not mutated");
  // clamp over/under
  assert.equal(withStep({}, "a", 99, TOTAL).a.step, TOTAL - 1);
  assert.equal(withStep({}, "a", -5, TOTAL).a.step, 0);
  // done is preserved across a step change (reviewing again doesn't un-review)
  const done = withDone({}, "a", TOTAL);
  assert.equal(withStep(done, "a", 2, TOTAL).a.done, true);
  // merely landing on the last step is NOT "done"
  assert.equal(withStep({}, "a", TOTAL - 1, TOTAL).a.done, false);
});

test("withDone marks finished and parks on the last step", () => {
  const m = withDone({}, "a", TOTAL);
  assert.deepEqual(m.a, { step: TOTAL - 1, done: true });
  // other topics untouched
  const m2 = withDone({ b: { step: 2, done: false } }, "a", TOTAL);
  assert.deepEqual(m2.b, { step: 2, done: false });
});

test("lessonButtonLabel reflects the three states", () => {
  assert.equal(lessonButtonLabel({ step: 0, done: false }, TOTAL), "▶ Teach me this topic");
  assert.equal(lessonButtonLabel({ step: 3, done: false }, TOTAL), "▶ Resume — step 4/7");
  assert.equal(lessonButtonLabel({ step: 6, done: true }, TOTAL), "✓ Reviewed — teach again");
  assert.equal(lessonButtonLabel(undefined, TOTAL), "▶ Teach me this topic"); // defensive
});

test("continueIndex points at the first unfinished topic, or -1 when done / already there", () => {
  const ids = ["a", "b", "c", "d"];
  let m = withDone({}, "a", TOTAL); // a done; b,c,d not
  // from a (index 0, just finished) → continue to b (first unfinished)
  assert.equal(continueIndex(m, ids, 0), 1);
  // from b (index 1) — b IS the first unfinished → -1 (you're already on it, just study)
  assert.equal(continueIndex(m, ids, 1), -1);
  // from c (index 2) with an earlier gap at b → still the first unfinished (b)
  assert.equal(continueIndex(m, ids, 2), 1);
  // whole course done → -1
  const all = ids.reduce((acc, id) => withDone(acc, id, TOTAL), {});
  assert.equal(continueIndex(all, ids, 0), -1);
  // empty / junk
  assert.equal(continueIndex({}, [], 0), -1);
});

test("courseSummary counts finished topics and finds the next unfinished one", () => {
  const ids = ["a", "b", "c", "d"];
  let m = {};
  m = withDone(m, "a", TOTAL);
  m = withStep(m, "b", 2, TOTAL); // in progress, not done
  m = withDone(m, "c", TOTAL);
  assert.deepEqual(courseSummary(m, ids), { done: 2, total: 4, nextIndex: 1 }); // b is first not-done
  // whole course done → nextIndex -1
  const all = ids.reduce((acc, id) => withDone(acc, id, TOTAL), {});
  assert.deepEqual(courseSummary(all, ids), { done: 4, total: 4, nextIndex: -1 });
  // empty / junk
  assert.deepEqual(courseSummary({}, []), { done: 0, total: 0, nextIndex: -1 });
  assert.deepEqual(courseSummary({}, null), { done: 0, total: 0, nextIndex: -1 });
});
