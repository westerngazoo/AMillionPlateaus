// physics-lens-curriculum.test.mjs — node --test, pure data checks (R-0057).
// Proves the physics-lens module's ids are sound and unique, every bridge/
// resource/path references a REAL plateau (its own, the seed world, or the QC
// math island it meets), the two lens trailheads sit on their lens' canonical
// direction (clearing mp-graph's fog margin), and the GA/SIA lenses are wired
// into the persona registry.

import test from "node:test";
import assert from "node:assert/strict";

import {
  PHYS_PLATEAUS, GA_PLATEAUS, SIA_PLATEAUS,
  PHYS_LENS_PLATEAUS, PHYS_LENS_BRIDGES, PHYS_LENS_RESOURCES, PHYS_LENS_PATHS,
} from "./physics-lens-curriculum.js";
import { SEED_PLATEAUS } from "./seeds.js";
import { QC_PLATEAUS } from "./curriculum.js";
import { CS_PLATEAUS } from "./cs-curriculum.js";
import { GA_DOMAIN, SIA_DOMAIN, PHYSICS_DOMAIN, ARCHETYPES, DOMAINS } from "./persona.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every plateau id that a bridge/resource/path may legally point at.
const KNOWN = new Set([
  ...PHYS_LENS_PLATEAUS, ...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS,
].map((p) => p.id));

test("every id is a valid uuid and globally unique (incl. vs seeds/curriculum/cs)", () => {
  const localIds = [
    ...PHYS_LENS_PLATEAUS.map((p) => p.id),
    ...PHYS_LENS_BRIDGES.map((b) => b.id),
    ...PHYS_LENS_RESOURCES.map((r) => r.id),
    ...PHYS_LENS_PATHS.map((p) => p.id),
  ];
  for (const id of localIds) assert.match(id, UUID);
  assert.equal(new Set(localIds).size, localIds.length, "no dup within the module (all id kinds)");
  // no id collision (plateaus AND bridges/resources/paths) with the other seeded worlds
  const others = new Set([...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS].map((p) => p.id));
  for (const id of localIds) assert.equal(others.has(id), false, `${id} collides with a seeded id`);
});

test("fixed-id namespaces: physics 8…, GA 9…, SIA a…, bridges b…, resources c…, path d…", () => {
  for (const p of PHYS_PLATEAUS) assert.match(p.id, /^80000000-/);
  for (const p of GA_PLATEAUS) assert.match(p.id, /^90000000-/);
  for (const p of SIA_PLATEAUS) assert.match(p.id, /^a0000000-/);
  for (const b of PHYS_LENS_BRIDGES) assert.match(b.id, /^b0000000-/);
  for (const r of PHYS_LENS_RESOURCES) assert.match(r.id, /^c0000000-/);
  for (const p of PHYS_LENS_PATHS) assert.match(p.id, /^d0000000-/);
});

test("every plateau has a real domain + finite GA coords", () => {
  const domains = new Set([PHYSICS_DOMAIN, GA_DOMAIN, SIA_DOMAIN]);
  for (const p of PHYS_LENS_PLATEAUS) {
    assert.ok(domains.has(p.domain), `${p.name} has a known domain`);
    assert.ok(p.name && (p.description || "").length > 40, `${p.name} has body`);
    for (const c of [p.e1, p.e2, p.e3]) assert.ok(Number.isFinite(c), `${p.name} coord finite`);
  }
  // physics core is PHYSICS_DOMAIN; each lens is its own domain
  for (const p of PHYS_PLATEAUS) assert.equal(p.domain, PHYSICS_DOMAIN);
  for (const p of GA_PLATEAUS) assert.equal(p.domain, GA_DOMAIN);
  for (const p of SIA_PLATEAUS) assert.equal(p.domain, SIA_DOMAIN);
});

test("every bridge connects two REAL plateaus (own, seed, or the QC meet island)", () => {
  for (const b of PHYS_LENS_BRIDGES) {
    assert.ok(KNOWN.has(b.from), `bridge ${b.id} from unknown ${b.from}`);
    assert.ok(KNOWN.has(b.to), `bridge ${b.id} to unknown ${b.to}`);
    assert.ok(b.concept && b.concept.length > 0, `bridge ${b.id} names its concept`);
  }
});

test("the four (meet) bridges genuinely cross INTO the existing QC math island", () => {
  const qc = new Set(QC_PLATEAUS.map((p) => p.id));
  const meets = PHYS_LENS_BRIDGES.filter((b) => b.concept.startsWith("(meet)"));
  assert.equal(meets.length, 4, "four meet crossings");
  for (const b of meets) assert.ok(qc.has(b.to), `meet ${b.id} lands on a QC plateau`);
});

test("resources + path steps reference real plateaus", () => {
  for (const r of PHYS_LENS_RESOURCES) assert.ok(KNOWN.has(r.plateau), `resource ${r.id} → real plateau`);
  for (const path of PHYS_LENS_PATHS) {
    assert.ok(path.steps.length >= 2, "a path has ≥2 steps");
    for (const s of path.steps) assert.ok(KNOWN.has(s), `path step ${s} is a real plateau`);
  }
});

test("both lens trailheads sit on their lens' canonical direction (fog margin)", () => {
  const canon = (id) => DOMAINS.find((d) => d.id === id).canonical;
  const gaTrail = GA_PLATEAUS[0]; // The Geometric Product
  const siaTrail = SIA_PLATEAUS[0]; // Nilsquare Infinitesimals
  const ga = canon(GA_DOMAIN), sia = canon(SIA_DOMAIN);
  assert.deepEqual({ e1: gaTrail.e1, e2: gaTrail.e2, e3: gaTrail.e3 }, ga, "GA trailhead on-axis");
  assert.deepEqual({ e1: siaTrail.e1, e2: siaTrail.e2, e3: siaTrail.e3 }, sia, "SIA trailhead on-axis");
  // canonical directions are ~unit length (so SEED=0.16 projection clears 0.15 fog)
  for (const c of [ga, sia]) {
    const n = Math.hypot(c.e1, c.e2, c.e3);
    assert.ok(Math.abs(n - 1) < 0.02, `canonical ~unit (got ${n.toFixed(3)})`);
  }
});

test("the GA and SIA lenses are registered as pickable personas + domains", () => {
  for (const dom of [GA_DOMAIN, SIA_DOMAIN]) {
    assert.ok(DOMAINS.some((d) => d.id === dom), "domain in the lens registry");
    assert.ok(ARCHETYPES.some((a) => a.orient.some((o) => o.domain === dom)), "a persona faces it");
  }
});
