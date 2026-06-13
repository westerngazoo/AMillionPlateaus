// wayfinding.test.mjs — node --test, no wasm, no browser. Proves the travel
// camera math (SPEC-0019 §2.2, R-0019 AC5): centerOn computes the view origin
// that, under the REAL project.js projection, lands a topic at the canvas
// centre. We test against the actual `project` so the inversion can't drift
// from the projection it inverts. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { centerOn, zoomAt, clampScale, SCALE_MIN, SCALE_MAX } from "./wayfinding.js";
import { project } from "./project.js";

const CANVAS = { width: 800, height: 600 };
const SCALE = 320;

// A spread of grade-1 positions, including the off-axis e2 depth term and
// negatives, so we exercise every term of the inversion.
const POSITIONS = [
  { e1: 0, e2: 0, e3: 0 },
  { e1: 1, e2: 0, e3: 0 },
  { e1: 0, e2: 1, e3: 0 },
  { e1: 0, e2: 0, e3: 1 },
  { e1: 0.9, e2: 0.1, e3: 0.0 },
  { e1: -0.7, e2: 0.4, e3: -0.3 },
  { e1: 0.33, e2: -0.5, e3: 0.8 },
];

test("centerOn lands a topic at the canvas centre under the real projection (AC2/AC5)", () => {
  for (const pos of POSITIONS) {
    const { cx, cy } = centerOn(pos, CANVAS, SCALE);
    const pt = project(pos, { cx, cy, scale: SCALE });
    assert.ok(Math.abs(pt.x - CANVAS.width / 2) < 1e-9, `x for ${JSON.stringify(pos)}`);
    assert.ok(Math.abs(pt.y - CANVAS.height / 2) < 1e-9, `y for ${JSON.stringify(pos)}`);
  }
});

test("centerOn is deterministic — same inputs, same origin (AC5)", () => {
  const a = centerOn({ e1: 0.5, e2: 0.2, e3: -0.1 }, CANVAS, SCALE);
  const b = centerOn({ e1: 0.5, e2: 0.2, e3: -0.1 }, CANVAS, SCALE);
  assert.deepEqual(a, b);
});

test("missing position coords default to 0 (no NaN origin)", () => {
  // A degenerate/partial position must not produce NaN — it centres the origin.
  const { cx, cy } = centerOn({}, CANVAS, SCALE);
  assert.equal(cx, CANVAS.width / 2);
  assert.equal(cy, CANVAS.height / 2);
});

test("travel is camera-only — the projected centre is independent of scale", () => {
  // Whatever the zoom, centerOn keeps the topic dead-centre (it only moves the
  // origin). Two scales, same topic → both land at centre.
  const pos = { e1: 0.4, e2: 0.6, e3: -0.2 };
  for (const scale of [120, 320, 900]) {
    const pt = project(pos, { ...centerOn(pos, CANVAS, scale), scale });
    assert.ok(Math.abs(pt.x - CANVAS.width / 2) < 1e-9);
    assert.ok(Math.abs(pt.y - CANVAS.height / 2) < 1e-9);
  }
});

// ── Zoom (R-0024 AC5) ────────────────────────────────────────────────────────

test("zoomAt keeps the cursor's graph point fixed under the real projection", () => {
  const view = { cx: 230, cy: 150, scale: 320 };
  const pos = { e1: 0.7, e2: 0.2, e3: -0.3 };
  const p0 = project(pos, view); // where the node sits now
  for (const factor of [1.15, 1 / 1.15, 2, 0.5]) {
    const v2 = zoomAt(view, factor, p0.x, p0.y); // zoom anchored AT the node
    const p1 = project(pos, v2);
    assert.ok(Math.abs(p1.x - p0.x) < 1e-6, `x anchored for factor ${factor}`);
    assert.ok(Math.abs(p1.y - p0.y) < 1e-6, `y anchored for factor ${factor}`);
  }
});

test("zoomAt scales by the factor, within clamp", () => {
  const view = { cx: 230, cy: 150, scale: 320 };
  assert.ok(Math.abs(zoomAt(view, 2, 400, 300).scale - 640) < 1e-9);
  assert.ok(Math.abs(zoomAt(view, 0.5, 400, 300).scale - 160) < 1e-9);
});

test("clampScale bounds both ends; a zoom past the edge leaves the origin unchanged", () => {
  assert.equal(clampScale(10), SCALE_MIN);
  assert.equal(clampScale(99999), SCALE_MAX);
  assert.equal(clampScale(320), 320);
  // Already at SCALE_MAX → zooming in further is a no-op (k == 1, origin fixed).
  const maxed = { cx: 230, cy: 150, scale: SCALE_MAX };
  const z = zoomAt(maxed, 2, 400, 300);
  assert.equal(z.scale, SCALE_MAX);
  assert.equal(z.cx, 230);
  assert.equal(z.cy, 150);
});

test("zoomAt is deterministic", () => {
  const v = { cx: 230, cy: 150, scale: 320 };
  assert.deepEqual(zoomAt(v, 1.15, 400, 300), zoomAt(v, 1.15, 400, 300));
});
