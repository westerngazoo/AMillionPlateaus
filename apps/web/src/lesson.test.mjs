// lesson.test.mjs — node --test, pure (R-0060).
import test from "node:test";
import assert from "node:assert/strict";
import {
  LESSON_STEPS,
  lessonStepPrompt,
  analogyPrompt,
  examplePrompt,
  pretestQuestions,
  clampStep,
} from "./lesson.js";

test("the lesson is an ordered Feynman arc, pretest → recall", () => {
  const keys = LESSON_STEPS.map((s) => s.key);
  assert.deepEqual(keys, ["pretest", "summary", "ground", "analogy", "example", "check", "teach", "recall"]);
  for (const s of LESSON_STEPS) {
    assert.ok(s.title && s.coach && s.kind, `${s.key} has title/coach/kind`);
  }
  assert.equal(LESSON_STEPS[0].kind, "pretest"); // R-0080: try before you learn
  assert.equal(LESSON_STEPS[1].kind, "read"); // then summary is a read step
  assert.equal(LESSON_STEPS.at(-1).kind, "master"); // recall ends at mastery
});

test("pretestQuestions (R-0080): prior-knowledge always; deliverable + neighbours when present", () => {
  // bare topic → just the prior-knowledge guess
  const bare = pretestQuestions({ name: "Rotors" });
  assert.equal(bare.length, 1);
  assert.match(bare[0], /"Rotors"/);
  assert.match(bare[0], /from memory/i);

  // with a deliverable + neighbours → three questions, none revealing an answer
  const full = pretestQuestions({
    name: "The Geometric Product",
    deliverable: "show a∧b = ½(ab − ba)",
    neighbors: [{ name: "Vectors" }, { name: "Rotors" }, { name: "Bivectors" }],
  });
  assert.equal(full.length, 3);
  assert.match(full[1], /½\(ab − ba\)/); // attempts the goal itself
  assert.match(full[2], /"Vectors"/);
  assert.match(full[2], /"Rotors"/);
  assert.ok(!full[2].includes("Bivectors"), "caps neighbour mentions at two");
  // accepts plain-string neighbours too, and is safe with no args
  assert.match(pretestQuestions({ name: "X", neighbors: ["Y"] })[1], /"Y"/);
  assert.doesNotThrow(() => pretestQuestions());
  assert.equal(pretestQuestions().length, 1);
});

test("analogy + example prompts ground in the topic, notes, and name their limits/insight", () => {
  const a = analogyPrompt({ name: "Rotors", domainLabel: "Geometric Algebra", notes: "R = e^{-Bθ/2}." });
  assert.match(a, /"Rotors"/);
  assert.match(a, /Geometric Algebra/);
  assert.match(a, /breaks down/i); // every analogy's limit
  assert.match(a, /R = e/); // grounded in notes

  const e = examplePrompt({ name: "Rotors" });
  assert.match(e, /"Rotors"/);
  assert.match(e, /step by step/i);
  assert.match(e, /insight/i);
});

test("EVERY generated step is self-contained: names the topic + carries its notes", () => {
  const ctx = { name: "Spin", domainLabel: "Physics", notes: "Pauli matrices, spin-½.", neighbors: [{ name: "QM" }] };
  for (const key of ["analogy", "example", "check", "teach", "recall"]) {
    const p = lessonStepPrompt(key, ctx);
    assert.equal(typeof p, "string");
    assert.ok(p.length > 20, `${key} builds a prompt`);
    // works pasted into a BLANK chat tab — the topic + notes travel with it
    assert.match(p, /Spin/, `${key} names the topic`);
    assert.match(p, /Pauli matrices/, `${key} carries the notes`);
  }
  // read/ground steps have no generated prompt
  assert.equal(lessonStepPrompt("summary", ctx), "");
  assert.equal(lessonStepPrompt("ground", ctx), "");
});

test("teach step is the Feynman prompt; check pulls the deep quiz", () => {
  assert.match(lessonStepPrompt("teach", { name: "Entropy" }), /Entropy/);
  const check = lessonStepPrompt("check", { neighbors: [{ name: "Temperature" }] });
  assert.ok(check.length > 20);
});

test("prompts are pure/deterministic and safe with no args", () => {
  assert.equal(analogyPrompt({ name: "X" }), analogyPrompt({ name: "X" }));
  assert.doesNotThrow(() => lessonStepPrompt("analogy"));
  assert.doesNotThrow(() => lessonStepPrompt("unknown-step"));
  assert.equal(lessonStepPrompt("unknown-step"), "");
});

test("notes are capped so a pasted prompt stays reasonable", () => {
  const p = analogyPrompt({ name: "X", notes: "z".repeat(4000) });
  assert.ok((p.match(/z+/)?.[0].length ?? 0) <= 900);
});

test("clampStep keeps the step index in range", () => {
  assert.equal(clampStep(-3), 0);
  assert.equal(clampStep(999, 7), 6);
  assert.equal(clampStep(2, 7), 2);
  assert.equal(clampStep(NaN), 0);
  assert.equal(clampStep(2.9, 7), 2);
});
