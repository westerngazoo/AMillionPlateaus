import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLensBundle,
  parseLensBundle,
  applyLensBundle,
  lensBundlePath,
  LENS_BUNDLE_V,
} from "./lens-bundle.js";

// --- fixtures: a tiny two-domain graph -------------------------------------
const PHYS = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const physDomain = { id: PHYS, label: "University Physics", canonical: { e1: 0.6, e2: 0.7, e3: 0.1 } };

const A = "aaaaaaaa-0000-0000-0000-000000000001"; // in lens
const B = "aaaaaaaa-0000-0000-0000-000000000002"; // in lens
const C = "cccccccc-0000-0000-0000-000000000003"; // OTHER domain

const plateaus = [
  { id: A, name: "Law of Sines", description: "sin ratios", domain_id: PHYS, position: { e1: 0.5, e2: 0.4, e3: 0.0 } },
  { id: B, name: "Law of Cosines", description: "c^2 = ...", domain_id: PHYS, position: { e1: 0.55, e2: 0.42, e3: 0.0 } },
  { id: C, name: "Sonnet Form", description: "poetry", domain_id: OTHER, position: { e1: 0.1, e2: 0.9, e3: 0.2 } },
];
const bridges = [
  { id: "live-rand-1", from: A, to: B, concept: "generalizes to" },
  { id: "live-rand-2", from: A, to: C, concept: "cross-domain" }, // dangles out of lens → dropped
];
const resources = [
  { id: "live-r-1", plateau_id: A, title: "Khan: Law of Sines", kind: "Video", uri: "https://k/1" },
  { id: "live-r-2", plateau_id: C, title: "not in lens", kind: "Link", uri: "https://k/2" },
];

test("buildLensBundle keeps only the lens's plateaus, internal bridges, and their resources", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal(b.v, LENS_BUNDLE_V);
  assert.equal(b.domain.id, PHYS);
  assert.equal(b.domain.label, "University Physics");
  assert.deepEqual(b.plateaus.map((p) => p.name).sort(), ["Law of Cosines", "Law of Sines"]);
  // the A→C bridge dangles outside the lens and must be excluded
  assert.equal(b.bridges.length, 1);
  assert.equal(b.bridges[0].from, A);
  assert.equal(b.bridges[0].to, B);
  // only the resource on an in-lens plateau survives
  assert.equal(b.resources.length, 1);
  assert.equal(b.resources[0].plateau_id, A);
  assert.deepEqual(b.counts, { plateaus: 2, bridges: 1, resources: 1 });
});

test("buildLensBundle is deterministic — same content → byte-identical JSON, order-independent", () => {
  const b1 = buildLensBundle(physDomain, plateaus, bridges, resources);
  // shuffle input order; synthesized ids + sort should erase the difference
  const b2 = buildLensBundle(
    physDomain,
    [plateaus[2], plateaus[1], plateaus[0]],
    [bridges[1], bridges[0]],
    [resources[1], resources[0]],
  );
  assert.equal(JSON.stringify(b1), JSON.stringify(b2));
});

test("bridge/resource ids are synthesized from content, not carried from the live random id", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.notEqual(b.bridges[0].id, "live-rand-1");
  assert.notEqual(b.resources[0].id, "live-r-1");
  // re-creating the "same" bridge with a different live id yields the SAME bundle id
  const churned = buildLensBundle(physDomain, plateaus, [{ id: "brand-new-uuid", from: A, to: B, concept: "generalizes to" }], []);
  assert.equal(churned.bridges[0].id, b.bridges[0].id);
});

// Regression: the Rust seed_plateau/seed_bridge/seed_resource each parse EVERY id
// with Uuid::parse_str, so a non-UUID synthesized id throws "invalid character"
// at adopt time. Every id a bundle carries must be UUID-shaped.
test("every synthesized id is a valid UUID (the seed API parses ids as Uuid)", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  for (const br of b.bridges) assert.match(br.id, UUID_RE, `bridge id ${br.id} is not a UUID`);
  for (const r of b.resources) assert.match(r.id, UUID_RE, `resource id ${r.id} is not a UUID`);
  // version 5 + RFC-4122 variant nibbles are stamped
  assert.equal(b.bridges[0].id[14], "5");
  assert.ok(["8", "9", "a", "b"].includes(b.bridges[0].id[19]));
  // distinct content → distinct ids (no accidental folding of different edges)
  const two = buildLensBundle(physDomain, plateaus, [
    { id: "x", from: A, to: B, concept: "alpha" },
    { id: "y", from: B, to: A, concept: "beta" },
  ], []);
  assert.equal(new Set(two.bridges.map((x) => x.id)).size, 2);
});

