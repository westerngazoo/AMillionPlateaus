// faded.test.mjs — faded worked examples: parse, backward fade, leveling (R-0083).
import test from "node:test";
import assert from "node:assert/strict";

import { parseSteps, clampFade, fadedView, levelUp, levelDown, fadeLabel } from "./faded.js";

// A realistic R-0074 derivation body (matches physics-lens-curriculum.js shape).
const DERIV = [
  "**Step 1 — the one axiom.** The geometric product is associative and $aa = |a|^2$.",
  "**Step 2 — expand a squared sum.** $(a+b)(a+b) = |a+b|^2$, so $ab + ba$ is a scalar.",
  "**Step 3 — split any product.** $ab = \\tfrac12(ab+ba) + \\tfrac12(ab-ba)$.",
  "**Step 4 — identify the halves.** Symmetric = dot; antisymmetric = wedge.",
].join("\n\n");

test("parseSteps: numbered steps with titles; full md preserved per step", () => {
  const { preamble, steps } = parseSteps(DERIV);
  assert.equal(preamble, "");
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4]);
  assert.equal(steps[0].title, "the one axiom");
  assert.match(steps[2].md, /tfrac12\(ab\+ba\)/); // step md carries its math intact
});

test("parseSteps: preamble before the first step; trailing paragraph rides the last step", () => {
  const body = `A quick note first — watch the signs.\n\n${DERIV}\n\nThat's the whole trick.`;
  const { preamble, steps } = parseSteps(body);
  assert.match(preamble, /watch the signs/);
  assert.equal(steps.length, 4);
  assert.match(steps[3].md, /whole trick/); // no orphaned paragraphs
});

test("parseSteps: no step markers → all preamble, zero fadeable steps; junk safe", () => {
  const { preamble, steps } = parseSteps("Just prose, no numbered steps.");
  assert.equal(steps.length, 0);
  assert.match(preamble, /Just prose/);
  assert.deepEqual(parseSteps(null), { preamble: "", steps: [] });
  // en-dash / hyphen variants of the separator also parse
  assert.equal(parseSteps("**Step 1 - lo-fi dash.** x").steps.length, 1);
});

test("fadedView: backward fading — the LAST k steps hide", () => {
  const { steps } = parseSteps(DERIV);
  assert.deepEqual(fadedView(steps, 0).map((x) => x.hidden), [false, false, false, false]);
  assert.deepEqual(fadedView(steps, 1).map((x) => x.hidden), [false, false, false, true]);
  assert.deepEqual(fadedView(steps, 3).map((x) => x.hidden), [false, true, true, true]);
  assert.deepEqual(fadedView(steps, 99).map((x) => x.hidden), [true, true, true, true]); // clamped
  assert.deepEqual(fadedView(null, 2), []);
});

test("leveling: got-it fades one more (capped), more-support restores one (floored)", () => {
  assert.equal(levelUp(0, 4), 1);
  assert.equal(levelUp(4, 4), 4); // cap: already deriving everything
  assert.equal(levelDown(1, 4), 0);
  assert.equal(levelDown(0, 4), 0); // floor: fully worked
  assert.equal(clampFade(NaN, 4), 0);
  assert.equal(clampFade(-2, 4), 0);
});

test("fadeLabel names the state honestly", () => {
  assert.match(fadeLabel(0, 4), /fill the missing step/);
  assert.match(fadeLabel(1, 4), /last step is yours/);
  assert.match(fadeLabel(3, 4), /last 3 steps are yours/);
  assert.match(fadeLabel(4, 4), /derive it all \(4 steps/);
});
