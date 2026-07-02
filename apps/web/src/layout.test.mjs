import test from "node:test";
import assert from "node:assert/strict";
import { spreadNodes, DEFAULT_MIN_DIST } from "./layout.js";

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
