// prereqs.test.mjs — node --test, pure (R-0070).
import test from "node:test";
import assert from "node:assert/strict";
import { missingPrereqs, prereqPlanPrompt } from "./prereqs.js";

const STEPS = ["a", "b", "c", "d", "e"];

test("missingPrereqs lists earlier, not-done steps in path order with 1-based numbers", () => {
  // on 'd' (index 3), done = {a, c} → missing b (n2). d itself and e (later) excluded.
  assert.deepEqual(missingPrereqs(STEPS, "d", new Set(["a", "c"])), [{ id: "b", n: 2 }]);
  // nothing done → all three earlier steps, in order
  assert.deepEqual(missingPrereqs(STEPS, "d", new Set()), [
    { id: "a", n: 1 },
    { id: "b", n: 2 },
    { id: "c", n: 3 },
  ]);
});

test("missingPrereqs is empty at the first step, off-path, or when all earlier are done", () => {
  assert.deepEqual(missingPrereqs(STEPS, "a", new Set()), [], "first step has no prereqs");
  assert.deepEqual(missingPrereqs(STEPS, "zzz", new Set()), [], "off-path topic → none");
  assert.deepEqual(missingPrereqs(STEPS, "e", new Set(["a", "b", "c", "d"])), [], "all earlier done → none");
});

test("missingPrereqs is defensive against junk (array or Set doneSet, bad steps)", () => {
  assert.deepEqual(missingPrereqs(STEPS, "c", ["a"]), [{ id: "b", n: 2 }], "array doneSet accepted");
  assert.deepEqual(missingPrereqs(null, "c", new Set()), []);
  assert.deepEqual(missingPrereqs(STEPS, "c", null), [
    { id: "a", n: 1 },
    { id: "b", n: 2 },
  ]);
});

test("prereqPlanPrompt lists the target + ordered prereqs with their pinned resources", () => {
  const p = prereqPlanPrompt({
    target: "Quadratics & Polynomials",
    pathTitle: "The Mathematics Core",
    prereqs: [
      { n: 3, name: "Ratios & Proportions", resources: [{ title: "Khan — Ratios", uri: "https://khan/r" }] },
      { n: 5, name: "Functions & Graphs", resources: [] },
    ],
  });
  assert.match(p, /"Quadratics & Polynomials"/);
  assert.match(p, /"The Mathematics Core"/);
  assert.match(p, /3\. Ratios & Proportions/);
  assert.match(p, /Khan — Ratios \(https:\/\/khan\/r\)/);
  assert.match(p, /5\. Functions & Graphs/);
  assert.match(p, /nothing pinned yet/); // the resource-less prereq gets the suggest fallback
  assert.match(p, /IN THIS ORDER/);
});

test("prereqPlanPrompt is safe with defaults / empty", () => {
  const p = prereqPlanPrompt();
  assert.match(p, /this topic/);
  assert.doesNotMatch(p, /\(in ""\)/); // no dangling empty path title
});

// ── R-0100: add your own prerequisite ────────────────────────────────────────
import { combinePrereqs, prereqCandidates } from "./prereqs.js";

test("combinePrereqs lists path prereqs first (numbered), then user prereqs", () => {
  const nameOf = (id) => ({ a: "Álgebra", g: "Geometría", o: "Óptica" }[id] || "");
  const rows = combinePrereqs({
    pathMissing: [{ id: "a", n: 2 }],
    userIds: ["g"],
    doneSet: new Set(),
    nameOf,
  });
  assert.deepEqual(rows, [
    { id: "a", n: 2, name: "Álgebra", user: false },
    { id: "g", n: null, name: "Geometría", user: true },
  ]);
});

test("combinePrereqs dedupes (path wins) and drops studied user prereqs", () => {
  const rows = combinePrereqs({
    pathMissing: [{ id: "a", n: 1 }],
    userIds: ["a", "g", "done"],       // 'a' duplicates the path step; 'done' is studied
    doneSet: new Set(["done"]),
    nameOf: (id) => id,
  });
  assert.deepEqual(rows.map((r) => [r.id, r.user]), [["a", false], ["g", true]]);
  assert.deepEqual(combinePrereqs(), []); // defensive on no args
});

test("prereqCandidates matches by name substring, diacritic-insensitive", () => {
  const topics = [
    { id: "g", name: "Geometría Analítica" },
    { id: "o", name: "Óptica" },
    { id: "c", name: "Cálculo I" },
  ];
  assert.deepEqual(prereqCandidates("optica", topics).map((t) => t.id), ["o"]);
  assert.deepEqual(prereqCandidates("geometr", topics).map((t) => t.id), ["g"]);
  assert.deepEqual(prereqCandidates("cálculo", topics).map((t) => t.id), ["c"]);
});

test("prereqCandidates excludes already-listed ids and the topic itself, ranks prefix-first", () => {
  const topics = [
    { id: "a", name: "Analytic Geometry" },
    { id: "b", name: "Pre-Geometry" },
    { id: "self", name: "Geometry Advanced" },
  ];
  // exclude 'self'; "geom" is a prefix of none here but a substring of all → all except excluded
  const got = prereqCandidates("geometry", topics, ["self"]);
  assert.equal(got.some((t) => t.id === "self"), false);
  // prefix match ranks first: query "analytic" → 'a' (prefix) before others
  assert.equal(prereqCandidates("analytic", topics)[0].id, "a");
  assert.deepEqual(prereqCandidates("", topics), []); // empty query → nothing
  assert.deepEqual(prereqCandidates("zzz", topics), []); // no match
});
