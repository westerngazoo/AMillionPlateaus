// review-queue.test.mjs — SM-2 scheduling, daily-new cap, interleaving (R-0078).
import test from "node:test";
import assert from "node:assert/strict";

import {
  GRADES,
  entryOf,
  graded,
  dueEntries,
  enrollDue,
  freshIds,
  interleave,
  nextDue,
} from "./review-queue.js";

const DAY = 86_400_000;
const T0 = 1_800_000_000_000; // fixed epoch — the module never calls Date.now()

test("Good ladder: 1 day → 3 days → interval × ease", () => {
  let q = graded({}, "a", GRADES.GOOD, T0);
  let e = entryOf(q, "a");
  assert.equal(e.reps, 1);
  assert.equal(e.interval, 1);
  assert.equal(e.due, T0 + 1 * DAY);

  q = graded(q, "a", GRADES.GOOD, e.due);
  e = entryOf(q, "a");
  assert.equal(e.reps, 2);
  assert.equal(e.interval, 3);
  assert.equal(e.due, T0 + 1 * DAY + 3 * DAY);

  const prevEase = e.ease;
  q = graded(q, "a", GRADES.GOOD, e.due);
  const e3 = entryOf(q, "a");
  assert.equal(e3.reps, 3);
  assert.equal(e3.interval, Math.round(3 * e3.ease)); // ease unchanged on GOOD
  assert.equal(e3.ease, prevEase);
  assert.ok(e3.interval >= 7, `third interval should be a week-ish, got ${e3.interval}`);
});

test("Again is a lapse: reps reset, ~10 min retry, ease drops but floors at 1.3", () => {
  let q = graded({}, "a", GRADES.GOOD, T0);
  q = graded(q, "a", GRADES.GOOD, T0 + DAY);
  q = graded(q, "a", GRADES.AGAIN, T0 + 4 * DAY);
  const e = entryOf(q, "a");
  assert.equal(e.reps, 0);
  assert.equal(e.interval, 0);
  assert.ok(e.due > T0 + 4 * DAY && e.due <= T0 + 4 * DAY + 11 * 60_000, "back within ~10 min");
  // hammer Again — ease must never sink below the SM-2 floor
  for (let i = 0; i < 20; i++) q = graded(q, "a", GRADES.AGAIN, T0 + 5 * DAY + i);
  assert.equal(entryOf(q, "a").ease, 1.3);
});

test("Easy grows ease, Hard shrinks it; intervals diverge accordingly", () => {
  let easyQ = graded({}, "a", GRADES.EASY, T0);
  let hardQ = graded({}, "a", GRADES.HARD, T0);
  assert.ok(entryOf(easyQ, "a").ease > entryOf(hardQ, "a").ease);
  for (let i = 1; i <= 4; i++) {
    easyQ = graded(easyQ, "a", GRADES.EASY, T0 + i * DAY);
    hardQ = graded(hardQ, "a", GRADES.HARD, T0 + i * DAY);
  }
  assert.ok(
    entryOf(easyQ, "a").interval > entryOf(hardQ, "a").interval,
    "consistent Easy must outpace consistent Hard",
  );
  assert.ok(entryOf(hardQ, "a").ease >= 1.3);
});

test("graded is pure and non-destructive; introduced survives regrades", () => {
  const q0 = {};
  const q1 = graded(q0, "a", GRADES.GOOD, T0);
  assert.deepEqual(q0, {}); // input untouched
  const q2 = graded(q1, "a", GRADES.AGAIN, T0 + DAY);
  assert.equal(entryOf(q2, "a").introduced, T0);
  assert.equal(entryOf(q1, "a").due, T0 + DAY); // earlier snapshot untouched
});

test("entryOf is defensive: junk entries and junk maps read as null", () => {
  assert.equal(entryOf(null, "a"), null);
  assert.equal(entryOf("nope", "a"), null);
  assert.equal(entryOf({ a: { reps: "x", ease: 2.5, interval: 1, due: T0 } }, "a"), null);
  assert.equal(entryOf({ a: 7 }, "a"), null);
  // stored sub-floor ease reads back floored
  assert.equal(entryOf({ a: { reps: 1, ease: 0.5, interval: 1, due: T0 } }, "a").ease, 1.3);
});

