// study-prompts.test.mjs — node --test, pure (R-0048). The deep-study prompt
// pack: every builder embeds its inputs, keeps whole-domain payloads bounded,
// and carries the instruction that makes each verb what it is (the owner's
// NotebookLM prompt collection, adapted to the graph).

import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPIC_BODY_CAP,
  mentalModelsPrompt,
  disagreementsPrompt,
  deepQuizPrompt,
  evaluatePrompt,
  hiddenConnectionsPrompt,
  gapMapPrompt,
  feynmanPrompt,
  DEEP_STUDY_ACTIONS,
} from "./study-prompts.js";

test("mental models: domain-wide, expert-frames framing, topics embedded, bodies capped", () => {
  const long = "x".repeat(TOPIC_BODY_CAP * 3);
  const p = mentalModelsPrompt({
    domainLabel: "Computation",
    topics: [
      { name: "The Lambda Calculus", body: long },
      { name: "Church Encodings", body: "numbers as functions" },
    ],
  });
  assert.match(p, /5 fundamental MENTAL MODELS/);
  assert.match(p, /takes for granted/); // the expert-vs-beginner framing
  assert.match(p, /### The Lambda Calculus/);
  assert.match(p, /### Church Encodings/);
  assert.ok(p.length < TOPIC_BODY_CAP * 2 + 2000, "long bodies are capped");
});

test("disagreements: resource-grounded, strongest-argument structure, honest-agreement fallback", () => {
  const p = disagreementsPrompt();
  assert.match(p, /FUNDAMENTALLY DISAGREE/);
  assert.match(p, /strongest argument/);
  assert.match(p, /citing the specific pinned resource/);
  assert.match(p, /genuinely agree.*say so honestly/);
});

test("deep quiz: reasoning-not-recall, crosses named bridges, ordered by difficulty", () => {
  const p = deepQuizPrompt({
    neighbors: [
      { name: "Intuitionistic Logic", concept: "proofs are programs (meet)" },
      { name: "Church Encodings", concept: "numbers as λ" },
    ],
  });
  assert.match(p, /10 questions/);
  assert.match(p, /reasoning, not recall/);
  assert.match(p, /"Intuitionistic Logic" \(bridge: proofs are programs \(meet\)\)/);
  assert.match(p, /rule of thumb FAILS/);
  assert.match(p, /easiest to hardest/);
  assert.match(deepQuizPrompt({}), /no bridged neighbours yet/);
});

test("evaluate: a template with placeholders + reread pointers", () => {
  const p = evaluatePrompt({ topicName: "SIA Infinitesimals" });
  assert.match(p, /"SIA Infinitesimals"/);
  assert.match(p, /\[PASTE THE QUESTION\]/);
  assert.match(p, /\[WRITE YOUR ANSWER HERE\]/);
  assert.match(p, /which of this topic's pinned resources/);
});

test("hidden connections: overlap/tension/meta-model + proposes concrete new bridges", () => {
  const p = hiddenConnectionsPrompt({ neighbors: [{ name: "Streams", concept: "potential infinity" }] });
  assert.match(p, /OVERLAP or reinforce/);
  assert.match(p, /CONTRADICT or create tension/);
  assert.match(p, /META-MODEL/);
  assert.match(p, /propose up to 3 NEW bridges/);
  assert.match(hiddenConnectionsPrompt({}), /propose the first ones/);
});

test("gap map: grounded in the REAL per-topic status + path position, 4-hour plan", () => {
  const p = gapMapPrompt({
    domainLabel: "Computation",
    topics: [
      { name: "The REPL & S-expressions", status: "mastered" },
      { name: "The Lambda Calculus", status: "studying" },
      { name: "Computability", status: "untouched" },
    ],
    pathTitle: "Master Computation, from Lisp Up",
    nextStep: "The Lambda Calculus",
  });
  assert.match(p, /from the app's mastery records, not self-report/);
  assert.match(p, /- The Lambda Calculus: studying/);
  assert.match(p, /"Master Computation, from Lisp Up"/);
  assert.match(p, /next unmastered step is "The Lambda Calculus"/);
  assert.match(p, /3 biggest comprehension gaps/);
  assert.match(p, /next 4 hours/);
  assert.match(gapMapPrompt({}), /not following a path/);
});

test("feynman: a template with the explain-it-yourself placeholder and a 1–10 grade", () => {
  const p = feynmanPrompt({ topicName: "Elementary Topos Theory" });
  assert.match(p, /"Elementary Topos Theory"/);
  assert.match(p, /\[EXPLAIN IT HERE IN YOUR OWN WORDS\]/);
  assert.match(p, /1–10/);
  assert.match(p, /oversimplify/);
});

test("the action list covers all seven verbs with a scope the UI glue understands", () => {
  assert.equal(DEEP_STUDY_ACTIONS.length, 7);
  const scopes = new Set(DEEP_STUDY_ACTIONS.map((a) => a.scope));
  for (const s of scopes) assert.ok(["plateau", "neighbors", "domain", "progress", "template"].includes(s));
  const keys = DEEP_STUDY_ACTIONS.map((a) => a.key);
  assert.deepEqual(keys, ["models", "disagree", "deepquiz", "connections", "gaps", "feynman", "evaluate"]);
});
