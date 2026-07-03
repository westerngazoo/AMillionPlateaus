// persona.test.mjs — node --test, no wasm. Proves the pure persona→reputation
// mapping (SPEC-0006 §3, R-0006 AC6). Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHETYPES,
  DOMAINS,
  seedReputation,
  authorPersona,
  authorDomain,
  domainIdFor,
  SUGGESTED_DOMAINS,
  MATH_DOMAIN,
  MUSIC_DOMAIN,
  PHYSICS_DOMAIN,
} from "./persona.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

// ── Author-your-own domains (SPEC-0038 / R-0038) ───────────────────────────

test("authorDomain builds {id,label,canonical} from a name + Formal/Empirical/Creative", () => {
  const d = authorDomain({ name: "AI", e1: 0.7, e2: 0.6, e3: 0.1 });
  assert.equal(d.label, "AI");
  assert.deepEqual(d.canonical, { e1: 0.7, e2: 0.6, e3: 0.1 });
  assert.match(d.id, UUID_RE); // a Rust Uuid::parse_str accepts this (signed traversal validates, AC3)
});

test("domainIdFor is stable + normalized (dedup): same name → same id (AC3)", () => {
  assert.equal(domainIdFor("AI"), domainIdFor("ai"));
  assert.equal(domainIdFor("AI"), domainIdFor("  AI  "));
  assert.equal(authorDomain({ name: "FPGA" }).id, authorDomain({ name: "fpga" }).id);
});

test("authorDomain is direction-only — sliders clamp to [0,1], no magnitude field (AC2)", () => {
  const d = authorDomain({ name: "X", e1: 5, e2: -3, e3: Number.NaN });
  assert.deepEqual(d.canonical, { e1: 1, e2: 0, e3: 0 }); // clamped; NaN → 0
  assert.deepEqual(Object.keys(d).sort(), ["canonical", "id", "label"]); // no score/rank/magnitude
});

test("authorDomain rejects a blank name", () => {
  assert.equal(authorDomain({ name: "   " }), null);
  assert.equal(authorDomain({}), null);
  assert.equal(authorDomain(), null);
});

test("domainIdFor: distinct + near-identical short names get distinct ids (~128-bit lanes, finding #2)", () => {
  // Distinct AFTER normalization (lowercase/trim) — "ai"≡"AI" would dedup by design, so
  // the near-identical probes here (x/y/z, ab/ba, ia) don't collide with the suggested set.
  const names = ["x", "y", "z", "ab", "ba", "ia", ...SUGGESTED_DOMAINS.map((s) => s.name)];
  const ids = names.map(domainIdFor);
  assert.equal(new Set(ids).size, ids.length, "no id collisions");
  for (const id of ids) assert.match(id, UUID_RE);
});

test("authorPersona resolves an AUTHORED domain's label via the resolver — not 'Uncharted' (finding #1/AC4)", () => {
  const ai = authorDomain({ name: "AI", e1: 0.7, e2: 0.6 });
  const resolve = (id) => (id === ai.id ? ai.label : undefined);
  const p = authorPersona(
    { name: "Me", orient: [{ domain: ai.id, dir: { e1: 1, e2: 0, e3: 0 } }] },
    resolve,
  );
  assert.equal(p.domainLabel, "AI");
  assert.ok(p.blurb.includes("AI"));
  assert.ok(!p.domainLabel.includes("Uncharted") && !p.blurb.includes("Uncharted"));
});

test("authorPersona with NO resolver is byte-identical to the pre-0038 output", () => {
  const seed = {
    name: "Geo",
    orient: [{ domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } }],
    tone: "",
  };
  const p = authorPersona(seed); // no second arg → static DOMAINS only
  assert.equal(p.domainLabel, "Mathematics"); // built-in still resolves
  assert.equal(p.blurb, "Wakes facing Mathematics — your starting orientation.");
  // an UNKNOWN domain with no resolver still degrades to "Uncharted" exactly as before
  const u = authorPersona({
    orient: [{ domain: "deadbeef-0000-0000-0000-000000000000", dir: { e1: 1 } }],
  });
  assert.equal(u.domainLabel, "Uncharted");
});
