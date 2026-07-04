// cs-curriculum.test.mjs — node --test, pure data checks (mirrors curriculum.test.mjs).
// Proves the Computation curriculum's ids are sound, its bridges/resources/path
// reference real plateaus (its own or the maths curriculum's), the trailhead
// clears the Programmer lens' fog margin, and the two seeded paths genuinely
// INTERSECT on the shared summit plateau.

import test from "node:test";
import assert from "node:assert/strict";

import { CS_PLATEAUS, CS_BRIDGES, CS_RESOURCES, CS_PATHS, C } from "./cs-curriculum.js";
import { QC_PLATEAUS, SEED_PATHS, Q } from "./curriculum.js";
import { SEED_PLATEAUS } from "./seeds.js";
import { COMPUTATION_DOMAIN, ARCHETYPES, DOMAINS } from "./persona.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("every CS id is a valid uuid and globally unique (incl. vs seeds.js + curriculum.js)", () => {
  const ids = [
    ...CS_PLATEAUS.map((p) => p.id),
    ...CS_BRIDGES.map((b) => b.id),
    ...CS_RESOURCES.map((r) => r.id),
    ...CS_PATHS.map((p) => p.id),
  ];
  for (const id of ids) assert.match(id, UUID);
  const all = new Set([
    ...ids,
    ...SEED_PLATEAUS.map((p) => p.id),
    ...QC_PLATEAUS.map((p) => p.id),
    ...SEED_PATHS.map((p) => p.id),
  ]);
  assert.equal(all.size, ids.length + SEED_PLATEAUS.length + QC_PLATEAUS.length + SEED_PATHS.length);
});

test("fixed-id namespaces: plateaus 5…, bridges 6…, resources 7…, path 4…", () => {
  for (const p of CS_PLATEAUS) assert.match(p.id, /^50000000-/);
  for (const b of CS_BRIDGES) assert.match(b.id, /^60000000-/);
  for (const r of CS_RESOURCES) assert.match(r.id, /^70000000-/);
  for (const p of CS_PATHS) assert.match(p.id, /^40000000-/);
});

test("every plateau has a name, a Markdown body, the Computation domain, and sane coords", () => {
  for (const p of CS_PLATEAUS) {
    assert.ok(p.name.length > 0);
    assert.ok(p.description.startsWith("# "), `${p.name} body starts with a heading`);
    assert.equal(p.domain, COMPUTATION_DOMAIN);
    for (const c of [p.e1, p.e2, p.e3]) assert.ok(c >= 0 && c <= 1);
    assert.ok(p.e1 > 0, `${p.name} carries a Formal component`);
  }
});

test("the C name→id index is total (a typo'd bridge endpoint would be undefined)", () => {
  assert.equal(Object.keys(C).length, CS_PLATEAUS.length);
  for (const [name, id] of Object.entries(C)) {
    assert.ok(name.length > 0);
    assert.match(id, UUID);
  }
});

test("every bridge and resource references an existing plateau (CS or maths)", () => {
  const known = new Set([...CS_PLATEAUS.map((p) => p.id), ...QC_PLATEAUS.map((p) => p.id)]);
  for (const b of CS_BRIDGES) {
    assert.ok(known.has(b.from), `bridge ${b.concept}: from exists`);
    assert.ok(known.has(b.to), `bridge ${b.concept}: to exists`);
    assert.ok(b.concept.length > 0);
  }
  for (const r of CS_RESOURCES) {
    assert.ok(known.has(r.plateau), `resource ${r.title}: anchor exists`);
    assert.match(r.uri, /^https:\/\//);
  }
});

test("the marked meet bridges are genuinely cross-domain (Computation ↔ maths)", () => {
  const csIds = new Set(CS_PLATEAUS.map((p) => p.id));
  const meets = CS_BRIDGES.filter((b) => /meet/.test(b.concept));
  assert.ok(meets.length >= 5, "at least five cross-lens meets");
  for (const b of meets) {
    const fromCS = csIds.has(b.from);
    const toCS = csIds.has(b.to);
    assert.ok(fromCS !== toCS, `${b.concept} crosses the domain boundary`);
  }
});

test("the trailhead sits on the Programmer lens' canonical direction (fog margin on step one)", () => {
  const lens = ARCHETYPES.find((a) => a.id === "programmer");
  assert.ok(lens, "The Programmer archetype exists");
  const dir = lens.orient[0].dir;
  assert.equal(lens.orient[0].domain, COMPUTATION_DOMAIN);
  // unit direction: SEED * (dir · pos) must clear mp-graph's 0.15 threshold
  const entry = CS_PLATEAUS[0];
  const proj = 0.16 * (dir.e1 * entry.e1 + dir.e2 * entry.e2 + dir.e3 * entry.e3);
  assert.ok(proj > 0.15, `entry projection ${proj} clears the fog threshold`);
  // and the domain is offered in the creator
  assert.ok(DOMAINS.some((d) => d.id === COMPUTATION_DOMAIN && d.label === "Computation"));
});

test("the CS path walks every CS plateau in order and SUMMITS on the maths path's peak", () => {
  const path = CS_PATHS[0];
  assert.equal(path.steps.length, CS_PLATEAUS.length + 1);
  assert.deepEqual(path.steps.slice(0, -1), CS_PLATEAUS.map((p) => p.id));
  const summit = path.steps.at(-1);
  assert.equal(summit, Q["GA-Equivariant AI & EML"]);
  // the intersection property: both seeded paths share that step
  assert.ok(SEED_PATHS[0].steps.includes(summit), "the maths path also walks the summit");
});
