import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TWIN_CONCEPT,
  twinMap,
  twinOf,
  pairPath,
  indexOfPair,
  stepPair,
  pairPosition,
} from "./parallel.js";
import { UNIVERSITAM_PATH, UNIVERSITAM_BRIDGES, UNIVERSITAM_TWINS } from "./universitam-curriculum.js";

const C1 = "c1", C2 = "c2", C3 = "c3"; // courses
const T1 = "t1", T3 = "t3";            // twins (c2 has none)
const bridges = [
  { id: "b1", from: T1, to: C1, concept: TWIN_CONCEPT },
  { id: "b3", from: T3, to: C3, concept: TWIN_CONCEPT },
  { id: "b9", from: C1, to: C2, concept: "seriación: C1 → C2" }, // not a twin edge
];

test("twinMap pairs both directions and ignores non-twin edges", () => {
  const m = twinMap(bridges);
  assert.equal(m.get(C1), T1);
  assert.equal(m.get(T1), C1);
  assert.equal(m.get(C3), T3);
  assert.equal(m.has(C2), false, "a seriación edge must not create a pairing");
  assert.equal(twinOf(C1, bridges), T1);
  assert.equal(twinOf(T3, bridges), C3);
  assert.equal(twinOf(C2, bridges), null);
  assert.equal(twinOf(null, bridges), null);
});

test("twinMap is defensive about junk and self-loops", () => {
  assert.equal(twinMap(null).size, 0);
  assert.equal(twinMap([null, {}, { from: "a", concept: TWIN_CONCEPT }]).size, 0);
  assert.equal(twinMap([{ from: "a", to: "a", concept: TWIN_CONCEPT }]).size, 0);
  // a topic with two twins pairs to the FIRST — stable, not order-dependent chaos
  const two = twinMap([
    { from: "x", to: C1, concept: TWIN_CONCEPT },
    { from: "y", to: C1, concept: TWIN_CONCEPT },
  ]);
  assert.equal(two.get(C1), "x");
});

test("pairPath pairs every step and marks the gaps rather than hiding them", () => {
  const pairs = pairPath([C1, C2, C3], bridges);
  assert.deepEqual(pairs, [
    { left: C1, right: T1, hasTwin: true },
    { left: C2, right: null, hasTwin: false },
    { left: C3, right: T3, hasTwin: true },
  ]);
  assert.deepEqual(pairPath(null, bridges), []);
});

test("a topic is located from EITHER side of the pair", () => {
  const pairs = pairPath([C1, C2, C3], bridges);
  assert.equal(indexOfPair(pairs, C1), 0);
  assert.equal(indexOfPair(pairs, T1), 0, "arriving from the twin lens must locate the same pair");
  assert.equal(indexOfPair(pairs, C3), 2);
  assert.equal(indexOfPair(pairs, T3), 2);
  assert.equal(indexOfPair(pairs, "nope"), -1);
});

test("stepPair moves BOTH routes together and stops at the ends", () => {
  const pairs = pairPath([C1, C2, C3], bridges);
  assert.deepEqual(stepPair(pairs, C1, 1), pairs[1]);
  assert.deepEqual(stepPair(pairs, C2, 1), pairs[2]);
  assert.equal(stepPair(pairs, C3, 1), null, "no wrap-around at the end");
  assert.deepEqual(stepPair(pairs, C3, -1), pairs[1]);
  assert.equal(stepPair(pairs, C1, -1), null, "no wrap-around at the start");
  // stepping from the twin side works identically
  assert.deepEqual(stepPair(pairs, T1, 1), pairs[1]);
  assert.equal(stepPair(pairs, "unknown", 1), null);
});

test("onlyTwinned skips steps with no parallel view", () => {
  const pairs = pairPath([C1, C2, C3], bridges);
  assert.deepEqual(stepPair(pairs, C1, 1, { onlyTwinned: true }), pairs[2], "skips the untwinned C2");
  assert.deepEqual(stepPair(pairs, C3, -1, { onlyTwinned: true }), pairs[0]);
  assert.equal(stepPair(pairs, C3, 1, { onlyTwinned: true }), null);
});

test("pairPosition reports where you are and how much is twinned", () => {
  const pairs = pairPath([C1, C2, C3], bridges);
  assert.deepEqual(pairPosition(pairs, C2), { index: 1, total: 3, twinned: 2, found: true });
  assert.deepEqual(pairPosition(pairs, "nope"), { index: -1, total: 3, twinned: 2, found: false });
});

// Against the REAL degree: the pairing must line up with what R-0096 seeded.
test("the real degree path pairs to exactly the written twins", () => {
  const pairs = pairPath(UNIVERSITAM_PATH.steps, UNIVERSITAM_BRIDGES);
  assert.equal(pairs.length, 49, "every asignatura appears once");
  const twinned = pairs.filter((p) => p.hasTwin);
  assert.equal(twinned.length, UNIVERSITAM_TWINS.length, "each written twin pairs to exactly one course");
  // every right-hand id is a real twin plateau
  const twinIds = new Set(UNIVERSITAM_TWINS.map((t) => t.id));
  for (const p of twinned) assert.ok(twinIds.has(p.right), `${p.right} is not a twin plateau`);
  // the twinned ones are the cuatrimestre 1–3 spine, in path order, and stepping
  // with onlyTwinned walks them without ever landing on an untwinned course
  let cur = twinned[0].left;
  let walked = 1;
  for (;;) {
    const nxt = stepPair(pairs, cur, 1, { onlyTwinned: true });
    if (!nxt) break;
    assert.ok(nxt.hasTwin);
    cur = nxt.left;
    walked++;
  }
  assert.equal(walked, twinned.length, "the parallel walk reaches every twinned step");
});
