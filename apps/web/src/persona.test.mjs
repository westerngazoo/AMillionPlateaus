// persona.test.mjs — node --test, no wasm. Proves the pure persona→reputation
// mapping (SPEC-0006 §3, R-0006 AC6). Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHETYPES,
  DOMAINS,
  seedReputation,
  MATH_DOMAIN,
  MUSIC_DOMAIN,
  PHYSICS_DOMAIN,
} from "./persona.js";

const byId = (id) => ARCHETYPES.find((a) => a.id === id);

test("geometer seeds e1 in the Mathematics domain only", () => {
  const r = seedReputation(byId("geometer"));
  assert.deepEqual(Object.keys(r.domain_reps), [MATH_DOMAIN]);
  assert.deepEqual(r.domain_reps[MATH_DOMAIN], [0, 0.16, 0, 0, 0, 0, 0, 0]);
});

test("composer seeds e3 in the Music domain only", () => {
  const r = seedReputation(byId("composer"));
  assert.deepEqual(Object.keys(r.domain_reps), [MUSIC_DOMAIN]);
  assert.deepEqual(r.domain_reps[MUSIC_DOMAIN], [0, 0, 0, 0, 0.16, 0, 0, 0]);
});

test("polymath seeds one grade-1 vector per domain", () => {
  const r = seedReputation(byId("polymath"));
  assert.deepEqual(r.domain_reps[MATH_DOMAIN], [0, 0.16, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.domain_reps[MUSIC_DOMAIN], [0, 0, 0, 0, 0.16, 0, 0, 0]);
});

test("physicist seeds e2 in the Physics domain only (R-0022)", () => {
  const r = seedReputation(byId("physicist"));
  assert.deepEqual(Object.keys(r.domain_reps), [PHYSICS_DOMAIN]);
  assert.deepEqual(r.domain_reps[PHYSICS_DOMAIN], [0, 0, 0.16, 0, 0, 0, 0, 0]);
});

test("PHYSICS_DOMAIN matches the importer's domain id (R-0022 cross-crate contract)", () => {
  // mp-host's import::PHYSICS_DOMAIN tags e2-dominant notes with this exact id;
  // the Rust side pins the same literal in mp-host/tests/import.rs. Either
  // side drifting fails its own suite.
  assert.equal(PHYSICS_DOMAIN, "33333333-3333-3333-3333-333333333333");
});

test("DOMAINS offers Physics with a canonical e2 axis (R-0022)", () => {
  const physics = DOMAINS.find((d) => d.id === PHYSICS_DOMAIN);
  assert.ok(physics, "Physics is an orientable domain");
  assert.equal(physics.label, "Physics");
  assert.deepEqual(physics.canonical, { e1: 0, e2: 1, e3: 0 });
});

test("the mapping is deterministic", () => {
  const a = byId("geometer");
  assert.deepEqual(seedReputation(a), seedReputation(a));
});

test("an empty / scalar-only archetype reaches nothing (Sybil/fog)", () => {
  // No grade-1 orientation → empty reputation. The engine sends a grade-1-zero
  // reputation to fog (engine side proved in
  // mp-wasm/src/convert.rs::scalar_only_reputation_reaches_nothing).
  assert.deepEqual(seedReputation({ orient: [] }).domain_reps, {});
  assert.deepEqual(seedReputation({}).domain_reps, {});
  const zero = seedReputation({ orient: [{ domain: MATH_DOMAIN, dir: { e1: 0, e2: 0, e3: 0 } }] });
  assert.deepEqual(zero.domain_reps[MATH_DOMAIN], [0, 0, 0, 0, 0, 0, 0, 0]);
});

test("every shipped archetype has a name, a domain label and a one-line blurb", () => {
  assert.ok(ARCHETYPES.length >= 3, "at least three archetypes (R-0006 AC1)");
  for (const a of ARCHETYPES) {
    assert.equal(typeof a.name, "string");
    assert.ok(a.name.length > 0);
    assert.ok(a.domainLabel.length > 0);
    assert.ok(a.blurb.length > 0);
  }
});
