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

test("communityApproved: threshold boundary (N-1 not approved, N approved)", () => {
  const twoMasters = [mastery(key(1), "calc"), mastery(key(2), "calc")];
  assert.equal(communityApproved(twoMasters, 3).has("calc"), false); // N-1
  const threeMasters = [...twoMasters, mastery(key(3), "calc")];
  assert.ok(communityApproved(threeMasters, 3).has("calc")); // N (incl. distinct keys)
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
  assert.equal(communityApproved([], 3).size, 0);
  const events = [mastery(key(1), "calc"), mastery(key(2), "calc"), mastery(key(3), "calc")];
  assert.deepEqual([...communityApproved(events, 3)], [...communityApproved(events, 3)]);
});
