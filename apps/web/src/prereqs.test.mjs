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
