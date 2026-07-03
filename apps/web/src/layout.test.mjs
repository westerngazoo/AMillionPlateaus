import test from "node:test";
import assert from "node:assert/strict";
import {
  spreadNodes,
  forceLayout,
  layoutGraph,
  adaptiveMinDist,
  bridgeNeighbors,
  presetParams,
  LAYOUT_PRESETS,
  LAYOUT_PRESET_ORDER,
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

test("presetParams: compact < study < overview minDist; iterations track presets", () => {
  const n = 40;
  const compact = presetParams("compact", n);
  const study = presetParams("study", n);
  const overview = presetParams("overview", n);
  assert.ok(compact.minDist < study.minDist);
  assert.ok(study.minDist < overview.minDist);
  assert.equal(compact.iterations, LAYOUT_PRESETS.compact.iterations);
  assert.equal(overview.iterations, LAYOUT_PRESETS.overview.iterations);
});

test("presetParams study is the identity default (unknown/missing → study)", () => {
  const n = 30;
  const study = presetParams("study", n);
  assert.equal(study.minDist, adaptiveMinDist(n)); // 1.0× scale
  assert.equal(study.iterations, 56);
  assert.deepEqual(presetParams(undefined, n), study); // default
  assert.deepEqual(presetParams("bogus", n), study); // unknown → study
});

test("LAYOUT_PRESET_ORDER lists every preset for a UI toggle", () => {
  assert.deepEqual([...LAYOUT_PRESET_ORDER].sort(), Object.keys(LAYOUT_PRESETS).sort());
});

test("layoutGraph accepts a preset and stays deterministic", () => {
  const raw = new Map();
  for (let i = 0; i < 8; i++) raw.set(`n${i}`, { x: 100 + i, y: 100 });
  const bridges = [{ from: "n0", to: "n1" }];
  assert.deepEqual(
    layoutGraph(raw, { bridges, preset: "overview" }),
    layoutGraph(raw, { bridges, preset: "overview" }),
  );
  // overview spreads at least as far apart as compact for the same graph
  const spread = (m) => {
    const ids = [...m.keys()];
    let max = 0;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = m.get(ids[i]);
        const b = m.get(ids[j]);
        max = Math.max(max, Math.hypot(b.x - a.x, b.y - a.y));
      }
    return max;
  };
  assert.ok(
    spread(layoutGraph(raw, { bridges, preset: "overview" })) >=
      spread(layoutGraph(raw, { bridges, preset: "compact" })),
  );
});

test("bridgeNeighbors finds one-hop links", () => {
  const n = bridgeNeighbors("a", [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ]);
  assert.deepEqual([...n], ["b"]);
});
