import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLensBundle,
  parseLensBundle,
  parseLensBundleResult,
  applyLensBundle,
  lensBundlePath,
  isSafeLensPath,
  contentUuid,
  canonicalJson,
  LENS_BUNDLE_V,
} from "./lens-bundle.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// --- fixtures: a tiny two-domain graph -------------------------------------
const PHYS = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const physDomain = { id: PHYS, label: "University Physics", canonical: { e1: 0.6, e2: 0.7, e3: 0.1 } };

const A = "aaaaaaaa-0000-4000-8000-000000000001"; // in lens
const B = "aaaaaaaa-0000-4000-8000-000000000002"; // in lens
const C = "cccccccc-0000-4000-8000-000000000003"; // OTHER domain

const plateaus = [
  { id: A, name: "Law of Sines", description: "sin ratios", domain_id: PHYS, position: { e1: 0.5, e2: 0.4, e3: 0.0 } },
  { id: B, name: "Law of Cosines", description: "c^2 = ...", domain_id: PHYS, position: { e1: 0.55, e2: 0.42, e3: 0.0 } },
  { id: C, name: "Sonnet Form", description: "poetry", domain_id: OTHER, position: { e1: 0.1, e2: 0.9, e3: 0.2 } },
];
const bridges = [
  { id: "live-rand-1", from: A, to: B, concept: "generalizes to" },
  { id: "live-rand-2", from: A, to: C, concept: "cross-domain" }, // one foot outside → external
];
const resources = [
  { id: "live-r-1", plateau_id: A, title: "Khan: Law of Sines", kind: "Video", uri: "https://k/1" },
  { id: "live-r-2", plateau_id: C, title: "not in lens", kind: "Link", uri: "https://k/2" },
];

test("buildLensBundle keeps the lens's plateaus, internal bridges, and their resources", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal(b.v, LENS_BUNDLE_V);
  assert.equal(b.domain.id, PHYS);
  assert.deepEqual(b.plateaus.map((p) => p.name).sort(), ["Law of Cosines", "Law of Sines"]);
  assert.equal(b.bridges.length, 1);
  assert.equal(b.resources.length, 1);
  assert.equal(b.resources[0].plateau_id, A);
  assert.deepEqual(b.counts, { plateaus: 2, bridges: 1, external_bridges: 1, resources: 1 });
});

// A cross-lens edge is the meet between two ways of seeing — the most valuable
// thing in this model. It cannot be SEEDED (the far endpoint is absent) but must
// survive in the FILE, or it is destroyed for every adopter permanently.
test("cross-lens bridges are preserved as external_bridges, not dropped", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal(b.external_bridges.length, 1);
  assert.equal(b.external_bridges[0].from, A);
  assert.equal(b.external_bridges[0].to, C);
  assert.equal(b.external_bridges[0].concept, "cross-domain");
  // and they survive a round-trip through parse
  assert.equal(parseLensBundle(canonicalJson(b)).external_bridges.length, 1);
  // a bridge with NEITHER foot in the lens is genuinely irrelevant
  const none = buildLensBundle(physDomain, plateaus, [{ id: "x", from: C, to: C, concept: "n/a" }], []);
  assert.equal(none.external_bridges.length, 0);
});

test("buildLensBundle is deterministic — same content, any input order, identical JSON", () => {
  const b1 = buildLensBundle(physDomain, plateaus, bridges, resources);
  const b2 = buildLensBundle(
    physDomain,
    [plateaus[2], plateaus[1], plateaus[0]],
    [bridges[1], bridges[0]],
    [resources[1], resources[0]],
  );
  assert.equal(canonicalJson(b1), canonicalJson(b2));
});

// GOLDEN VECTOR. These ids are the join key a registry and a query layer index on;
// re-minting them silently breaks idempotency for everyone who already adopted.
// If this test fails, the id scheme changed — that is a breaking change, not a fix.
test("contentUuid golden vector — the id scheme is frozen", () => {
  assert.equal(contentUuid("mp:bridge:1", "a", "b", "c"), "1a4dc5e1-8018-5d6a-bb5c-a0ad7bc4ae91");
  assert.equal(contentUuid("mp:resource:1", "a", "b", "c"), "384dc7a2-9f58-5dfb-a153-03685ec99c41");
  assert.equal(contentUuid("mp:bridge:1", ""), "1864c465-d07e-5d79-8e3a-55548794df59");
});

