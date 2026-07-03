// cas.test.mjs — R-0034 / SPEC-0034. The CAS engine is the security surface: a
// WRONG answer must never verify. These tests pin the parser, the integrity
// predicates, equivalence (incl. a forgery-rejection), the seeded generator, and
// the author-challenge parse. Pure + deterministic (no DOM/network/Date/random).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseExpr,
  evalAt,
  numericDerivAt,
  toTeX,
  isValidSample,
  agree,
  seededPoints,
  checkEquivalence,
  generateDrill,
  drillsFor,
  parseChallenges,
  stripChallenges,
} from "./cas.js";

// ── Parser / evaluator ─────────────────────────────────────────────────────────

test("parseExpr: longest-match functions & constants (never split into letters)", () => {
  // sin/cos/pi must tokenize whole — not s*i*n or p*i (SPEC arch-note 4)
  assert.ok(Math.abs(evalAt(parseExpr("sin(0)"), 0) - 0) < 1e-12);
  assert.ok(Math.abs(evalAt(parseExpr("cos(0)"), 0) - 1) < 1e-12);
  assert.ok(Math.abs(evalAt(parseExpr("pi"), 0) - Math.PI) < 1e-12);
  assert.ok(Math.abs(evalAt(parseExpr("exp(1)"), 0) - Math.E) < 1e-12);
});

test("parseExpr: implicit multiplication and precedence", () => {
  assert.equal(evalAt(parseExpr("3x"), 2), 6); // 3*x
  assert.equal(evalAt(parseExpr("2(x+1)"), 3), 8); // 2*(x+1)
  assert.equal(evalAt(parseExpr("(x+1)(x-1)"), 3), 8); // 8 = 3^2-1
  assert.equal(evalAt(parseExpr("3x^2"), 2), 12); // 3*(x^2), not (3x)^2
  assert.equal(evalAt(parseExpr("-x^2"), 3), -9); // -(x^2)
  assert.equal(evalAt(parseExpr("2^3"), 0), 8);
});

test("parseExpr: rejects off-grammar (unknown symbol, wrong variable, garbage tail)", () => {
  assert.throws(() => parseExpr("y + 1")); // wrong variable (default x)
  assert.throws(() => parseExpr("foo(x)")); // unknown function
  assert.throws(() => parseExpr("2 +")); // incomplete
  assert.throws(() => parseExpr("x x x )")); // garbage
  assert.throws(() => parseExpr("@#$")); // junk
});

test("parseExpr: an explicit `variable` other than x", () => {
  assert.equal(evalAt(parseExpr("2t + 1", "t"), 3), 7);
  assert.throws(() => parseExpr("2t + 1", "x")); // t is unknown when variable is x
});

test("numericDerivAt ≈ analytic slope", () => {
  const ast = parseExpr("x^3"); // d/dx = 3x^2 → at x=2 → 12
  assert.ok(Math.abs(numericDerivAt(ast, 2) - 12) < 1e-3);
});

test("toTeX: produces sane LaTeX for the preview", () => {
  const tex = toTeX(parseExpr("3x^2 + 2x"));
  assert.match(tex, /\^\{2\}/);
  assert.match(tex, /3/);
});

// ── Integrity predicates ─────────────────────────────────────────────────────

test("isValidSample excludes NaN / ±Infinity (real-only ⇒ no Complex)", () => {
  assert.equal(isValidSample(1, 2), true);
  assert.equal(isValidSample(NaN, 2), false);
  assert.equal(isValidSample(1, Infinity), false);
  assert.equal(isValidSample(-Infinity, 0), false);
});

test("agree: mixed abs+rel tolerance near zero and at large magnitude", () => {
  assert.equal(agree(0, 1e-9), true); // tiny abs diff near zero
  assert.equal(agree(0, 1e-3), false);
  assert.equal(agree(1e6, 1e6 + 1e-4), true); // relative slack at large magnitude
  assert.equal(agree(1e6, 1e6 + 100), false);
});

