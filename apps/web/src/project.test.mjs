// Unit test for the pure projection (R-0005 AC4). No wasm, no DOM:
//     node --test apps/web/src/project.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { project } from "./project.js";

const view = { cx: 100, cy: 50, scale: 10 };

test("origin maps to the view center", () => {
  assert.deepEqual(project({ e1: 0, e2: 0, e3: 0 }, view), { x: 100, y: 50 });
});

test("e1 moves right, e3 moves down", () => {
  assert.deepEqual(project({ e1: 1, e2: 0, e3: 0 }, view), { x: 110, y: 50 });
  assert.deepEqual(project({ e1: 0, e2: 0, e3: 1 }, view), { x: 100, y: 60 });
});

test("e2 is up-left depth (pulls both x and y back)", () => {
  assert.deepEqual(project({ e1: 0, e2: 2, e3: 0 }, view), { x: 90, y: 40 });
});

test("projection is deterministic (both tabs agree)", () => {
  const p = { e1: 0.8, e2: 0.1, e3: 0.4 };
  assert.deepEqual(project(p, view), project(p, view));
});