test("buildLensBundle folds exact-duplicate bridges and requires domain.id", () => {
  const dupes = [
    { id: "x1", from: A, to: B, concept: "same" },
    { id: "x2", from: A, to: B, concept: "same" },
  ];
  const b = buildLensBundle(physDomain, plateaus, dupes, []);
  assert.equal(b.bridges.length, 1);
  assert.throws(() => buildLensBundle({ label: "no id" }, plateaus, [], []), /domain\.id is required/);
});

test("optional provenance only appears when supplied", () => {
  const anon = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal("title" in anon, false);
  assert.equal("author" in anon, false);
  const rich = buildLensBundle(physDomain, plateaus, bridges, resources, {
    title: "My Physics Degree",
    author: "npub1...",
    note: "everything I learned",
  });
  assert.equal(rich.title, "My Physics Degree");
  assert.equal(rich.author, "npub1...");
  assert.equal(rich.note, "everything I learned");
});

test("lensBundlePath sanitizes and lands under lenses/", () => {
  assert.equal(lensBundlePath(PHYS), `lenses/${PHYS}.json`);
  assert.equal(lensBundlePath("../../etc/passwd"), "lenses/....etcpasswd.json");
  assert.equal(lensBundlePath(""), "lenses/lens.json");
  assert.equal(lensBundlePath(null), "lenses/lens.json");
});

test("parseLensBundle round-trips a built bundle and rejects malformed input", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  const parsed = parseLensBundle(JSON.stringify(built));
  assert.equal(parsed.domain.id, PHYS);
  assert.equal(parsed.plateaus.length, 2);
  assert.equal(parseLensBundle("not json"), null);
  assert.equal(parseLensBundle("{}"), null); // no domain
  assert.equal(parseLensBundle(JSON.stringify({ domain: { id: "x" } })), null); // no plateaus[]
  // tolerant of missing optional arrays
  const minimal = parseLensBundle(JSON.stringify({ domain: { id: "x" }, plateaus: [] }));
  assert.deepEqual(minimal.bridges, []);
  assert.deepEqual(minimal.resources, []);
});

test("applyLensBundle seeds domain→plateaus→bridges→resources in order, and is idempotent", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  const calls = [];
  const seeders = {
    onDomain: (d) => calls.push(["domain", d.id]),
    plateau: (id) => calls.push(["plateau", id]),
    bridge: (id) => calls.push(["bridge", id]),
    resource: (id) => calls.push(["resource", id]),
  };
  const n1 = applyLensBundle(JSON.stringify(built), seeders);
  assert.deepEqual(n1, { plateaus: 2, bridges: 1, resources: 1 });
  // every plateau seeds before any bridge/resource (endpoints must already exist)
  const kinds = calls.map((c) => c[0]);
  const lastPlateau = kinds.lastIndexOf("plateau");
  assert.ok(lastPlateau < kinds.indexOf("bridge"), "all plateaus seeded before bridges");
  assert.ok(lastPlateau < kinds.indexOf("resource"), "all plateaus seeded before resources");
  // the domain registers LAST — see the orphan-lens test below
  assert.equal(kinds[kinds.length - 1], "domain");

  // idempotent: a second apply issues the SAME id set (seed_* dedupe by id downstream)
  const before = calls.length;
  applyLensBundle(JSON.stringify(built), seeders);
  const secondPass = calls.slice(before);
  assert.deepEqual(secondPass, calls.slice(0, before), "second apply replays identical ops");
});

test("applyLensBundle throws on junk", () => {
  assert.throws(() => applyLensBundle("garbage", {}), /not a valid lens bundle/);
});

// A failed adopt must not leave an empty lens stranded in the reader's picker:
// the domain is only registered once the content actually seeded.
test("a seed failure registers no domain — no orphan lens is left behind", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  let domainRegistered = false;
  assert.throws(
    () =>
      applyLensBundle(built, {
        onDomain: () => { domainRegistered = true; },
        plateau: () => { throw new Error("invalid character: found `v` at 0"); },
      }),
    /invalid character/,
  );
  assert.equal(domainRegistered, false, "domain must not be registered when seeding throws");
});