// Bridges and resources used to share one id space, where {from:A,to:B,concept:""}
// and {plateau:A,uri:B,title:""} collided exactly.
test("bridge and resource id spaces are namespaced and cannot collide", () => {
  assert.notEqual(contentUuid("mp:bridge:1", A, B, ""), contentUuid("mp:resource:1", A, B, ""));
  const bb = buildLensBundle(physDomain, plateaus, [{ id: "x", from: A, to: B, concept: "" }], []);
  const rr = buildLensBundle(physDomain, plateaus, [], [{ id: "y", plateau_id: A, uri: B, title: "" }]);
  assert.notEqual(bb.bridges[0].id, rr.resources[0].id);
});

test("every synthesized id is a valid UUID (the seed API parses ids as Uuid)", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  for (const x of [...b.bridges, ...b.external_bridges, ...b.resources])
    assert.match(x.id, UUID_RE, `${x.id} is not a UUID`);
  assert.equal(b.bridges[0].id[14], "5");
  assert.ok(["8", "9", "a", "b"].includes(b.bridges[0].id[19]));
});

test("ids are content-addressed — churn in the live random id does not change them", () => {
  const b = buildLensBundle(physDomain, plateaus, bridges, resources);
  const churned = buildLensBundle(physDomain, plateaus, [{ id: "brand-new", from: A, to: B, concept: "generalizes to" }], []);
  assert.equal(churned.bridges[0].id, b.bridges[0].id);
  // distinct content → distinct ids
  const two = buildLensBundle(physDomain, plateaus, [
    { id: "x", from: A, to: B, concept: "alpha" },
    { id: "y", from: B, to: A, concept: "beta" },
  ], []);
  assert.equal(new Set(two.bridges.map((x) => x.id)).size, 2);
});

test("buildLensBundle folds duplicate bridges and requires domain.id", () => {
  const dupes = [{ id: "x1", from: A, to: B, concept: "same" }, { id: "x2", from: A, to: B, concept: "same" }];
  assert.equal(buildLensBundle(physDomain, plateaus, dupes, []).bridges.length, 1);
  assert.throws(() => buildLensBundle({ label: "no id" }, plateaus, [], []), /domain\.id is required/);
});

test("optional provenance appears only when supplied", () => {
  const anon = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal("title" in anon, false);
  assert.equal("author" in anon, false);
  const rich = buildLensBundle(physDomain, plateaus, bridges, resources, { title: "T", author: "npub1", note: "n" });
  assert.deepEqual([rich.title, rich.author, rich.note], ["T", "npub1", "n"]);
});

test("lensBundlePath sanitizes; isSafeLensPath rejects traversal", () => {
  assert.equal(lensBundlePath(PHYS), `lenses/${PHYS}.json`);
  assert.equal(lensBundlePath("../../etc/passwd"), "lenses/....etcpasswd.json");
  assert.equal(lensBundlePath(null), "lenses/lens.json");
  assert.ok(isSafeLensPath("lenses/a.json"));
  assert.equal(isSafeLensPath("lenses/../../secrets"), false);
  assert.equal(isSafeLensPath("other/a.json"), false);
  assert.equal(isSafeLensPath("lenses\\a.json"), false);
  assert.equal(isSafeLensPath(null), false);
});

// build and parse must agree byte-for-byte, or anything that re-emits a bundle
// (a registry cache, a digest, a signature) gets a different result than the file.
test("parse(build(x)) round-trips to identical canonical bytes", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources, { title: "T", author: "npub1" });
  assert.equal(canonicalJson(parseLensBundle(canonicalJson(built))), canonicalJson(built));
  const anon = buildLensBundle(physDomain, plateaus, bridges, resources);
  assert.equal(canonicalJson(parseLensBundle(canonicalJson(anon))), canonicalJson(anon));
});

// applyLensBundle mutates a live CRDT row by row and cannot roll back, so anything
// that would throw mid-loop has to be rejected while rejecting is still free.
test("parseLensBundle rejects anything that could throw mid-seed", () => {
  assert.equal(parseLensBundle("not json"), null);
  assert.equal(parseLensBundle("{}"), null);
  assert.equal(parseLensBundle(JSON.stringify({ domain: { id: PHYS } })), null); // no plateaus[]
  assert.equal(parseLensBundle(JSON.stringify({ domain: { id: "not-a-uuid" }, plateaus: [] })), null);
  // a non-UUID plateau id is dropped, not passed to the seed API
  const bad = parseLensBundle(JSON.stringify({
    domain: { id: PHYS, label: "x" },
    plateaus: [{ id: "verify-p-1", name: "bad" }, { id: A, name: "good" }],
  }));
  assert.deepEqual(bad.plateaus.map((p) => p.id), [A]);
  // an edge pointing at a plateau this bundle never defines is dropped
  const dangling = parseLensBundle(JSON.stringify({
    domain: { id: PHYS, label: "x" },
    plateaus: [{ id: A, name: "good" }],
    bridges: [{ id: contentUuid("mp:bridge:1", A, B, ""), from: A, to: B, concept: "" }],
    resources: [{ id: contentUuid("mp:resource:1", B, "", ""), plateau_id: B, title: "orphan" }],
  }));
  assert.equal(dangling.bridges.length, 0);
  assert.equal(dangling.resources.length, 0);
});

