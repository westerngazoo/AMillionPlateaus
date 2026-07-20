// rabbit-hole.test.mjs — node --test, pure (R-0071).
import test from "node:test";
import assert from "node:assert/strict";
import { sentenceChunks, explainSlowlyPrompt, missingForPrompt } from "./rabbit-hole.js";

const join = (chunks) => chunks.map((c) => c.text).join("");

test("sentenceChunks splits on sentence boundaries and reproduces the input exactly", () => {
  const t = "One product to replace both. It works in every dimension. Learn this first!";
  const c = sentenceChunks(t);
  assert.equal(join(c), t, "concatenation is lossless");
  assert.deepEqual(
    c.map((x) => x.end),
    [true, true, false],
  );
  assert.match(c[0].text, /replace both\.\s$/);
  assert.match(c[1].text, /every dimension\.\s$/);
});

test("sentenceChunks NEVER splits inside $…$ math (KaTeX renders after segmentation)", () => {
  // the '.' and '?' inside math must not create boundaries
  const t = "For vectors $a. B$ we get $x? Y$ always. Next sentence here.";
  const c = sentenceChunks(t);
  assert.equal(join(c), t);
  assert.equal(c.length, 2, "only the real boundary after 'always.' splits");
  assert.match(c[0].text, /always\.\s$/);
  // a full mathy sentence from the GA body stays whole
  const ga = "It's associative, invertible ($a^{-1}=a/|a|^2$), and it works. Everything downstream is this product.";
  const g = sentenceChunks(ga);
  assert.equal(g.length, 2);
  assert.match(g[0].text, /works\.\s$/);
});

test("sentenceChunks does not split before a lowercase continuation (e.g. abbreviations)", () => {
  const t = "Use it e.g. when rotating, i.e. always.";
  const c = sentenceChunks(t);
  assert.equal(c.length, 1, "no false boundary at 'e.g.'/'i.e.'");
  assert.equal(c[0].end, false);
  // closing paren/quote after the terminator still ends the sentence
  const q = 'He said "done." Then left.';
  const qc = sentenceChunks(q);
  assert.equal(qc.length, 2);
});

test("sentenceChunks is defensive: empty/null → [], trailing terminator has no dangling chunk", () => {
  assert.deepEqual(sentenceChunks(""), []);
  assert.deepEqual(sentenceChunks(null), []);
  const c = sentenceChunks("Just one sentence.");
  assert.equal(c.length, 1);
  assert.equal(c[0].end, false); // block end closes it — no boundary needed
});

test("explainSlowlyPrompt scopes to the sentence and demands slow pedagogy", () => {
  const p = explainSlowlyPrompt({ topic: "The Geometric Product", sentence: "ab = a·b + a∧b", pathTitle: "Physics through Geometric Algebra" });
  assert.match(p, /"The Geometric Product"/);
  assert.match(p, /"ab = a·b \+ a∧b"/);
  assert.match(p, /"Physics through Geometric Algebra"/);
  assert.match(p, /one idea per short paragraph/);
  assert.match(p, /define EVERY symbol/);
  assert.match(p, /analogy BEFORE/);
  assert.doesNotMatch(explainSlowlyPrompt({ topic: "X", sentence: "s" }), /\(in ""\)/);
});

test("missingForPrompt includes the lens-grouped topic list and the EXACT-names contract", () => {
  const p = missingForPrompt({
    topic: "The Geometric Product",
    sentence: "complex numbers are the even part in 2D",
    topics: [
      { name: "Bivectors: Oriented Planes", lens: "Geometric Algebra" },
      { name: "Quadratics & Polynomials", lens: "Mathematics" },
    ],
  });
  assert.match(p, /Geometric Algebra:\n {2}Bivectors: Oriented Planes/);
  assert.match(p, /Mathematics:\n {2}Quadratics & Polynomials/);
  assert.match(p, /EXACT name from the list, one per line/);
  assert.match(p, /"missing:"/);
});
