import test from "node:test";
import assert from "node:assert/strict";

import { masteredTopics, visitedTopics, MASTERY_KIND, TRAVERSAL_KIND } from "./mastery.js";

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
