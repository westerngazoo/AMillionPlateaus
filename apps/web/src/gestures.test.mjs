// gestures.test.mjs — R-0037 / SPEC-0037. The pinch reducer is pure: two-finger frames
// → { factor, cx, cy } for zoomAt. Deterministic, no DOM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pinch } from "./gestures.js";

const frame = (ax, ay, bx, by) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } });

test("pinch: fingers spreading apart → factor > 1 (zoom in)", () => {
  const prev = frame(40, 50, 60, 50); // 20 apart
  const cur = frame(20, 50, 80, 50); // 60 apart
  const g = pinch(prev, cur);
  assert.ok(g.factor > 1);
  assert.equal(g.factor, 3); // 60 / 20
});

test("pinch: fingers coming together → factor < 1 (zoom out)", () => {
  const prev = frame(0, 0, 100, 0); // 100 apart
  const cur = frame(25, 0, 75, 0); // 50 apart
  assert.equal(pinch(prev, cur).factor, 0.5);
});

test("pinch: anchor is the midpoint of the CURRENT frame", () => {
  const g = pinch(frame(0, 0, 10, 10), frame(10, 20, 30, 40));
  assert.equal(g.cx, 20); // (10 + 30) / 2
  assert.equal(g.cy, 30); // (20 + 40) / 2
});

test("pinch: coincident points (zero start distance) ⇒ factor 1 (no NaN/∞)", () => {
  const g = pinch(frame(50, 50, 50, 50), frame(10, 10, 90, 90));
  assert.equal(g.factor, 1);
  assert.ok(Number.isFinite(g.factor));
});

test("pinch: a non-finite frame ⇒ factor 1 (never pollutes zoomAt)", () => {
  const g = pinch(frame(0, 0, 10, 0), frame(NaN, 0, 10, 0));
  assert.equal(g.factor, 1);
});

test("pinch: a pure two-finger TRANSLATE (no spread) ⇒ factor ≈ 1 (no zoom)", () => {
  // both fingers shift right by 30, distance unchanged → factor 1 (two-finger pan is a non-feature)
  const g = pinch(frame(0, 0, 40, 0), frame(30, 0, 70, 0));
  assert.equal(g.factor, 1);
});

test("pinch: deterministic", () => {
  const prev = frame(1, 2, 3, 4);
  const cur = frame(5, 6, 9, 12);
  assert.deepEqual(pinch(prev, cur), pinch(prev, cur));
});
