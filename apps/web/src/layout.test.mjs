import test from "node:test";
import assert from "node:assert/strict";
import { spreadNodes, forceLayout, DEFAULT_MIN_DIST } from "./layout.js";

test("spreadNodes separates overlapping points", () => {
  const raw = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 105, y: 100 }],
  ]);
  const out = spreadNodes(raw, { minDist: DEFAULT_MIN_DIST, iterations: 12 });
  const a = out.get("a");
  const b = out.get("b");
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(dist >= DEFAULT_MIN_DIST - 0.01);
});

test("spreadNodes is deterministic", () => {
  const raw = new Map([
    ["a", { x: 50, y: 50 }],
    ["b", { x: 52, y: 51 }],
    ["c", { x: 48, y: 52 }],
  ]);
  assert.deepEqual(spreadNodes(raw), spreadNodes(raw));
});

test("spreadNodes leaves distant points unchanged", () => {
  const raw = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 200, y: 200 }],
  ]);
  const out = spreadNodes(raw);
  assert.deepEqual(out.get("a"), { x: 0, y: 0 });
  assert.deepEqual(out.get("b"), { x: 200, y: 200 });
});

test("spreadNodes separates EXACTLY coincident points (deterministic fallback angle)", () => {
  // dx=dy=0 has no separation direction; the fallback angle must split them —
  // e.g. a drafted plateau at the same sliders as a seed (trailheads sit on axes).
  const raw = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 100, y: 100 }],
    ["c", { x: 100, y: 100 }],
  ]);
  const out = spreadNodes(raw, { iterations: 20 });
  const pairs = [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
  ];
  for (const [p, q] of pairs) {
    const d = Math.hypot(out.get(p).x - out.get(q).x, out.get(p).y - out.get(q).y);
    assert.ok(d >= DEFAULT_MIN_DIST - 0.01, `${p}–${q} separated (got ${d.toFixed(2)})`);
  }
  // and still deterministic
  assert.deepEqual(spreadNodes(raw, { iterations: 20 }), out);
});

// ── forceLayout stability (the regression that blanked the map) ───────────────
// Uncapped repulsion at near-zero distance flung every node ±3000px off-canvas:
// a fresh world drew ZERO visible pixels. The cap + per-step clamp keep the
// layout convergent NEAR its input, whatever coincidences the seeds produce.

test("forceLayout: coincident points separate but stay near their input (no explosion)", () => {
  const raw = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 100, y: 100 }],
    ["c", { x: 400, y: 300 }],
  ]);
  const out = forceLayout(raw, { bridges: [] });
  for (const [id, p] of out) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${id} finite`);
    assert.ok(Math.abs(p.x - raw.get(id).x) < 300, `${id} x stays near input (got ${p.x})`);
    assert.ok(Math.abs(p.y - raw.get(id).y) < 300, `${id} y stays near input (got ${p.y})`);
  }
  const d = Math.hypot(out.get("a").x - out.get("b").x, out.get("a").y - out.get("b").y);
  assert.ok(d > 10, `coincident pair separated (got ${d.toFixed(1)})`);
});

test("forceLayout: distant unbridged nodes are untouched; result is deterministic", () => {
  const raw = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 500, y: 500 }],
  ]);
  const out = forceLayout(raw, { bridges: [] });
  assert.deepEqual(out.get("a"), { x: 0, y: 0 });
  assert.deepEqual(out.get("b"), { x: 500, y: 500 });
  const raw2 = new Map([["a", { x: 100, y: 100 }], ["b", { x: 100, y: 100 }]]);
  assert.deepEqual(forceLayout(raw2, { bridges: [] }), forceLayout(raw2, { bridges: [] }));
});
