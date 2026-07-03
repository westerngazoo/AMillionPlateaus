import test from "node:test";
import assert from "node:assert/strict";
import {
  spreadNodes,
  forceLayout,
  layoutGraph,
  adaptiveMinDist,
  bridgeNeighbors,
  DISC_RADIUS,
} from "./layout.js";

test("adaptiveMinDist grows with graph size", () => {
  assert.ok(adaptiveMinDist(5) < adaptiveMinDist(40));
  assert.ok(adaptiveMinDist(80) <= 160);
});

test("spreadNodes separates overlapping points", () => {
  const raw = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 102, y: 100 }],
  ]);
  const minDist = adaptiveMinDist(2);
  const out = spreadNodes(raw, { minDist, iterations: 20 });
  const dist = Math.hypot(out.get("b").x - out.get("a").x, out.get("b").y - out.get("a").y);
  assert.ok(dist >= minDist - 0.5);
});

test("forceLayout spreads a dense cluster", () => {
  const raw = new Map();
  for (let i = 0; i < 12; i++) {
    raw.set(`n${i}`, { x: 200 + (i % 3) * 2, y: 200 + Math.floor(i / 3) * 2 });
  }
  const minDist = adaptiveMinDist(12);
  const out = forceLayout(raw, { minDist, iterations: 40 });
  let minPair = Infinity;
  const ids = [...out.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = out.get(ids[i]);
      const b = out.get(ids[j]);
      minPair = Math.min(minPair, Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
  assert.ok(minPair >= minDist * 0.55, `dense cluster min pair ${minPair} vs ${minDist}`);
});

test("layoutGraph is deterministic", () => {
  const raw = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 1, y: 1 }],
    ["c", { x: 2, y: 0 }],
  ]);
  const bridges = [{ from: "a", to: "b" }, { from: "b", to: "c" }];
  assert.deepEqual(layoutGraph(raw, { bridges }), layoutGraph(raw, { bridges }));
});

test("bridgeNeighbors finds one-hop links", () => {
  const n = bridgeNeighbors("a", [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ]);
  assert.deepEqual([...n], ["b"]);
});
