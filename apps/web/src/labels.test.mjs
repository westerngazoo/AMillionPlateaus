// labels.test.mjs — node --test, no canvas. Proves label decluttering (R-0024
// AC3/AC5): far-apart labels both show; overlapping ones cull by priority
// (focused → lit → rest); deterministic; missing points skipped.
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { planLabels, labelBox } from "./labels.js";

const P = (id, name) => ({ id, name });

test("two far-apart plateaus both get labels", () => {
  const plateaus = [P("a", "Calculus"), P("b", "Rhythm")];
  const points = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 500, y: 400 }],
  ]);
  const kept = planLabels({ plateaus, points, reachable: new Set() });
  assert.ok(kept.has("a") && kept.has("b"));
});

test("overlapping labels: the higher-priority (lit) one wins, fogged dropped", () => {
  const plateaus = [P("fog", "Fogged topic"), P("lit", "Lit topic")];
  const points = new Map([
    ["fog", { x: 200, y: 200 }],
    ["lit", { x: 205, y: 200 }], // boxes overlap
  ]);
  const kept = planLabels({ plateaus, points, reachable: new Set(["lit"]) });
  assert.ok(kept.has("lit"), "lit kept");
  assert.ok(!kept.has("fog"), "overlapping fogged dropped — even though it's first in input order");
});

test("the focused plateau outranks an overlapping lit one", () => {
  const plateaus = [P("lit", "Lit topic"), P("foc", "Focused topic")];
  const points = new Map([
    ["lit", { x: 300, y: 300 }],
    ["foc", { x: 305, y: 300 }],
  ]);
  const kept = planLabels({ plateaus, points, reachable: new Set(["lit", "foc"]), focusedId: "foc" });
  assert.ok(kept.has("foc") && !kept.has("lit"));
});

test("a plateau with no screen point is skipped, not thrown", () => {
  const plateaus = [P("a", "A"), P("ghost", "Ghost")];
  const points = new Map([["a", { x: 100, y: 100 }]]); // ghost missing
  const kept = planLabels({ plateaus, points, reachable: new Set() });
  assert.ok(kept.has("a") && !kept.has("ghost"));
});

test("deterministic", () => {
  const plateaus = [P("a", "Aaa"), P("b", "Bbb"), P("c", "Ccc")];
  const points = new Map([
    ["a", { x: 100, y: 100 }],
    ["b", { x: 104, y: 100 }],
    ["c", { x: 600, y: 400 }],
  ]);
  const args = { plateaus, points, reachable: new Set() };
  assert.deepEqual([...planLabels(args)], [...planLabels(args)]);
});

test("labelBox is centered under the disc and at least a minimum width", () => {
  const box = labelBox("Hi", { x: 200, y: 100 });
  assert.ok(box.w >= 12);
  assert.ok(Math.abs(box.x + box.w / 2 - 200) < 1e-9, "centered on the disc x");
  assert.ok(box.y > 100, "below the disc");
});

// ── planBoxes: the generic caption declutter (bridge concepts, resource titles) ──

test("planBoxes keeps non-overlapping captions and drops colliders, in priority order", async () => {
  const { planBoxes, captionBox } = await import("./labels.js");
  const a = { key: "a", box: captionBox("wide caption text", 100, 100) };
  const b = { key: "b", box: captionBox("overlapping here", 110, 102) }; // collides with a
  const c = { key: "c", box: captionBox("far away", 400, 300) };
  const kept = planBoxes([a, b, c]);
  assert.ok(kept.has("a"), "first wins");
  assert.ok(!kept.has("b"), "collider dropped");
  assert.ok(kept.has("c"), "distant kept");
});

test("planBoxes never displaces obstacles — name labels always win", async () => {
  const { planBoxes, captionBox, labelBox } = await import("./labels.js");
  const nameBox = labelBox("Intuitionistic Logic", { x: 100, y: 100 });
  const under = { key: "u", box: captionBox("concept", 100, 100 + 16 + 4 + 7) }; // sits on the name box
  const clear = { key: "k", box: captionBox("concept", 100, 300) };
  const kept = planBoxes([under, clear], { obstacles: [nameBox] });
  assert.ok(!kept.has("u"), "caption under a name label is culled");
  assert.ok(kept.has("k"));
});

test("planBoxes is deterministic", async () => {
  const { planBoxes, captionBox } = await import("./labels.js");
  const cands = [
    { key: "x", box: captionBox("one", 10, 10) },
    { key: "y", box: captionBox("two", 12, 11) },
  ];
  assert.deepEqual([...planBoxes(cands)], [...planBoxes(cands)]);
});
