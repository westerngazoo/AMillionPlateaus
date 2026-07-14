// optics-curriculum.test.mjs — node --test, pure data checks (mirrors
// cs-curriculum.test.mjs). Proves the Optics course's ids are sound, its
// bridges/resources/path reference real plateaus (its own, the seed basics,
// or the maths curriculum's), the course is rooted in the very basics via
// genuinely cross-domain meets, the trailhead clears the Physicist lens' fog
// margin, and the seeded path starts at Geometry/Motion and summits on the
// maths path's Qubit = Spinor plateau.

import test from "node:test";
import assert from "node:assert/strict";

import { OPTICS_PLATEAUS, OPTICS_BRIDGES, OPTICS_RESOURCES, OPTICS_PATHS, O } from "./optics-curriculum.js";
import { QC_PLATEAUS, SEED_PATHS, Q } from "./curriculum.js";
import { CS_PLATEAUS, CS_PATHS } from "./cs-curriculum.js";
import { SEED_PLATEAUS, P } from "./seeds.js";
import { PHYSICS_DOMAIN, ARCHETYPES } from "./persona.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("every optics id is a valid uuid and globally unique (incl. vs seeds + both curricula)", () => {
  const ids = [
    ...OPTICS_PLATEAUS.map((p) => p.id),
    ...OPTICS_BRIDGES.map((b) => b.id),
    ...OPTICS_RESOURCES.map((r) => r.id),
    ...OPTICS_PATHS.map((p) => p.id),
  ];
  for (const id of ids) assert.match(id, UUID);
  const all = new Set([
    ...ids,
    ...SEED_PLATEAUS.map((p) => p.id),
    ...QC_PLATEAUS.map((p) => p.id),
    ...CS_PLATEAUS.map((p) => p.id),
    ...SEED_PATHS.map((p) => p.id),
    ...CS_PATHS.map((p) => p.id),
  ]);
  assert.equal(
    all.size,
    ids.length + SEED_PLATEAUS.length + QC_PLATEAUS.length + CS_PLATEAUS.length +
      SEED_PATHS.length + CS_PATHS.length,
  );
});

test("fixed-id namespaces: plateaus 8…, bridges 9…, resources a…, path 4…", () => {
  for (const p of OPTICS_PLATEAUS) assert.match(p.id, /^80000000-/);
  for (const b of OPTICS_BRIDGES) assert.match(b.id, /^90000000-/);
  for (const r of OPTICS_RESOURCES) assert.match(r.id, /^a0000000-/);
  for (const p of OPTICS_PATHS) assert.match(p.id, /^40000000-/);
});

test("every plateau has a name, a Markdown body, the Physics domain, and sane coords", () => {
  for (const p of OPTICS_PLATEAUS) {
    assert.ok(p.name.length > 0);
    assert.ok(p.description.startsWith("# "), `${p.name} body starts with a heading`);
    assert.equal(p.domain, PHYSICS_DOMAIN, `${p.name} grows the physics island (R-0022)`);
    for (const c of [p.e1, p.e2, p.e3]) assert.ok(c >= 0 && c <= 1);
    assert.ok(p.e2 > 0.5, `${p.name} is Empirical-dominant — this is physics`);
  }
});

test("the O name→id index is total (a typo'd bridge endpoint would be undefined)", () => {
  assert.equal(Object.keys(O).length, OPTICS_PLATEAUS.length);
  for (const [name, id] of Object.entries(O)) {
    assert.ok(name.length > 0);
    assert.match(id, UUID);
  }
});

test("every bridge and resource references an existing plateau (optics, seeds, or maths)", () => {
  const known = new Set([
    ...OPTICS_PLATEAUS.map((p) => p.id),
    ...SEED_PLATEAUS.map((p) => p.id),
    ...QC_PLATEAUS.map((p) => p.id),
  ]);
  for (const b of OPTICS_BRIDGES) {
    assert.ok(known.has(b.from), `bridge ${b.concept}: from exists`);
    assert.ok(known.has(b.to), `bridge ${b.concept}: to exists`);
    assert.ok(b.concept.length > 0);
  }
  for (const r of OPTICS_RESOURCES) {
    assert.ok(known.has(r.plateau), `resource ${r.title}: anchor exists`);
    assert.match(r.uri, /^https:\/\//);
  }
});

test("the marked meet bridges root the course in the very basics (genuinely cross-cluster)", () => {
  const opticsIds = new Set(OPTICS_PLATEAUS.map((p) => p.id));
  const meets = OPTICS_BRIDGES.filter((b) => /meet/.test(b.concept));
  assert.ok(meets.length >= 6, "at least six cross-cluster meets");
  for (const b of meets) {
    const fromOptics = opticsIds.has(b.from);
    const toOptics = opticsIds.has(b.to);
    assert.ok(fromOptics !== toOptics, `${b.concept} crosses the cluster boundary`);
  }
  // "from the very basics": the seed world's Geometry, Algebra, Motion, and
  // Calculus each feed the course…
  const roots = new Set(meets.map((b) => b.from));
  for (const basic of ["Geometry", "Algebra", "Motion", "Calculus"]) {
    assert.ok(roots.has(P[basic]), `${basic} roots the optics course`);
  }
  // …and the top connects to the maths curriculum: Maxwell in, the qubit out.
  assert.ok(roots.has(Q["Maxwell: ∇F = J/ε₀c"]), "Maxwell identifies light as an EM wave");
  assert.ok(meets.some((b) => b.to === Q["Qubit = Spinor"]), "the photon walks into the qubit");
});

test("the trailhead clears the Physicist lens' fog margin on step one", () => {
  const lens = ARCHETYPES.find((a) => a.id === "physicist");
  assert.ok(lens, "The Physicist archetype exists");
  const dir = lens.orient[0].dir;
  assert.equal(lens.orient[0].domain, PHYSICS_DOMAIN);
  // SEED · (dir · pos) must clear mp-graph's 0.15 reachability threshold
  const entry = OPTICS_PLATEAUS[0];
  const proj = 0.16 * (dir.e1 * entry.e1 + dir.e2 * entry.e2 + dir.e3 * entry.e3);
  assert.ok(proj > 0.15, `entry projection ${proj} clears the fog threshold`);
});

test("the path starts at the very basics, walks every optics plateau in order, and summits on the qubit", () => {
  const path = OPTICS_PATHS[0];
  assert.equal(path.steps.length, OPTICS_PLATEAUS.length + 3);
  assert.deepEqual(path.steps.slice(0, 2), [P.Geometry, P.Motion], "Geometry then Motion first");
  assert.deepEqual(path.steps.slice(2, -1), OPTICS_PLATEAUS.map((p) => p.id));
  const summit = path.steps.at(-1);
  assert.equal(summit, Q["Qubit = Spinor"]);
  // the intersection property: the maths path also walks that step, so the
  // optics and foundations journeys literally cross (as CS ∩ maths already do)
  assert.ok(SEED_PATHS[0].steps.includes(summit), "the maths path also walks the summit");
});
