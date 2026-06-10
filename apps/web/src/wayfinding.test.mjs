// wayfinding.test.mjs — node --test, no wasm, no browser. Proves the travel
// camera math (SPEC-0019 §2.2, R-0019 AC5): centerOn computes the view origin
// that, under the REAL project.js projection, lands a topic at the canvas
// centre. We test against the actual `project` so the inversion can't drift
// from the projection it inverts. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { centerOn } from "./wayfinding.js";
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
