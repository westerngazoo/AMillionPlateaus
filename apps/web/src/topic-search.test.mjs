// topic-search.test.mjs — node --test, pure (R-0072).
import test from "node:test";
import assert from "node:assert/strict";
import { searchTopics, groupByLens } from "./topic-search.js";

const TOPICS = [
  { id: "1", name: "Classical Mechanics", lens: "Physics", body: "Euler–Lagrange falls out for ANY coordinates. Derive it for one degree of freedom." },
  { id: "2", name: "Mathematical Methods", lens: "Physics", body: "**differential equations** (ODEs for one degree of freedom, PDEs for fields)." },
  { id: "3", name: "Rotors: Rotation without Matrices", lens: "Geometric Algebra", body: "A rotor rotates any object by the sandwich." },
  { id: "4", name: "Probability & Statistics", lens: "Mathematics", body: "Degrees of freedom also name a statistics idea." },
  { id: "5", name: "Melody, Motive & Phrase", lens: "Music", body: "A motive is the smallest melodic idea." },
];

test("plural query finds singular bodies (degrees → degree) with AND semantics", () => {
  const r = searchTopics("degrees of freedom", TOPICS);
  const ids = r.map((x) => x.id);
  assert.ok(ids.includes("1") && ids.includes("2") && ids.includes("4"), "all three DoF topics hit");
  assert.ok(!ids.includes("3") && !ids.includes("5"), "non-matching topics excluded");
  // the exact-phrase body hit (statistics) outranks word-scattered hits
  assert.equal(r[0].id, "4");
});

test("name hits outrank body hits; whole phrase in the title ranks highest", () => {
  const r = searchTopics("rotors", TOPICS);
  assert.equal(r[0].id, "3", "name match first");
  const both = searchTopics("classical mechanics", TOPICS);
  assert.equal(both[0].id, "1", "whole-phrase title beats everything");
  assert.ok(both[0].score > 40);
});

test("snippets carry md-stripped context around the body hit; name-only hits have none", () => {
  const r = searchTopics("degrees of freedom", TOPICS);
  const mm = r.find((x) => x.id === "2");
  assert.match(mm.snippet, /one degree of freedom/);
  assert.doesNotMatch(mm.snippet, /\*\*/, "markdown emphasis stripped");
  assert.match(mm.snippet, /^…|^[A-Za-z]/, "ellipsized or clean start");
  const nameOnly = searchTopics("rotors", TOPICS).find((x) => x.id === "3");
  assert.match(nameOnly.snippet, /rotor rotates|^$/, "body mention OR empty for pure-name hits");
});

test("groupByLens preserves rank inside groups and leads with the strongest lens", () => {
  const groups = groupByLens(searchTopics("degrees of freedom", TOPICS));
  assert.equal(groups[0][0], "Mathematics", "best hit's lens leads");
  const physics = groups.find(([lens]) => lens === "Physics")[1];
  assert.equal(physics.length, 2);
});

test("defensive: empty/short queries and junk topics return []", () => {
  assert.deepEqual(searchTopics("", TOPICS), []);
  assert.deepEqual(searchTopics("of", TOPICS), [], "sub-3-char words are noise");
  assert.deepEqual(searchTopics("rotors", null), []);
  assert.deepEqual(groupByLens(null), []);
  // cap respected
  const many = Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `Spin topic ${i}`, lens: "L", body: "" }));
  assert.equal(searchTopics("spin", many, { max: 10 }).length, 10);
});