test("parseLensBundle accepts the raw graph plateau shape (position:{e1,e2,e3})", () => {
  const b = parseLensBundle(JSON.stringify({
    domain: { id: PHYS, label: "x" },
    plateaus: [{ id: A, name: "raw", position: { e1: 0.5, e2: 0.4, e3: 0.3 } }],
  }));
  assert.deepEqual([b.plateaus[0].e1, b.plateaus[0].e2, b.plateaus[0].e3], [0.5, 0.4, 0.3]);
});

// Without a version gate, v1 readers half-read a future v2 file and silently drop
// whatever v2 added — which would make a breaking v2 unshippable.
test("a future schema version is refused, and distinguishable from corruption", () => {
  const future = JSON.stringify({ v: LENS_BUNDLE_V + 1, domain: { id: PHYS, label: "x" }, plateaus: [] });
  assert.equal(parseLensBundle(future), null);
  assert.deepEqual(parseLensBundleResult(future), { error: "too-new", v: LENS_BUNDLE_V + 1 });
  assert.deepEqual(parseLensBundleResult("garbage"), { error: "invalid" });
  assert.ok(parseLensBundleResult(canonicalJson(buildLensBundle(physDomain, plateaus, [], []))).bundle);
});

test("applyLensBundle seeds plateaus before edges, domain last, and counts what it seeded", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  const calls = [];
  const n = applyLensBundle(canonicalJson(built), {
    onDomain: (d) => calls.push(["domain", d.id]),
    plateau: (id) => calls.push(["plateau", id]),
    bridge: (id) => calls.push(["bridge", id]),
    resource: (id) => calls.push(["resource", id]),
  });
  assert.deepEqual(n, { plateaus: 2, bridges: 1, resources: 1 });
  const kinds = calls.map((c) => c[0]);
  assert.ok(kinds.lastIndexOf("plateau") < kinds.indexOf("bridge"));
  assert.ok(kinds.lastIndexOf("plateau") < kinds.indexOf("resource"));
  assert.equal(kinds[kinds.length - 1], "domain");
  // external bridges are carried in the file but never seeded
  assert.equal(kinds.filter((k) => k === "bridge").length, 1);
});

// seed_* is a last-writer-wins UPSERT, and the built-in lenses use fixed plateau
// ids that every install shares — so without this, adopting "Mathematics" would
// overwrite the reader's own copy of Arithmetic. R-0093 AC5 promises it does not.
test("adopting never overwrites what the reader already has", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  const seeded = [];
  const n = applyLensBundle(built, {
    has: (kind, id) => kind === "plateau" && id === A, // reader already holds A
    plateau: (id) => seeded.push(id),
    bridge: () => seeded.push("bridge"),
    resource: () => seeded.push("resource"),
  });
  assert.equal(seeded.includes(A), false, "an existing plateau must not be re-seeded");
  assert.equal(n.plateaus, 1, "only the genuinely new plateau counts");
  // a reader who already has everything gets a pure no-op
  const all = applyLensBundle(built, { has: () => true, plateau: () => assert.fail("wrote"), bridge: () => assert.fail("wrote"), resource: () => assert.fail("wrote") });
  assert.deepEqual(all, { plateaus: 0, bridges: 0, resources: 0 });
});

test("applyLensBundle is idempotent and throws on junk", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  const a = [];
  const rec = { plateau: (id) => a.push(id), bridge: (id) => a.push(id), resource: (id) => a.push(id) };
  applyLensBundle(built, rec);
  const first = [...a];
  a.length = 0;
  applyLensBundle(built, rec);
  assert.deepEqual(a, first, "a second apply replays an identical op set");
  assert.throws(() => applyLensBundle("garbage", {}), /not a valid lens bundle/);
});

test("a seed failure registers no domain — no orphan lens is left behind", () => {
  const built = buildLensBundle(physDomain, plateaus, bridges, resources);
  let registered = false;
  assert.throws(
    () => applyLensBundle(built, {
      onDomain: () => { registered = true; },
      plateau: () => { throw new Error("boom"); },
    }),
    /boom/,
  );
  assert.equal(registered, false);
});
