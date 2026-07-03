// seeds.test.mjs — node --test, no wasm. Guards the deterministic seed world's
// invariants (SPEC-0022): fixed ids must be UNIQUE (the CRDT upserts by id, so a
// collision silently replaces a row — the architect caught exactly that in
// review), bridge endpoints must exist, and the Physics trailhead must be an
// e2-dominant row in the Physics domain. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { SEED_PLATEAUS, SEED_BRIDGES, SEED_RESOURCES, P } from "./seeds.js";
import { MATH_DOMAIN, MUSIC_DOMAIN, PHYSICS_DOMAIN, DOMAINS } from "./persona.js";

// The exact strings parse_resource_kind matches (convert.rs); "Note" is its
// fallback, so a typo here would silently degrade to Note in Rust — guard the
// exact set so the typo is caught in JS instead (R-0027 AC5).
const KNOWN_KINDS = new Set(["Article", "Video", "Interactive", "Paper", "Tool"]);

test("every seed id is unique across plateaus, bridges AND resources (id-keyed upsert safety)", () => {
  const ids = [
    ...SEED_PLATEAUS.map((p) => p.id),
    ...SEED_BRIDGES.map((b) => b.id),
    ...SEED_RESOURCES.map((r) => r.id),
  ];
  assert.equal(new Set(ids).size, ids.length, `duplicate seed id found in: ${ids.join(", ")}`);
});

test("every seed resource anchors to a seeded plateau and uses a known kind (R-0027)", () => {
  const plateauIds = new Set(SEED_PLATEAUS.map((p) => p.id));
  assert.ok(SEED_RESOURCES.length >= 3, "ships a handful of example resources");
  for (const r of SEED_RESOURCES) {
    assert.ok(plateauIds.has(r.plateau), `resource "${r.title}" anchors to an unknown plateau`);
    assert.ok(KNOWN_KINDS.has(r.kind), `resource "${r.title}" has unknown kind ${r.kind}`);
    assert.match(r.uri, /^https:\/\//, `resource "${r.title}" must be an https link`);
  }
  // At least three distinct topics carry resources (incl. Harmony, the owner's).
  const topics = new Set(SEED_RESOURCES.map((r) => r.plateau));
  assert.ok(topics.size >= 3, "resources spread across ≥3 topics");
  assert.ok(
    SEED_RESOURCES.some((r) => r.plateau === P.Harmony),
    "Harmony has a resource",
  );
});

test("every seed bridge endpoint is a seeded plateau", () => {
  const plateauIds = new Set(SEED_PLATEAUS.map((p) => p.id));
  for (const b of SEED_BRIDGES) {
    assert.ok(plateauIds.has(b.from), `bridge ${b.id} from-endpoint missing`);
    assert.ok(plateauIds.has(b.to), `bridge ${b.id} to-endpoint missing`);
  }
});

test("every seed plateau's domain is an orientable DOMAINS entry", () => {
  const domainIds = new Set(DOMAINS.map((d) => d.id));
  for (const p of SEED_PLATEAUS) {
    assert.ok(domainIds.has(p.domain), `plateau "${p.name}" has unknown domain ${p.domain}`);
  }
});

test("the Physics trailhead row: Motion, e2-dominant on-axis, PHYSICS domain (R-0022)", () => {
  const motion = SEED_PLATEAUS.find((p) => p.name === "Motion");
  assert.ok(motion, "Motion seed plateau exists");
  assert.equal(motion.id, P.Motion, "P map resolves Motion");
  assert.equal(motion.domain, PHYSICS_DOMAIN);
  // On-axis e2 = 1.0 keeps the canonical seed-margin invariant (persona.js
  // SEED=0.16 vs threshold 0.15) true for a physics-facing lens.
  assert.equal(motion.e2, 1.0);
  assert.ok(motion.e2 > motion.e1 && motion.e2 > motion.e3, "e2-dominant");
});

test("each domain has an on-axis trailhead-grade row (coord 1.0)", () => {
  const onAxis = (domain, key) => SEED_PLATEAUS.some((p) => p.domain === domain && p[key] === 1.0);
  assert.ok(onAxis(MATH_DOMAIN, "e1"), "Mathematics has an e1=1.0 row (Arithmetic)");
  assert.ok(onAxis(MUSIC_DOMAIN, "e3"), "Music has an e3=1.0 row (Rhythm)");
  assert.ok(onAxis(PHYSICS_DOMAIN, "e2"), "Physics has an e2=1.0 row (Motion)");
});

test("the physics bridge ties Motion into the world through Calculus", () => {
  const b = SEED_BRIDGES.find((x) => x.to === P.Motion || x.from === P.Motion);
  assert.ok(b, "a seed bridge touches Motion");
  assert.equal(b.from, P.Calculus, "Calculus is the transversal hub");
  assert.equal(b.concept, "equations of motion");
});
