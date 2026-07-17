// physics-core-curriculum.test.mjs — node --test, pure data checks (R-0066,
// added R-0067 to restore the per-module integrity-test convention). Proves the
// detailed physics-core module's ids are valid + globally unique (vs seeds/QC/CS/
// phys-lens), every bridge/resource/path references a REAL plateau (its own new
// intro topics, the R-0057 upper-division ids it threads up into, or the seed
// Motion trailhead), coords are finite Grade-1, bodies are source-grounded, and
// the 20-step numbered path is well-formed. The R-0057 ids (80…0001-0009) are only
// REFERENCED here, never redefined — this test guards that they don't get shadowed.

import test from "node:test";
import assert from "node:assert/strict";

import {
  PHYS_CORE_PLATEAUS, PHYS_CORE_BRIDGES, PHYS_CORE_RESOURCES, PHYS_CORE_PATH,
} from "./physics-core-curriculum.js";
import { SEED_PLATEAUS } from "./seeds.js";
import { QC_PLATEAUS } from "./curriculum.js";
import { CS_PLATEAUS } from "./cs-curriculum.js";
import { PHYS_LENS_PLATEAUS } from "./physics-lens-curriculum.js";
import { PHYSICS_DOMAIN } from "./persona.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Legal targets: this module's new plateaus, the R-0057 lens plateaus (upper
// division, threaded up into), and the seed world (Motion trailhead).
const KNOWN = new Set([...PHYS_CORE_PLATEAUS, ...PHYS_LENS_PLATEAUS, ...SEED_PLATEAUS].map((p) => p.id));

test("every id is a valid uuid and globally unique (vs seeds/QC/CS/phys-lens)", () => {
  const localIds = [
    ...PHYS_CORE_PLATEAUS.map((p) => p.id),
    ...PHYS_CORE_BRIDGES.map((b) => b.id),
    ...PHYS_CORE_RESOURCES.map((r) => r.id),
    PHYS_CORE_PATH.id,
  ];
  for (const id of localIds) assert.match(id, UUID);
  assert.equal(new Set(localIds).size, localIds.length, "no dup within the module (all id kinds)");
  const others = new Set(
    [...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS, ...PHYS_LENS_PLATEAUS].map((p) => p.id),
  );
  for (const id of localIds) assert.equal(others.has(id), false, `${id} collides with a seeded id`);
});

test("fixed-id namespaces: new plateaus 80…, bridges b…, resources c…, path d…", () => {
  for (const p of PHYS_CORE_PLATEAUS) assert.match(p.id, /^80000000-/);
  for (const b of PHYS_CORE_BRIDGES) assert.match(b.id, /^b0000000-/);
  for (const r of PHYS_CORE_RESOURCES) assert.match(r.id, /^c0000000-/);
  assert.match(PHYS_CORE_PATH.id, /^d0000000-/);
});

test("the new plateaus are all PHYSICS_DOMAIN, e2-dominant, with source-grounded bodies", () => {
  for (const p of PHYS_CORE_PLATEAUS) {
    assert.equal(p.domain, PHYSICS_DOMAIN, `${p.name} is PHYSICS_DOMAIN`);
    assert.ok(p.name && (p.description || "").length > 40, `${p.name} has a body`);
    for (const c of [p.e1, p.e2, p.e3]) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, `${p.name} coord in [0,1]`);
    assert.ok(p.e2 >= p.e1 && p.e2 >= p.e3, `${p.name} is e2-dominant (the EMPIRICAL/physics axis)`);
    assert.match(p.description, /\*\*Deliverable:\*\*/, `${p.name} states a Deliverable`);
    assert.match(p.description, /\*\*Study \(official\):\*\*/, `${p.name} cites an official source`);
  }
});

test("every bridge connects two REAL plateaus and names its concept", () => {
  for (const b of PHYS_CORE_BRIDGES) {
    assert.ok(KNOWN.has(b.from), `bridge ${b.id} from unknown ${b.from}`);
    assert.ok(KNOWN.has(b.to), `bridge ${b.id} to unknown ${b.to}`);
    assert.ok(b.concept && b.concept.length > 0, `bridge ${b.id} names its concept`);
  }
});

test("resources + path steps reference real plateaus; the path is the full 20-step degree sequence", () => {
  for (const r of PHYS_CORE_RESOURCES) assert.ok(KNOWN.has(r.plateau), `resource ${r.id} → real plateau`);
  assert.ok(PHYS_CORE_PATH.steps.length >= 20, "the physics core path is the full intro→advanced sequence");
  assert.equal(new Set(PHYS_CORE_PATH.steps).size, PHYS_CORE_PATH.steps.length, "no repeated step");
  for (const s of PHYS_CORE_PATH.steps) assert.ok(KNOWN.has(s), `path step ${s} is a real plateau`);
  assert.deepEqual(PHYS_CORE_PATH.domains, [PHYSICS_DOMAIN], "the path is tagged PHYSICS");
});
