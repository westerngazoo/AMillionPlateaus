// music-curriculum.test.mjs — node --test, pure data checks (R-0068). Proves the
// music module's ids are valid + globally unique (vs seeds/QC/CS/phys-lens/
// phys-core/math), every bridge/resource/path references a REAL plateau (its own
// or the seed Rhythm trailhead it threads into), coords are finite Grade-1 and
// e3-dominant (the CREATIVE/music axis), bodies are source-grounded, and the
// numbered path is well-formed.

import test from "node:test";
import assert from "node:assert/strict";

import { MUSIC_PLATEAUS, MUSIC_BRIDGES, MUSIC_RESOURCES, MUSIC_PATH } from "./music-curriculum.js";
import { SEED_PLATEAUS } from "./seeds.js";
import { QC_PLATEAUS } from "./curriculum.js";
import { CS_PLATEAUS } from "./cs-curriculum.js";
import { PHYS_LENS_PLATEAUS } from "./physics-lens-curriculum.js";
import { PHYS_CORE_PLATEAUS } from "./physics-core-curriculum.js";
import { MATH_PLATEAUS } from "./math-curriculum.js";
import { MUSIC_DOMAIN } from "./persona.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every plateau id a bridge/resource/path may legally point at: this module + seeds.
const KNOWN = new Set([...MUSIC_PLATEAUS, ...SEED_PLATEAUS].map((p) => p.id));

test("every id is a valid uuid and globally unique (vs seeds/QC/CS/phys-lens/phys-core/math)", () => {
  const localIds = [
    ...MUSIC_PLATEAUS.map((p) => p.id),
    ...MUSIC_BRIDGES.map((b) => b.id),
    ...MUSIC_RESOURCES.map((r) => r.id),
    MUSIC_PATH.id,
  ];
  for (const id of localIds) assert.match(id, UUID);
  assert.equal(new Set(localIds).size, localIds.length, "no dup within the module (all id kinds)");
  const others = new Set(
    [...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS, ...PHYS_LENS_PLATEAUS, ...PHYS_CORE_PLATEAUS, ...MATH_PLATEAUS].map(
      (p) => p.id,
    ),
  );
  for (const id of localIds) assert.equal(others.has(id), false, `${id} collides with a seeded id`);
});

test("fixed-id namespaces: plateaus f0…, bridges f1…, resources f2…, path f3…", () => {
  for (const p of MUSIC_PLATEAUS) assert.match(p.id, /^f0000000-/);
  for (const b of MUSIC_BRIDGES) assert.match(b.id, /^f1000000-/);
  for (const r of MUSIC_RESOURCES) assert.match(r.id, /^f2000000-/);
  assert.match(MUSIC_PATH.id, /^f3000000-/);
});

test("every plateau is MUSIC_DOMAIN with a body and finite e3-dominant coords", () => {
  for (const p of MUSIC_PLATEAUS) {
    assert.equal(p.domain, MUSIC_DOMAIN, `${p.name} is MUSIC_DOMAIN`);
    assert.ok(p.name && (p.description || "").length > 40, `${p.name} has a body`);
    for (const c of [p.e1, p.e2, p.e3]) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, `${p.name} coord in [0,1]`);
    assert.ok(p.e3 >= p.e1 && p.e3 >= p.e2, `${p.name} is e3-dominant (the CREATIVE/music axis)`);
  }
});

test("every body is source-grounded: a Deliverable and an official Study pointer", () => {
  for (const p of MUSIC_PLATEAUS) {
    assert.match(p.description, /\*\*Deliverable:\*\*/, `${p.name} states a Deliverable`);
    assert.match(p.description, /\*\*Study \(official\):\*\*/, `${p.name} cites an official source`);
  }
});

test("every bridge connects two REAL plateaus and names its concept", () => {
  for (const b of MUSIC_BRIDGES) {
    assert.ok(KNOWN.has(b.from), `bridge ${b.id} from unknown ${b.from}`);
    assert.ok(KNOWN.has(b.to), `bridge ${b.id} to unknown ${b.to}`);
    assert.ok(b.concept && b.concept.length > 0, `bridge ${b.id} names its concept`);
  }
});

test("resources + path steps reference real plateaus; the path is numbered & connected", () => {
  for (const r of MUSIC_RESOURCES) assert.ok(KNOWN.has(r.plateau), `resource ${r.id} → real plateau`);
  assert.ok(MUSIC_PATH.steps.length >= 10, "the music path is a real curriculum (≥10 steps)");
  assert.equal(new Set(MUSIC_PATH.steps).size, MUSIC_PATH.steps.length, "no repeated step");
  for (const s of MUSIC_PATH.steps) assert.ok(KNOWN.has(s), `path step ${s} is a real plateau`);
  assert.deepEqual(MUSIC_PATH.domains, [MUSIC_DOMAIN], "the path is tagged MUSIC");
});
