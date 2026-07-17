// where-fits.test.mjs — node --test, pure (R-0069).
import test from "node:test";
import assert from "node:assert/strict";
import { whereFitsPrompt, matchTopics } from "./where-fits.js";

const TOPICS = [
  { id: "1", name: "Rotors: Rotation without Matrices", lens: "Geometric Algebra" },
  { id: "2", name: "Pauli Algebra & Spinors", lens: "Geometric Algebra" },
  { id: "3", name: "Maxwell in One Equation: ∇F = J", lens: "Geometric Algebra" },
  { id: "4", name: "Quantum Mechanics", lens: "Physics" },
];

test("whereFitsPrompt names the resource, groups topics by lens, and pins the format", () => {
  const p = whereFitsPrompt({ title: "Rotors explained", url: "https://youtu.be/abc", kind: "Video", topics: TOPICS });
  assert.match(p, /Rotors explained — https:\/\/youtu\.be\/abc/);
  assert.match(p, /Geometric Algebra:/);
  assert.match(p, /Physics:/);
  assert.match(p, /EXACT topic names/);
  assert.match(p, /add it as a source/); // because a url was given
  // no url → no "add it as a source" line, and a safe default label
  assert.doesNotMatch(whereFitsPrompt({ topics: TOPICS }), /add it as a source/);
  assert.match(whereFitsPrompt({ topics: TOPICS }), /this resource/);
});

test("matchTopics resolves exact names, ignores list markers/quotes, dedups", () => {
  const answer = `1. Rotors: Rotation without Matrices\n- "Pauli Algebra & Spinors"\nRotors: Rotation without Matrices`;
  const { matched, unmatched } = matchTopics(answer, TOPICS);
  assert.deepEqual(matched.map((m) => m.id), ["1", "2"]); // deduped (Rotors once)
  assert.deepEqual(unmatched, []);
});

test("matchTopics tolerates punctuation drift (the ∇F=J symbol soup)", () => {
  // model dropped the colon and spacing around the operator
  const { matched } = matchTopics("Maxwell in One Equation ∇F = J", TOPICS);
  assert.deepEqual(matched.map((m) => m.id), ["3"]);
});

test("matchTopics resolves a unique substring but leaves ambiguous/unknown lines unmatched", () => {
  // "Spinors" is a unique substring of exactly one topic → resolves
  const uniq = matchTopics("Spinors", TOPICS);
  assert.deepEqual(uniq.matched.map((m) => m.id), ["2"]);
  // a made-up name → unmatched, reported back for the user to see
  const miss = matchTopics("Topology of Coffee Cups", TOPICS);
  assert.deepEqual(miss.matched, []);
  assert.deepEqual(miss.unmatched, ["Topology of Coffee Cups"]);
});

test("matchTopics is defensive against empty/garbage input", () => {
  assert.deepEqual(matchTopics("", TOPICS), { matched: [], unmatched: [] });
  assert.deepEqual(matchTopics(null, TOPICS), { matched: [], unmatched: [] });
  assert.deepEqual(matchTopics("Rotors: Rotation without Matrices", null).matched, []);
});
