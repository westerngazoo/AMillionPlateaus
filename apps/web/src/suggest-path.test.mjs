// suggest-path.test.mjs — node --test, pure (R-0053). The two suggestion
// levels: choosing the best existing path, and generating a route from the
// graph when nothing fits.

import test from "node:test";
import assert from "node:assert/strict";

import { pickSuggested, buildSuggestedRoute } from "./suggest-path.js";

// A tiny world: domain M (math) topics m1..m4, domain P (physics) topic px.
const PLATEAUS = [
  { id: "m1", name: "Algebra", domain_id: "M" },
  { id: "m2", name: "Calculus", domain_id: "M" },
  { id: "m3", name: "Geometry", domain_id: "M" },
  { id: "m4", name: "Topology", domain_id: "M" },
  { id: "px", name: "Motion", domain_id: "P" },
];

test("pickSuggested: a started-but-unfinished path beats a fresh one (momentum)", () => {
  const started = { id: "a", title: "Started", steps: ["m1", "m2"] }; // m1 mastered
  const fresh = { id: "b", title: "Fresh", steps: ["m3", "m4"] };
  const pick = pickSuggested({
    paths: [fresh, started],
    plateaus: PLATEAUS,
    mastered: new Set(["m1"]),
    domainId: "M",
  });
  assert.equal(pick.id, "a");
});

test("pickSuggested: among fresh paths, the one covering YOUR domain wins", () => {
  const math = { id: "a", title: "Math route", steps: ["m1", "m2"] };
  const physics = { id: "b", title: "Physics route", steps: ["px"] };
  assert.equal(pickSuggested({ paths: [physics, math], plateaus: PLATEAUS, domainId: "M" }).id, "a");
  assert.equal(pickSuggested({ paths: [physics, math], plateaus: PLATEAUS, domainId: "P" }).id, "b");
});

test("pickSuggested: finished and empty paths are never suggested; none left → null", () => {
  const done = { id: "a", title: "Done", steps: ["m1"] };
  const empty = { id: "b", title: "Empty", steps: [] };
  assert.equal(pickSuggested({ paths: [done, empty], plateaus: PLATEAUS, mastered: new Set(["m1"]) }), null);
});

test("pickSuggested: deterministic title tie-break", () => {
  const a = { id: "1", title: "Alpha", steps: ["m1"] };
  const b = { id: "2", title: "Beta", steps: ["m2"] };
  assert.equal(pickSuggested({ paths: [b, a], plateaus: PLATEAUS, domainId: "M" }).title, "Alpha");
});

// Bridges: m1—m2, m1—m3, m2—m4, m3—px (physics connector), px—m4.
const BRIDGES = [
  { from: "m1", to: "m2" },
  { from: "m1", to: "m3" },
  { from: "m2", to: "m4" },
  { from: "m3", to: "px" },
  { from: "px", to: "m4" },
];

test("buildSuggestedRoute: BFS from where you stand, unmastered in-domain, nearest first", () => {
  const route = buildSuggestedRoute({
    plateaus: PLATEAUS,
    bridges: BRIDGES,
    mastered: new Set(),
    startId: "m1",
    domainId: "M",
  });
  // m1 first (standing on it, unmastered), then its neighbours name-sorted
  // (Calculus m2 before Geometry m3), then the next ring (Topology m4).
  // px is traversed as a connector but never enters the route (domain P).
  assert.deepEqual(route, ["m1", "m2", "m3", "m4"]);
});

test("buildSuggestedRoute: mastered topics are skipped (including the start)", () => {
  const route = buildSuggestedRoute({
    plateaus: PLATEAUS,
    bridges: BRIDGES,
    mastered: new Set(["m1", "m2"]),
    startId: "m1",
    domainId: "M",
  });
  assert.deepEqual(route, ["m3", "m4"]);
});

test("buildSuggestedRoute: cap, everything-mastered → [], and start fallback", () => {
  const capped = buildSuggestedRoute({
    plateaus: PLATEAUS, bridges: BRIDGES, startId: "m1", domainId: "M", max: 2,
  });
  assert.equal(capped.length, 2);
  const nothing = buildSuggestedRoute({
    plateaus: PLATEAUS, bridges: BRIDGES,
    mastered: new Set(["m1", "m2", "m3", "m4"]), startId: "m1", domainId: "M",
  });
  assert.deepEqual(nothing, []);
  // unknown startId → falls back to the domain's first plateau by id (m1)
  const fallback = buildSuggestedRoute({
    plateaus: PLATEAUS, bridges: BRIDGES, startId: "nope", domainId: "M",
  });
  assert.equal(fallback[0], "m1");
});
