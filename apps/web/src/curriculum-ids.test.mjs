// curriculum-ids.test.mjs — the GRAND-UNION id guard (R-0068 fast-follow).
//
// Each per-module test proves its own ids are unique vs the EARLIER modules'
// PLATEAU ids. This adds the cross-kind, whole-universe guarantee the architect
// asked for: across seeds + all five curricula, EVERY id of EVERY kind (plateau,
// bridge, resource, path) is globally unique, and every bridge endpoint / resource
// plateau / path step resolves to a real plateau. A future edit that (say) reuses a
// bridge id as a resource id in another module — invisible to the per-module tests
// — fails here, in CI, not just by namespace convention.

import test from "node:test";
import assert from "node:assert/strict";

import { SEED_PLATEAUS, SEED_BRIDGES, SEED_RESOURCES } from "./seeds.js";
import { QC_PLATEAUS, QC_BRIDGES, QC_RESOURCES, SEED_PATHS } from "./curriculum.js";
import { CS_PLATEAUS, CS_BRIDGES, CS_RESOURCES, CS_PATHS } from "./cs-curriculum.js";
import {
  PHYS_LENS_PLATEAUS, PHYS_LENS_BRIDGES, PHYS_LENS_RESOURCES, PHYS_LENS_PATHS,
} from "./physics-lens-curriculum.js";
import {
  PHYS_CORE_PLATEAUS, PHYS_CORE_BRIDGES, PHYS_CORE_RESOURCES, PHYS_CORE_PATH,
} from "./physics-core-curriculum.js";
import { MATH_PLATEAUS, MATH_BRIDGES, MATH_RESOURCES, MATH_PATH } from "./math-curriculum.js";
import { MUSIC_PLATEAUS, MUSIC_BRIDGES, MUSIC_RESOURCES, MUSIC_PATH } from "./music-curriculum.js";

const PLATEAUS = [
  ...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS,
  ...PHYS_LENS_PLATEAUS, ...PHYS_CORE_PLATEAUS, ...MATH_PLATEAUS, ...MUSIC_PLATEAUS,
];
const BRIDGES = [
  ...SEED_BRIDGES, ...QC_BRIDGES, ...CS_BRIDGES,
  ...PHYS_LENS_BRIDGES, ...PHYS_CORE_BRIDGES, ...MATH_BRIDGES, ...MUSIC_BRIDGES,
];
const RESOURCES = [
  ...SEED_RESOURCES, ...QC_RESOURCES, ...CS_RESOURCES,
  ...PHYS_LENS_RESOURCES, ...PHYS_CORE_RESOURCES, ...MATH_RESOURCES, ...MUSIC_RESOURCES,
];
const PATHS = [...SEED_PATHS, ...CS_PATHS, ...PHYS_LENS_PATHS, PHYS_CORE_PATH, MATH_PATH, MUSIC_PATH];

test("every id of every kind is globally unique across all seeded modules", () => {
  const ids = [...PLATEAUS, ...BRIDGES, ...RESOURCES, ...PATHS].map((x) => x.id);
  const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dups, [], "no id collides across plateaus/bridges/resources/paths");
  assert.equal(new Set(ids).size, ids.length, "id set == id count");
});

test("every bridge endpoint, resource plateau, and path step resolves to a real plateau", () => {
  const plat = new Set(PLATEAUS.map((p) => p.id));
  for (const b of BRIDGES) {
    assert.ok(plat.has(b.from), `bridge ${b.id}: unknown from ${b.from}`);
    assert.ok(plat.has(b.to), `bridge ${b.id}: unknown to ${b.to}`);
  }
  for (const r of RESOURCES) assert.ok(plat.has(r.plateau), `resource ${r.id}: unknown plateau ${r.plateau}`);
  for (const p of PATHS)
    for (const s of p.steps ?? []) assert.ok(plat.has(s), `path ${p.id}: step ${s} is not a real plateau`);
});

test("the seeded universe is the expected size (guards silent drops/dupes)", () => {
  assert.equal(PLATEAUS.length, 111, "111 seeded plateaus");
  assert.equal(new Set(PLATEAUS.map((p) => p.id)).size, PLATEAUS.length, "plateau ids unique");
  assert.equal(PATHS.length, 6, "6 seeded curriculum paths");
});
