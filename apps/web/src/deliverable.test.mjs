// deliverable.test.mjs — node --test, pure (R-0073).
import test from "node:test";
import assert from "node:assert/strict";
import { extractDeliverable, deliverableCoachPrompt, splitDerivation } from "./deliverable.js";
import { handoffOpenUrl, HANDOFF_TARGETS, PREFILL_MAX } from "./handoff.js";

test("extractDeliverable pulls the task out of a real curriculum-shaped body", () => {
  const body = `# Kinematics in 2D\nMotion in 1D generalizes to vectors.\n\n**Deliverable:** derive the range $R = v_0^2\\sin 2\\theta / g$ and the angle that maximizes it.\n\n**Study (official):** Khan Academy — *Two-dimensional motion*.`;
  const d = extractDeliverable(body);
  assert.match(d, /^derive the range/);
  assert.match(d, /maximizes it\.$/);
  assert.doesNotMatch(d, /Study \(official\)/, "stops before the next section");
});

test("extractDeliverable handles end-of-body deliverables and absence", () => {
  assert.equal(extractDeliverable("# T\n\n**Deliverable:** just one line."), "just one line.");
  assert.equal(extractDeliverable("# T\nno deliverable here"), "");
  assert.equal(extractDeliverable(null), "");
  // multiline deliverable collapses to one line
  const multi = extractDeliverable("**Deliverable:** first part\ncontinues here.\n\nNext para.");
  assert.equal(multi, "first part continues here.");
});

test("deliverableCoachPrompt demands tutoring, not answers", () => {
  const p = deliverableCoachPrompt({ topic: "Classical Mechanics", deliverable: "derive Euler–Lagrange", pathTitle: "The Physics Core" });
  assert.match(p, /"Classical Mechanics"/);
  assert.match(p, /"derive Euler–Lagrange"/);
  assert.match(p, /"The Physics Core"/);
  assert.match(p, /HINT first/);
  assert.match(p, /smallest sensible steps/);
  assert.match(p, /wait for my attempt/);
  assert.doesNotMatch(deliverableCoachPrompt({ topic: "X", deliverable: "d" }), /\(in ""\)/);
});

test("splitDerivation separates the readable body from the step-by-step math (R-0074)", () => {
  const body = `# The Geometric Product\nOne product to replace both.\n\n**Deliverable:** show $a\\wedge b = \\tfrac12(ab-ba)$.\n\n**Study (official):** Doran & Lasenby.\n\n### Worked derivation — the symmetric/antisymmetric split\nStart from the axioms: $a^2 = |a|^2$.\n\nStep 2 follows.`;
  const { main, derivation } = splitDerivation(body);
  assert.match(main, /One product to replace both\./);
  assert.match(main, /Study \(official\)/, "main keeps everything before the heading");
  assert.doesNotMatch(main, /Worked derivation/);
  assert.match(derivation, /^Start from the axioms/);
  assert.match(derivation, /Step 2 follows\.$/);
  // absent → derivation "" and main untouched
  const none = splitDerivation("# T\njust a body");
  assert.equal(none.derivation, "");
  assert.equal(none.main, "# T\njust a body");
  assert.deepEqual(splitDerivation(null), { main: "", derivation: "" });
});

test("handoffOpenUrl: Gemini prefill carries the prompt in the URL when it fits", () => {
  const gemini = HANDOFF_TARGETS.find((t) => t.id === "gemini");
  const url = handoffOpenUrl(gemini, "explain rotors slowly");
  assert.match(url, /^https:\/\/www\.google\.com\/search\?udm=50&q=explain%20rotors%20slowly$/);
  // too-long prompts fall back to the base URL (clipboard carries them)
  const big = "x".repeat(PREFILL_MAX + 1);
  assert.equal(handoffOpenUrl(gemini, big), gemini.url);
  // targets without prefill always open their base URL
  const nlm = HANDOFF_TARGETS.find((t) => t.id === "notebooklm");
  assert.equal(handoffOpenUrl(nlm, "anything"), nlm.url);
  // defensive
  assert.equal(handoffOpenUrl(null, "p"), "");
  assert.equal(handoffOpenUrl(gemini, ""), gemini.url);
});
