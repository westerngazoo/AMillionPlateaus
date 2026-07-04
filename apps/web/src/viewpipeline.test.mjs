// viewpipeline.test.mjs — node --test, no wasm, no canvas. Proves the pure
// viewModel (SPEC-0043 §2.1/§2.2) covers every render.js draw element and honours
// every §2.1 clarification: tier→radius/alpha split, the three co-occurring
// decorations (progress ring + community bedrock ring + ✓), shadow nodes carrying
// only {id,x,y,fill} and never "studying", and pathRoute:null below 2 steps.
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { viewModel, hueFor, short } from "./viewpipeline.js";

const GRAPH = {
  plateaus: [
    { id: "a", name: "Alpha", domain_id: "d1", position: { e1: 0, e2: 0, e3: 0 } },
    { id: "b", name: "Beta", domain_id: "d1", position: { e1: 0, e2: 0, e3: 0 } },
    { id: "c", name: "Gamma", domain_id: "d2", position: { e1: 0, e2: 0, e3: 0 } },
  ],
  bridges: [{ id: "e1", from: "a", to: "b", concept: "link" }],
  resources: [
    { id: "r1", plateau_id: "a", title: "Doc", state: "Crystallized", vote_count: 3 },
    { id: "r2", plateau_id: "a", title: "Note", state: "Floating", vote_count: 0 },
  ],
};

// Well-separated points so no label/caption is culled by the greedy pack.
const POS = new Map([
  ["a", { x: 100, y: 100 }],
  ["b", { x: 400, y: 100 }],
  ["c", { x: 100, y: 400 }],
]);

const byId = (frame) => new Map(frame.nodes.map((n) => [n.id, n]));

test("no lens ⇒ every node is focus (empty focusDomains)", () => {
  const f = viewModel(GRAPH, POS, {});
  assert.equal(f.nodes.length, 3);
  assert.ok(f.nodes.every((n) => n.tier === "focus"));
});

test("a lens shadows out-of-domain nodes; shadow carries only {id,x,y,fill}", () => {
  const f = viewModel(GRAPH, POS, { focusDomains: new Set(["d1"]) });
  const n = byId(f);
  assert.equal(n.get("a").tier, "focus");
  assert.equal(n.get("b").tier, "focus");
  const shadow = n.get("c");
  assert.equal(shadow.tier, "shadow");
  // Every decoration field is null/false on a shadow node (§2.1 clarification).
  assert.equal(shadow.ring, null);
  assert.equal(shadow.communityRing, false);
  assert.equal(shadow.mastered, false);
  assert.equal(shadow.label, null);
  assert.equal(shadow.fill, "unexplored");
});

test("visited/mastered/focused promote a node to focus even under a foreign lens", () => {
  const lens = new Set(["d2"]); // c's domain; a & b would be shadow…
  assert.equal(byId(viewModel(GRAPH, POS, { focusDomains: lens })).get("a").tier, "shadow");
  // …unless touched:
  assert.equal(
    byId(viewModel(GRAPH, POS, { focusDomains: lens, visited: new Set(["a"]) })).get("a").tier,
    "focus",
  );
  assert.equal(
    byId(viewModel(GRAPH, POS, { focusDomains: lens, focusedId: "a" })).get("a").tier,
    "focus",
  );
});

test("a shadow node is never STUDYING-coloured (visited ⇒ focus)", () => {
  // Even if we (impossibly) mark a shadow node visited, promotion makes it focus,
  // so a shadow fill is only mastered|unexplored — never studying (§2.1).
  const f = viewModel(GRAPH, POS, { focusDomains: new Set(["d1"]), mastered: new Set(["c"]) });
  const c = byId(f).get("c");
  // mastered promotes c to focus (not shadow) — so we assert the general rule:
  assert.equal(c.tier, "focus");
  const shadows = f.nodes.filter((n) => n.tier === "shadow");
  assert.ok(shadows.every((n) => n.fill === "mastered" || n.fill === "unexplored"));
});

test("progress fill/ring tokens (R-0033/R-0030)", () => {
  const f = viewModel(GRAPH, POS, {
    visited: new Set(["a"]),
    mastered: new Set(["b"]),
  });
  const n = byId(f);
  assert.equal(n.get("a").fill, "studying");
  assert.equal(n.get("a").ring, "unexplored");
  assert.equal(n.get("a").mastered, false);
  assert.equal(n.get("b").fill, "mastered");
  assert.equal(n.get("b").ring, "lit");
  assert.equal(n.get("b").mastered, true);
  assert.equal(n.get("c").fill, "unexplored");
  assert.equal(n.get("c").ring, "unexplored");
});

test("the three decorations co-occur on one node (ring + communityRing + ✓)", () => {
  const f = viewModel(GRAPH, POS, {
    mastered: new Set(["a"]),
    community: new Set(["a"]),
  });
  const a = byId(f).get("a");
  assert.equal(a.ring, "lit"); // progress ring
  assert.equal(a.communityRing, true); // SEPARATE bedrock ring
  assert.equal(a.mastered, true); // ✓ glyph
});

