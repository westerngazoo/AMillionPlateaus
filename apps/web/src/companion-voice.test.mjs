// companion-voice.test.mjs — node --test, no wasm. Proves voiceFor resolves a
// voice for every persona shape without crashing (SPEC-0009 §2.3, R-0009 AC3).

import test from "node:test";
import assert from "node:assert/strict";

import { voiceFor, VOICES } from "./companion-voice.js";

test("a preset persona resolves its built-in voice", () => {
  assert.equal(voiceFor({ id: "geometer" }), VOICES.geometer);
  assert.equal(voiceFor({ id: "composer" }), VOICES.composer);
});

test("an explicit persona.voice is preferred over the id-keyed table (authored, AC3)", () => {
  // An authored persona carries its own voice and id:"authored" (not in VOICES).
  assert.equal(voiceFor({ id: "authored", voice: "Speak as playful." }), "Speak as playful.");
  // Even if an id collided with a preset, an explicit voice wins.
  assert.equal(voiceFor({ id: "geometer", voice: "Speak as terse." }), "Speak as terse.");
});

test("an authored persona without a voice falls back to the generic line — no crash (AC3)", () => {
  assert.equal(voiceFor({ id: "authored" }), "Speak as a helpful, grounded guide.");
});

test("a blank/whitespace voice is ignored in favour of the fallback", () => {
  assert.equal(voiceFor({ id: "authored", voice: "   " }), "Speak as a helpful, grounded guide.");
});

test("a null/undefined persona resolves the generic line (no crash)", () => {
  assert.equal(voiceFor(null), "Speak as a helpful, grounded guide.");
  assert.equal(voiceFor(undefined), "Speak as a helpful, grounded guide.");
});