test("seededPoints: deterministic per reference; skips near-integers; in range", () => {
  const a = seededPoints("3*x^2 + 2");
  const b = seededPoints("3*x^2 + 2");
  assert.deepEqual(a, b); // same reference → same points
  assert.notDeepEqual(seededPoints("3*x^2 + 2"), seededPoints("3*x^2 + 5")); // per-problem
  for (const p of a) {
    assert.ok(p > -3.31 && p < 3.31);
    assert.ok(Math.abs(p - Math.round(p)) >= 1e-3); // no near-integers
  }
});

// ── Equivalence: accepts form differences, rejects non-equivalent ──────────────

test("checkEquivalence ACCEPTS equivalent forms", () => {
  assert.equal(checkEquivalence("2x", "x + x").equivalent, true);
  assert.equal(checkEquivalence("(x+1)^2", "x^2 + 2x + 1").equivalent, true);
  assert.equal(checkEquivalence("x^2 + 2x + 1", "(x+1)*(x+1)").equivalent, true);
  assert.equal(checkEquivalence("2*x + 3*x", "5*x").equivalent, true);
});

test("checkEquivalence REJECTS non-equivalent answers", () => {
  assert.equal(checkEquivalence("x", "x^2").equivalent, false);
  assert.equal(checkEquivalence("2x", "3x").equivalent, false);
  assert.equal(checkEquivalence("x^2 + 1", "x^2 + 2").equivalent, false);
  // a plain disagreement reports "isn't equivalent" (NOT the too-few-valid message)
  assert.match(checkEquivalence("4 + 4*x", "5 + 4*x").reason, /isn't equivalent/);
});

test("checkEquivalence is CONSERVATIVE on unparseable input (no false correct)", () => {
  assert.equal(checkEquivalence("=2x?", "2x").equivalent, false); // junk answer
  assert.equal(checkEquivalence("y", "x").equivalent, false); // wrong variable
});

test("checkEquivalence: a value-only FORGERY is rejected (the integrity test)", () => {
  // A learner who reads cas.js tries to pass a WRONG answer by adding a bump that
  // vanishes at the seeded points but is globally wrong. Per-problem seeding (they
  // can't know the points without the reference) + all-must-agree + the derivative
  // pass reject it. Construct a bump from THIS reference's own seeded points:
  const reference = "x^2";
  const pts = seededPoints(reference);
  // f(x) = x^2 + c * ∏(x - p_i): equals x^2 at every p_i, but globally ≠ x^2.
  const factors = pts.map((p) => `(x - (${p}))`).join(" * ");
  const forgery = `x^2 + 0.001 * ${factors}`;
  const res = checkEquivalence(forgery, reference);
  assert.equal(res.equivalent, false); // must NOT pass — wrong answer
});

test("checkEquivalence: all-must-agree (agreeing at some points but not others ⇒ reject)", () => {
  // |x| equals x on the positive samples but not the negative ones → not equivalent
  assert.equal(checkEquivalence("abs(x)", "x").equivalent, false);
});

test("checkEquivalence: integrate via antiderivative accepts ANY +C", () => {
  // d/dx(answer) ≡ 2x  ⇒ x^2, x^2+5, x^2-3 all pass; x^2+x does not.
  const ref = "2*x"; // the integrand
  assert.equal(checkEquivalence("x^2", ref, { antiderivative: true }).equivalent, true);
  assert.equal(checkEquivalence("x^2 + 5", ref, { antiderivative: true }).equivalent, true);
  assert.equal(checkEquivalence("x^2 - 3", ref, { antiderivative: true }).equivalent, true);
  assert.equal(checkEquivalence("x^2 + x", ref, { antiderivative: true }).equivalent, false);
});

// ── Drill generator ────────────────────────────────────────────────────────────

test("generateDrill: deterministic (same seed → same problem)", () => {
  const a = generateDrill({ operation: "differentiate", seed: 42 });
  const b = generateDrill({ operation: "differentiate", seed: 42 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(
    generateDrill({ operation: "differentiate", seed: 1 }).reference,
    generateDrill({ operation: "differentiate", seed: 2 }).reference,
  );
});

test("generateDrill: the canonical solution verifies as correct (self-consistent)", () => {
  for (const operation of ["differentiate", "simplify", "evaluate", "integrate"]) {
    for (let seed = 0; seed < 20; seed++) {
      const d = generateDrill({ operation, seed });
      // submitting the drill's own canonical solution must be accepted under its check
      const res = checkEquivalence(d.solution, d.reference, d.check);
      assert.equal(res.equivalent, true, `${operation}#${seed} solution must self-verify`);
    }
  }
});

test("generateDrill: a WRONG answer is rejected for a generated drill", () => {
  const d = generateDrill({ operation: "differentiate", seed: 7 });
  assert.equal(checkEquivalence(`${d.reference} + 1`, d.reference, d.check).equivalent, false);
});

test("generateDrill: non-evaluate reference depends on x (never degenerate-constant)", () => {
  for (const operation of ["differentiate", "simplify", "integrate"]) {
    for (let seed = 0; seed < 20; seed++) {
      const d = generateDrill({ operation, seed });
      const ast = parseExpr(d.reference);
      // the reference's value must change across x (not a constant)
      const varies = evalAt(ast, 0.3) !== evalAt(ast, 2.7) || numericDerivAt(ast, 1.1) !== 0;
      assert.ok(varies, `${operation}#${seed} reference should depend on x`);
    }
  }
});

test("drillsFor: quantitative topics by name; others empty", () => {
  assert.deepEqual(drillsFor({ name: "Calculus" }), ["differentiate", "integrate"]);
  assert.deepEqual(drillsFor({ name: "Algebra" }), ["simplify", "evaluate"]);
  assert.deepEqual(drillsFor({ name: "Harmony" }), []); // music topic → not quantitative
  assert.deepEqual(drillsFor({ name: "" }), []);
});

// ── Author challenges: parse + strip (round-trip) ──────────────────────────────

const BODY = [
  "# Motion",
  "",
  "Some notes about velocity.",
  "",
  "```solve",
  "prompt: Differentiate $x^2$",
  "answer: 2*x",
  "op: differentiate",
  "```",
  "",
  "More notes.",
].join("\n");

test("parseChallenges: extracts prompt/answer/op from a ```solve block", () => {
  const cs = parseChallenges(BODY);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].answer, "2*x");
  assert.equal(cs[0].operation, "differentiate");
  assert.match(cs[0].prompt, /Differentiate/);
  // and the parsed challenge actually checks: 2x is correct, 3x is not
  assert.equal(checkEquivalence("x + x", cs[0].answer, cs[0].check).equivalent, true);
  assert.equal(checkEquivalence("3*x", cs[0].answer, cs[0].check).equivalent, false);
});

test("parseChallenges: a block without an answer is ignored; no block ⇒ []", () => {
  assert.deepEqual(parseChallenges("```solve\nprompt: no answer here\n```"), []);
  assert.deepEqual(parseChallenges("plain body, no fences"), []);
});

test("stripChallenges: removes EXACTLY the solve blocks (round-trip with parse)", () => {
  const stripped = stripChallenges(BODY);
  assert.doesNotMatch(stripped, /```solve/);
  assert.doesNotMatch(stripped, /answer:/);
  assert.match(stripped, /Some notes about velocity\./); // surrounding prose kept
  assert.match(stripped, /More notes\./);
  // a body with no solve block is unchanged (modulo trim)
  assert.equal(stripChallenges("just prose"), "just prose");
});

test("parseChallenges: multiple blocks + CRLF tolerated", () => {
  const body =
    "a\r\n```solve\r\nprompt: P1\r\nanswer: x\r\n```\r\nb\r\n```solve\nprompt: P2\nanswer: 2*x\n```\n";
  const cs = parseChallenges(body);
  assert.equal(cs.length, 2);
  assert.equal(cs[0].answer, "x");
  assert.equal(cs[1].answer, "2*x");
  assert.doesNotMatch(stripChallenges(body), /```solve/);
});
