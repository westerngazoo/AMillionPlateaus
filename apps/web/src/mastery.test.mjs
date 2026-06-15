import test from "node:test";
import assert from "node:assert/strict";

import { masteredTopics, MASTERY_KIND } from "./mastery.js";

const ev = (pubkey, kind, content) => ({ pubkey, kind, content });
const mastery = (pubkey, plateau) => ev(pubkey, MASTERY_KIND, JSON.stringify({ plateau }));

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
