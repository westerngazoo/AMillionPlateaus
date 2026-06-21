import test from "node:test";
import assert from "node:assert/strict";

import {
  masteredTopics,
  visitedTopics,
  communityApproved,
  masteryCounts,
  MASTERY_KIND,
  TRAVERSAL_KIND,
  COMMUNITY_THRESHOLD,
} from "./mastery.js";

const ev = (pubkey, kind, content) => ({ pubkey, kind, content });
const mastery = (pubkey, plateau) => ev(pubkey, MASTERY_KIND, JSON.stringify({ plateau }));
const traversal = (pubkey, plateau) =>
  ev(pubkey, TRAVERSAL_KIND, JSON.stringify({ domain: "d", e1: 1, e2: 0, e3: 0, depth: 1, plateau }));

test("MASTERY_KIND is the pinned app-data kind (must match mp_identity::KIND_MASTERY)", () => {
  assert.equal(MASTERY_KIND, 30080);
});

test("masteredTopics returns only this pubkey's mastered plateau ids", () => {
  const me = "aa".repeat(32);
  const other = "bb".repeat(32);
  const events = [
    mastery(me, "calc"),
    mastery(me, "algebra"),
    mastery(other, "harmony"), // a different wizard — excluded
    ev(me, 30078, JSON.stringify({ domain: "x" })), // a traversal — excluded
  ];
  const out = masteredTopics(events, me);
  assert.deepEqual([...out].sort(), ["algebra", "calc"]);
});

test("masteredTopics dedupes a topic mastered twice", () => {
  const me = "cc".repeat(32);
  const out = masteredTopics([mastery(me, "calc"), mastery(me, "calc")], me);
  assert.equal(out.size, 1);
  assert.ok(out.has("calc"));
});

test("masteredTopics skips malformed content and empty input", () => {
  const me = "dd".repeat(32);
  assert.equal(masteredTopics([], me).size, 0);
  const events = [
    ev(me, MASTERY_KIND, "not json"),
    ev(me, MASTERY_KIND, JSON.stringify({})), // no plateau
    null,
    mastery(me, "ok"),
  ];
  const out = masteredTopics(events, me);
  assert.deepEqual([...out], ["ok"]);
});

test("masteredTopics is deterministic", () => {
  const me = "ee".repeat(32);
  const events = [mastery(me, "a"), mastery(me, "b")];
  assert.deepEqual([...masteredTopics(events, me)], [...masteredTopics(events, me)]);
});

// ── Visited / studying (R-0033) ────────────────────────────────────────────────

test("TRAVERSAL_KIND is the pinned app-data kind (must match mp_identity::KIND_TRAVERSAL)", () => {
  assert.equal(TRAVERSAL_KIND, 30078);
});

test("visitedTopics returns only this pubkey's traversed plateau ids", () => {
  const me = "11".repeat(32);
  const other = "22".repeat(32);
  const events = [
    traversal(me, "calc"),
    traversal(me, "algebra"),
    traversal(other, "harmony"), // another wizard — excluded
    mastery(me, "geometry"), // a mastery, not a traversal — excluded from visited
  ];
  assert.deepEqual([...visitedTopics(events, me)].sort(), ["algebra", "calc"]);
});

test("visitedTopics dedupes, skips null/malformed plateau, handles empty", () => {
  const me = "33".repeat(32);
  assert.equal(visitedTopics([], me).size, 0);
  const events = [
    traversal(me, "calc"),
    traversal(me, "calc"), // dup
    ev(me, TRAVERSAL_KIND, JSON.stringify({ domain: "d", depth: 1, plateau: null })), // positional-only
    ev(me, TRAVERSAL_KIND, "not json"),
  ];
  assert.deepEqual([...visitedTopics(events, me)], ["calc"]);
});

test("visitedTopics is deterministic", () => {
  const me = "44".repeat(32);
  const events = [traversal(me, "a"), traversal(me, "b")];
  assert.deepEqual([...visitedTopics(events, me)], [...visitedTopics(events, me)]);
});

// ── Community approval (R-0031) ────────────────────────────────────────────────

const key = (n) => String(n).repeat(64).slice(0, 64);

test("COMMUNITY_THRESHOLD is a sane POC count", () => {
  assert.equal(COMMUNITY_THRESHOLD, 3);
});

test("masteryCounts counts DISTINCT pubkeys per topic (twice-by-one = 1)", () => {
  const events = [
    mastery(key(1), "calc"),
    mastery(key(1), "calc"), // same wizard again — still 1
    mastery(key(2), "calc"),
    mastery(key(3), "algebra"),
  ];
  const counts = masteryCounts(events);
  assert.equal(counts.get("calc"), 2);
  assert.equal(counts.get("algebra"), 1);
});