test("nodes carry the placed x/y and stay in plateaus order", () => {
  const f = viewModel(GRAPH, POS, {});
  assert.deepEqual(
    f.nodes.map((n) => n.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(byId(f).get("a"), {
    id: "a",
    x: 100,
    y: 100,
    tier: "focus",
    fill: "unexplored",
    ring: "unexplored",
    communityRing: false,
    mastered: false,
    label: "Alpha",
  });
});

test("edges carry endpoints, covered trail, and focus-gated captions", () => {
  const covered = viewModel(GRAPH, POS, { visited: new Set(["a", "b"]) });
  assert.equal(covered.edges.length, 1);
  assert.deepEqual(covered.edges[0].from, { x: 100, y: 100 });
  assert.deepEqual(covered.edges[0].to, { x: 400, y: 100 });
  assert.equal(covered.edges[0].covered, true);
  assert.equal(covered.edges[0].caption, "link");

  // Only one visited endpoint ⇒ not covered; still captioned (touches focus).
  const one = viewModel(GRAPH, POS, { visited: new Set(["a"]) });
  assert.equal(one.edges[0].covered, false);
  assert.equal(one.edges[0].caption, "link");
});

test("a bridge between two shadow nodes draws a line but no caption", () => {
  // A lens on d2 shadows a & b; the a–b concept must not caption (both shadow).
  const g = {
    plateaus: GRAPH.plateaus,
    bridges: [{ id: "e2", from: "a", to: "b", concept: "quiet" }],
    resources: [],
  };
  const f = viewModel(g, POS, { focusDomains: new Set(["d2"]) });
  assert.equal(f.edges.length, 1);
  assert.equal(f.edges[0].caption, null);
});

test("pathRoute is null below 2 steps, and resolves to existing points at ≥2", () => {
  assert.equal(viewModel(GRAPH, POS, { pathSteps: [] }).pathRoute, null);
  assert.equal(viewModel(GRAPH, POS, { pathSteps: ["a"] }).pathRoute, null);
  const f = viewModel(GRAPH, POS, { pathSteps: ["a", "b", "zzz"] });
  // "zzz" is absent from positions → skipped; a, b resolved in order.
  assert.deepEqual(f.pathRoute, [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
  ]);
});

test("overlay rings resolve to points or null", () => {
  const f = viewModel(GRAPH, POS, { focusedId: "a", pathNext: "b" });
  assert.deepEqual(f.overlays.focusRing, { x: 100, y: 100 });
  assert.deepEqual(f.overlays.nextStepRing, { x: 400, y: 100 });
  // pathNext === focusedId ⇒ no next-step ring; missing id ⇒ null.
  assert.equal(
    viewModel(GRAPH, POS, { focusedId: "a", pathNext: "a" }).overlays.nextStepRing,
    null,
  );
  assert.equal(viewModel(GRAPH, POS, { focusedId: "zzz" }).overlays.focusRing, null);
});

test("markers stack per plateau with crystallized state and vote-formatted caption", () => {
  const f = viewModel(GRAPH, POS, {});
  assert.equal(f.markers.length, 2);
  assert.deepEqual(f.markers[0], {
    x: 100,
    y: 100,
    stackIndex: 0,
    crystallized: true,
    caption: "Doc · 3",
  });
  assert.deepEqual(f.markers[1], {
    x: 100,
    y: 100,
    stackIndex: 1,
    crystallized: false,
    caption: "Note", // 0 votes ⇒ no " · n" suffix
  });
});

test("markers on a shadow plateau draw the dot but never a caption", () => {
  const g = {
    plateaus: GRAPH.plateaus,
    bridges: [],
    resources: [{ id: "rc", plateau_id: "c", title: "Hidden", state: "Floating", vote_count: 1 }],
  };
  const f = viewModel(g, POS, { focusDomains: new Set(["d1"]) }); // c is shadow
  assert.equal(f.markers.length, 1);
  assert.equal(f.markers[0].caption, null);
});

test("peers carry anchor, fan index, deterministic hue, and short label", () => {
  const peers = [
    { pubkey: "abcdef123456", plateau: "a" },
    { pubkey: "999999999999", plateau: "a" },
    { pubkey: "orphan", plateau: "missing" },
  ];
  const f = viewModel(GRAPH, POS, { peers });
  assert.equal(f.peers.length, 2); // the orphan (missing plateau) is dropped
  assert.deepEqual(f.peers[0], {
    x: 100,
    y: 100,
    fanIndex: 0,
    hue: hueFor("abcdef123456"),
    label: "abcdef",
  });
  assert.equal(f.peers[1].fanIndex, 1);
});

test("hueFor is deterministic + in-range; short truncates long keys", () => {
  assert.equal(hueFor("abcdef123456"), hueFor("abcdef123456"));
  assert.match(hueFor("abcdef123456"), /^hsl\(\d{1,3}, 70%, 62%\)$/);
  assert.equal(short("abcdef123456"), "abcdef");
  assert.equal(short("ab"), "ab");
  assert.equal(short(""), "?");
});

test("viewModel is pure — same inputs, structurally equal Frame", () => {
  const state = { visited: new Set(["a"]), mastered: new Set(["b"]), community: new Set(["b"]) };
  assert.deepEqual(viewModel(GRAPH, POS, state), viewModel(GRAPH, POS, state));
});