test("dueEntries: only enrolled + due topics, most overdue first, scoped to live ids", () => {
  let q = graded({}, "a", GRADES.GOOD, T0); // due T0+1d
  q = graded(q, "b", GRADES.GOOD, T0 - 5 * DAY); // due T0-4d — very overdue
  q = graded(q, "c", GRADES.GOOD, T0 + DAY); // due T0+2d — future
  q = graded(q, "ghost", GRADES.GOOD, T0 - 9 * DAY); // plateau since deleted
  const due = dueEntries(q, ["a", "b", "c", "new1"], T0 + 1.5 * DAY);
  assert.deepEqual(due.map((x) => x.id), ["b", "a"]); // c future, ghost unscoped, new1 unenrolled
});

test("freshIds: unenrolled only, in caller order, capped minus today's introductions", () => {
  assert.deepEqual(freshIds({}, ["a", "b", "c", "d", "e", "f", "g"], T0), ["a", "b", "c", "d", "e"]);
  // grade two today → only 3 new slots left today
  let q = graded({}, "x", GRADES.GOOD, T0);
  q = graded(q, "y", GRADES.AGAIN, T0 + 60_000);
  assert.deepEqual(freshIds(q, ["a", "b", "c", "d"], T0 + 120_000), ["a", "b", "c"]);
  // tomorrow the allowance resets
  assert.equal(freshIds(q, ["a", "b", "c", "d", "e", "f"], T0 + DAY).length, 5);
});

test("interleave round-robins across lenses, preserving within-lens order", () => {
  const items = [
    { id: 1, lens: "GA" }, { id: 2, lens: "GA" }, { id: 3, lens: "GA" },
    { id: 4, lens: "Physics" }, { id: 5, lens: "Physics" },
    { id: 6, lens: "Music" },
  ];
  const out = interleave(items, (x) => x.lens).map((x) => x.id);
  assert.deepEqual(out, [1, 4, 6, 2, 5, 3]);
  assert.deepEqual(interleave([], (x) => x), []);
});

test("enrollDue: reassessment forces due now, keeping SM-2 stats, bypassing the cap", () => {
  // enrol a fresh (unenrolled) topic — due now, default ease, ready to review
  let q = enrollDue({}, "trig", T0);
  let e = entryOf(q, "trig");
  assert.equal(e.due, T0);
  assert.equal(e.reps, 0);
  assert.deepEqual(dueEntries(q, ["trig"], T0).map((x) => x.id), ["trig"]);

  // an already-scheduled card keeps its reps/ease/interval but comes due now
  let sched = graded({}, "sines", GRADES.GOOD, T0); // due T0+1d, reps 1
  sched = graded(sched, "sines", GRADES.GOOD, T0 + 86_400_000); // reps 2, far future
  const before = entryOf(sched, "sines");
  const forced = enrollDue(sched, "sines", T0 + 2 * 86_400_000);
  const after = entryOf(forced, "sines");
  assert.equal(after.reps, before.reps); // stats preserved
  assert.equal(after.ease, before.ease);
  assert.equal(after.interval, before.interval);
  assert.equal(after.due, T0 + 2 * 86_400_000); // but due now
  assert.deepEqual(sched, sched); // input untouched (pure)
});

test("nextDue: earliest FUTURE due among live ids, null when nothing is scheduled", () => {
  let q = graded({}, "a", GRADES.GOOD, T0); // due T0+1d
  q = graded(q, "b", GRADES.GOOD, T0 + DAY); // due T0+2d
  assert.equal(nextDue(q, ["a", "b"], T0), T0 + DAY);
  assert.equal(nextDue(q, ["a", "b"], T0 + 3 * DAY), null); // both already due
  assert.equal(nextDue({}, ["a"], T0), null);
});
