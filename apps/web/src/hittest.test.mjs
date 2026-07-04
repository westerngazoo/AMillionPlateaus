// hittest.test.mjs — node --test, no wasm, no browser. Proves the pure hit-test
// (SPEC-0043 §2.4) preserves the pre-refactor node-pick + pickBridge behaviour:
// disc precedence, last-wins ties, inclusive RADIUS boundary, bridge fallback,
// and — the point of the extraction — that iterating `positions` keys makes it
// TOTAL (no NPE on any input). Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { hitTest, RADIUS } from "./hittest.js";

const pts = (entries) => new Map(entries);

test("nearest disc within RADIUS is returned", () => {
  const positions = pts([
    ["A", { x: 0, y: 0 }],
    ["B", { x: 100, y: 0 }],
  ]);
  assert.equal(hitTest(positions, 3, 0), "A");
  assert.equal(hitTest(positions, 98, 1), "B");
});

test("equal-distance tie resolves last-wins (matches the `d <= best` loop)", () => {
  // A(0,0) and B(10,0); cursor at (5,0) is 25 from each. The pre-refactor loop
  // used `d <= best`, so the LATER candidate wins — B, in iteration order.
  const positions = pts([
    ["A", { x: 0, y: 0 }],
    ["B", { x: 10, y: 0 }],
  ]);
  assert.equal(hitTest(positions, 5, 0), "B");
});

test("the RADIUS boundary is inclusive; just beyond is a miss", () => {
  const positions = pts([["A", { x: 0, y: 0 }]]);
  assert.equal(hitTest(positions, RADIUS, 0), "A"); // exactly RADIUS away → hit
  assert.equal(hitTest(positions, RADIUS + 1, 0), null); // beyond, no bridge → null
});

test("a disc under the cursor wins over a bridge on the same spot", () => {
  const positions = pts([
    ["A", { x: 0, y: 0 }],
    ["B", { x: 100, y: 0 }],
  ]);
  const bridges = [{ id: "b1", from: "A", to: "B" }];
  // (0,2) is inside disc A AND on the A–B line → the disc wins.
  assert.equal(hitTest(positions, 0, 2, { bridges }), "A");
});

test("no disc hit falls through to the nearest bridge within tol", () => {
  const positions = pts([
    ["A", { x: 0, y: 0 }],
    ["B", { x: 100, y: 0 }],
  ]);
  const bridges = [{ id: "b1", from: "A", to: "B" }];
  // (50,3) is far from both discs but 3px off the segment → bridge b1.
  assert.equal(hitTest(positions, 50, 3, { bridges }), "b1");
  // beyond the bridge tolerance → null.
  assert.equal(hitTest(positions, 50, 20, { bridges }), null);
});

test("total by construction: never throws, even with empty inputs", () => {
  assert.equal(hitTest(new Map(), 5, 5), null);
  assert.equal(hitTest(new Map(), 0, 0, { bridges: [] }), null);
  // A bridge whose endpoint is absent from positions is skipped (not a crash).
  const positions = pts([["A", { x: 0, y: 0 }]]);
  assert.equal(hitTest(positions, 200, 200, { bridges: [{ id: "b", from: "A", to: "Z" }] }), null);
});

test("iterates positions keys, so a graph-only plateau is simply not clickable yet", () => {
  // `positions` is the last-drawn set. A plateau present in the graph but not yet
  // in positions cannot be returned — and, crucially, cannot NPE. Here only "A"
  // was drawn; a click near where "B" WOULD be finds nothing rather than throwing.
  const positions = pts([["A", { x: 0, y: 0 }]]);
  assert.equal(hitTest(positions, 300, 300), null);
});
