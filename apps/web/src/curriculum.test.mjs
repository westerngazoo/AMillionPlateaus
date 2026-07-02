// curriculum.test.mjs — node --test, no wasm. Mechanical integrity of the QC
// curriculum region (curriculum.js): fixed-id namespaces stay disjoint and
// unique, every bridge/resource reference resolves, both trailheads sit on
// their lens' canonical direction, and the two-logic fork actually crosses
// domains (the "meet" bridges). Pure data checks — the seeding contract itself
// (idempotent, convergent) is proven in mp-wasm's tests.

import test from "node:test";
import assert from "node:assert/strict";

import { QC_PLATEAUS, QC_BRIDGES, QC_RESOURCES, Q } from "./curriculum.js";
import { CLASSICAL_DOMAIN, INTUITIONISTIC_DOMAIN, DOMAINS } from "./persona.js";
import { SEED_PLATEAUS, SEED_BRIDGES, SEED_RESOURCES } from "./seeds.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("every curriculum id is a valid uuid and globally unique (incl. vs seeds.js)", () => {
  const ids = [
    ...QC_PLATEAUS.map((p) => p.id),
    ...QC_BRIDGES.map((b) => b.id),
    ...QC_RESOURCES.map((r) => r.id),
    ...SEED_PLATEAUS.map((p) => p.id),
    ...SEED_BRIDGES.map((b) => b.id),
    ...SEED_RESOURCES.map((r) => r.id),
  ];
  for (const id of ids) assert.match(id, UUID_RE);
  assert.equal(new Set(ids).size, ids.length, "no id collisions anywhere in the seed world");
});

test("fixed-id namespaces: plateaus 1…, bridges 2…, resources 3…", () => {
  for (const p of QC_PLATEAUS) assert.ok(p.id.startsWith("1"), `plateau ${p.name}`);
  for (const b of QC_BRIDGES) assert.ok(b.id.startsWith("2"), `bridge ${b.concept}`);
  for (const r of QC_RESOURCES) assert.ok(r.id.startsWith("3"), `resource ${r.title}`);
});

test("every plateau has a name, a Markdown body, a known domain, and sane coords", () => {
  for (const p of QC_PLATEAUS) {
    assert.ok(p.name.length > 0);
    assert.ok(p.description.length > 0, `${p.name} ships content, not a bare node`);
    assert.ok(
      p.domain === CLASSICAL_DOMAIN || p.domain === INTUITIONISTIC_DOMAIN,
      `${p.name} belongs to the two-logic fork`,
    );
    for (const k of ["e1", "e2", "e3"]) {
      assert.ok(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1, `${p.name}.${k} in [0,1]`);
    }
  }
});

test("the Q name→id index is total (a typo'd bridge endpoint would be undefined)", () => {
  assert.equal(Object.keys(Q).length, QC_PLATEAUS.length, "names are unique");
  for (const b of QC_BRIDGES) {
    assert.ok(b.from && b.to, `bridge "${b.concept}" endpoints resolve`);
  }
});

test("every bridge and resource references an existing curriculum plateau", () => {
  const ids = new Set(QC_PLATEAUS.map((p) => p.id));
  for (const b of QC_BRIDGES) {
    assert.ok(ids.has(b.from), `bridge "${b.concept}" from`);
    assert.ok(ids.has(b.to), `bridge "${b.concept}" to`);
    assert.ok(b.concept.length > 0);
  }
  for (const r of QC_RESOURCES) {
    assert.ok(ids.has(r.plateau), `resource "${r.title}"`);
    assert.match(r.uri, /^https:\/\//, "public https resources only");
  }
});

test("the fork crosses domains: the marked meet bridges are genuinely cross-domain", () => {
  const domainOf = new Map(QC_PLATEAUS.map((p) => [p.id, p.domain]));
  const meets = QC_BRIDGES.filter((b) => /meet/.test(b.concept));
  assert.ok(meets.length >= 3, "the narrated meet bridges exist");
  for (const b of meets) {
    assert.notEqual(
      domainOf.get(b.from),
      domainOf.get(b.to),
      `"${b.concept}" spans Classical ↔ Intuitionistic`,
    );
  }
});

test("both trailheads sit on their lens' canonical direction (fog margin on step one)", () => {
  const canon = new Map(DOMAINS.map((d) => [d.id, d.canonical]));
  for (const name of ["Classical Predicate Logic", "Intuitionistic Logic"]) {
    const p = QC_PLATEAUS.find((x) => x.name === name);
    const c = canon.get(p.domain);
    assert.deepEqual(
      { e1: p.e1, e2: p.e2, e3: p.e3 },
      c,
      `${name} is exactly on its domain's canonical axis`,
    );
  }
});