test("communityApproved: head-count boundary with unit weights (N-1 not approved, N approved)", () => {
  const twoMasters = [mastery(key(1), "calc"), mastery(key(2), "calc")];
  assert.equal(communityApproved(twoMasters, { bar: 3 }).has("calc"), false); // N-1
  const threeMasters = [...twoMasters, mastery(key(3), "calc")];
  assert.ok(communityApproved(threeMasters, { bar: 3 }).has("calc")); // N distinct keys
});

test("communityApproved: default args reproduce R-0031 head-count (unit weight, bar=THRESHOLD)", () => {
  const threeMasters = [mastery(key(1), "calc"), mastery(key(2), "calc"), mastery(key(3), "calc")];
  assert.ok(communityApproved(threeMasters).has("calc")); // 3 × weight-1 = 3 ≥ COMMUNITY_THRESHOLD
  assert.equal(communityApproved(threeMasters.slice(0, 2)).has("calc"), false);
});

test("masteryCounts ignores non-mastery kinds, malformed, and null plateau", () => {
  const events = [
    traversal(key(1), "calc"), // a traversal, not mastery — excluded
    ev(key(2), MASTERY_KIND, "not json"), // malformed — skipped
    ev(key(3), MASTERY_KIND, JSON.stringify({})), // null/absent plateau — skipped
    mastery(key(4), "calc"), // the only valid one
  ];
  const counts = masteryCounts(events);
  assert.equal(counts.get("calc"), 1);
  assert.equal(counts.size, 1);
});

test("communityApproved: empty → ∅; deterministic", () => {
  assert.equal(communityApproved([], { bar: 3 }).size, 0);
  const events = [mastery(key(1), "calc"), mastery(key(2), "calc"), mastery(key(3), "calc")];
  assert.deepEqual([...communityApproved(events, { bar: 3 })], [...communityApproved(events, { bar: 3 })]);
});

// ── Trusted-master weighting (R-0035 / SPEC-0035) ──────────────────────────────
// Approval = summed master reach in the topic's domain ≥ bar. Reach source injected.

test("communityApproved (weighted): a Sybil ring (many masters, all reach 0) is NOT approved", () => {
  // five distinct keys all master "calc" but each has 0 earned reach (grade-collapsed)
  const ring = [1, 2, 3, 4, 5].map((n) => mastery(key(n), "calc"));
  const approved = communityApproved(ring, {
    bar: 1.5,
    domainOf: () => "math",
    weightOf: () => 0, // every master grade-collapsed → reach 0
  });
  assert.equal(approved.has("calc"), false); // head-count 5 ≫ 3, but weight 0 < bar
});

test("communityApproved (weighted): a few HIGH-reach masters DO approve", () => {
  const two = [mastery(key(1), "calc"), mastery(key(2), "calc")];
  const reach = new Map([[key(1), 0.8], [key(2), 0.9]]); // sum 1.7 ≥ 1.5
  const approved = communityApproved(two, {
    bar: 1.5,
    domainOf: () => "math",
    weightOf: (pk) => reach.get(pk) ?? 0,
  });
  assert.ok(approved.has("calc"));
});

test("communityApproved (weighted): CROSS-DOMAIN reach does not count", () => {
  // the master has reach, but only in 'music'; the topic is in 'math' → 0 weight
  const events = [mastery(key(1), "calc"), mastery(key(2), "calc")];
  const reachInMusic = new Map([[key(1), 5], [key(2), 5]]);
  const approved = communityApproved(events, {
    bar: 1.5,
    domainOf: () => "math",
    weightOf: (pk, domain) => (domain === "music" ? reachInMusic.get(pk) ?? 0 : 0),
  });
  assert.equal(approved.has("calc"), false); // huge music reach, zero math weight
});

test("communityApproved (weighted): bar boundary (just-under vs at)", () => {
  const two = [mastery(key(1), "calc"), mastery(key(2), "calc")];
  const w = () => 0.7; // sum = 1.4
  assert.equal(communityApproved(two, { bar: 1.5, weightOf: w }).has("calc"), false); // 1.4 < 1.5
  assert.ok(communityApproved(two, { bar: 1.4, weightOf: w }).has("calc")); // 1.4 ≥ 1.4
});

test("communityApproved (weighted): NaN / negative / absent weight ⇒ 0 (never adds or subtracts)", () => {
  const three = [mastery(key(1), "calc"), mastery(key(2), "calc"), mastery(key(3), "calc")];
  const weird = new Map([[key(1), NaN], [key(2), -10], [key(3), 2.0]]);
  const approved = communityApproved(three, { bar: 1.5, weightOf: (pk) => weird.get(pk) });
  assert.ok(approved.has("calc")); // only key(3)'s 2.0 counts; NaN & -10 ⇒ 0, so sum = 2.0 ≥ 1.5
  // and the negative must not have SUBTRACTED below the lone positive
  assert.equal(communityApproved(three, { bar: 2.5, weightOf: (pk) => weird.get(pk) }).has("calc"), false);
});
