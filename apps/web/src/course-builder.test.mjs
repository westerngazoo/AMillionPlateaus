// course-builder.test.mjs — node --test, pure (R-0061).
import test from "node:test";
import assert from "node:assert/strict";
import { courseOutlinePrompt, parseCourseOutline, linkPrereqs } from "./course-builder.js";

test("courseOutlinePrompt names the subject, folds in a reference, and pins the format", () => {
  const p = courseOutlinePrompt({ title: "Linear Algebra", reference: "Strang, Intro to Linear Algebra" });
  assert.match(p, /"Linear Algebra"/);
  assert.match(p, /Strang/);
  assert.match(p, /:: one-sentence description/); // the parseable contract
  assert.match(p, /prereq:/);
  // no reference → no dangling "based on:"
  assert.doesNotMatch(courseOutlinePrompt({ title: "X" }), /based on:/);
});

test("parseCourseOutline reads the strict N. Name :: desc :: prereq form", () => {
  const text = [
    "1. Vectors :: arrows with magnitude and direction :: prereq: none",
    "2. Matrices :: rectangular arrays that act on vectors :: prereq: Vectors",
    "3. Eigenvalues :: directions a matrix only scales :: prereq: Matrices",
  ].join("\n");
  const steps = parseCourseOutline(text);
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.map((s) => s.name), ["Vectors", "Matrices", "Eigenvalues"]);
  assert.equal(steps[0].prereqName, null);
  assert.equal(steps[1].prereqName, "Vectors");
  assert.match(steps[2].description, /only scales/);
});

test("parseCourseOutline tolerates looser formats and skips prose/blank lines", () => {
  const text = [
    "Here is your course:", // prose preamble → skipped
    "",
    "1. Limits — the idea of approaching a value",
    "2) Derivatives: the slope of a curve",
    "- Integrals • area under a curve",
    "   ",
  ].join("\n");
  const steps = parseCourseOutline(text);
  assert.deepEqual(steps.map((s) => s.name), ["Limits", "Derivatives", "Integrals"]);
  assert.match(steps[0].description, /approaching a value/);
});

test("parseCourseOutline caps lengths, de-dups by name, and never emits a blank topic", () => {
  const steps = parseCourseOutline("1. " + "z".repeat(200) + " :: " + "d".repeat(500) + " :: prereq: none\n2. Z".repeat(1).replace("Z", "z".repeat(200)));
  assert.ok(steps[0].name.length <= 80);
  assert.ok(steps[0].description.length <= 240);
  // duplicate name collapses to one
  const dup = parseCourseOutline("1. Sets :: a\n2. Sets :: b");
  assert.equal(dup.length, 1);
  // empty input → empty course, no throw
  assert.deepEqual(parseCourseOutline(""), []);
  assert.deepEqual(parseCourseOutline(null), []);
});

test("linkPrereqs makes a connected chain: first has none, refs resolve to earlier topics", () => {
  const steps = parseCourseOutline([
    "1. A :: x :: prereq: none",
    "2. B :: x :: prereq: A",
    "3. C :: x :: prereq: A",
  ].join("\n"));
  const linked = linkPrereqs(steps);
  assert.equal(linked[0].prereqIndex, -1);
  assert.equal(linked[1].prereqIndex, 0); // B ← A
  assert.equal(linked[2].prereqIndex, 0); // C ← A (not the previous B)
});

test("linkPrereqs repairs missing/forward prereqs to the previous topic (always connected)", () => {
  const steps = [
    { name: "A", description: "", prereqName: null },
    { name: "B", description: "", prereqName: "Nonexistent" }, // unmatched → previous
    { name: "C", description: "", prereqName: "D" }, // forward ref → previous
    { name: "D", description: "", prereqName: "A" },
  ];
  const linked = linkPrereqs(steps);
  assert.deepEqual(linked.map((s) => s.prereqIndex), [-1, 0, 1, 0]);
});
