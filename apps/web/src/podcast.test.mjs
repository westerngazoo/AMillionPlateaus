// podcast.test.mjs — node --test, pure (R-0050). The Audio Overview's three
// pure legs: the episode-writing prompt (format contract + grounding), the
// tolerant script parser, and deterministic two-voice selection.

import test from "node:test";
import assert from "node:assert/strict";

import { podcastPrompt, parseScript, pickVoices } from "./podcast.js";
import { TOPIC_BODY_CAP } from "./study-prompts.js";

test("podcastPrompt: two-host contract, focus + domain embedded, bodies capped", () => {
  const long = "y".repeat(TOPIC_BODY_CAP * 3);
  const p = podcastPrompt({
    domainLabel: "Computation",
    focusName: "The Lambda Calculus",
    topics: [
      { name: "The Lambda Calculus", body: long },
      { name: "Church Encodings", body: "numbers as functions" },
    ],
  });
  assert.match(p, /"The Lambda Calculus"/);
  assert.match(p, /"Computation"/);
  assert.match(p, /HOST A:/);
  assert.match(p, /HOST B:/);
  assert.match(p, /10 to 14 exchanges/);
  assert.match(p, /read aloud/); // spoken-length constraint
  assert.match(p, /### Church Encodings/);
  assert.ok(p.length < TOPIC_BODY_CAP * 2 + 2500, "long bodies are capped");
});

test("parseScript: well-formed HOST lines parse in order with hosts assigned", () => {
  const lines = parseScript(
    "HOST A: What even is a lambda?\nHOST B: A function with no name.\nHOST A: That's it?",
  );
  assert.deepEqual(lines, [
    { host: "A", text: "What even is a lambda?" },
    { host: "B", text: "A function with no name." },
    { host: "A", text: "That's it?" },
  ]);
});

test("parseScript: tolerates case, dashes, bold markers, bare letters and HOST 1/2", () => {
  const lines = parseScript(
    "**HOST A:** Hello there.\nhost b — Hi!\nA: Quick one.\nHOST 2: Numbered works too.",
  );
  assert.equal(lines.length, 4);
  assert.deepEqual(lines.map((l) => l.host), ["A", "B", "A", "B"]);
  assert.equal(lines[0].text, "Hello there."); // ** stripped
  assert.equal(lines[3].text, "Numbered works too.");
});

test("parseScript: unmarked continuation lines extend the previous turn", () => {
  const lines = parseScript("HOST A: First sentence.\nSecond sentence, same breath.\nHOST B: Reply.");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, "First sentence. Second sentence, same breath.");
});

test("parseScript: no markers at all → alternate hosts per paragraph (degraded, playable)", () => {
  const lines = parseScript("First paragraph here.\n\nSecond paragraph here.\n\nThird.");
  assert.deepEqual(lines.map((l) => l.host), ["A", "B", "A"]);
  assert.equal(lines[1].text, "Second paragraph here.");
});

test("parseScript: empty/whitespace → []", () => {
  assert.deepEqual(parseScript(""), []);
  assert.deepEqual(parseScript("   \n \n"), []);
  assert.deepEqual(parseScript(null), []);
});

test("pickVoices: two distinct English voices when available", () => {
  const { a, b } = pickVoices([
    { name: "Anna", lang: "de-DE" },
    { name: "Sam", lang: "en-US" },
    { name: "Kate", lang: "en-GB" },
  ]);
  assert.equal(a.name, "Sam");
  assert.equal(b.name, "Kate");
});

test("pickVoices: falls back to any voices, then doubles a single voice, then nulls", () => {
  const anyLang = pickVoices([{ name: "Anna", lang: "de-DE" }, { name: "Yuki", lang: "ja-JP" }]);
  assert.deepEqual([anyLang.a.name, anyLang.b.name], ["Anna", "Yuki"]);
  const single = pickVoices([{ name: "Solo", lang: "en-US" }]);
  assert.equal(single.a.name, "Solo");
  assert.equal(single.b.name, "Solo"); // doubled — glue differentiates by pitch
  assert.deepEqual(pickVoices([]), { a: null, b: null });
  assert.deepEqual(pickVoices(undefined), { a: null, b: null });
});
