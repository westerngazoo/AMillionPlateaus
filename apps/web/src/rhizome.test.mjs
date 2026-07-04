// rhizome.test.mjs — pure helpers for R-0044 rhizome drill-down.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGrowable,
  hashTerm,
  childPosition,
  starterBody,
  draftPlateauPrompt,
  inlinePrompt,
} from "./rhizome.js";

test("isGrowable accepts a short term, rejects junk and sentences", () => {
  assert.equal(isGrowable("category with finite power object"), true);
  assert.equal(isGrowable("Heyting algebra"), true);
  assert.equal(isGrowable(""), false);
  assert.equal(isGrowable("x"), false); // too short
  assert.equal(isGrowable("   "), false);
  assert.equal(isGrowable("This is a whole sentence. And another."), false);
  assert.equal(isGrowable("a".repeat(200)), false); // too long
});

test("hashTerm is deterministic and 32-bit", () => {
  assert.equal(hashTerm("topos"), hashTerm("topos")); // stable
  assert.notEqual(hashTerm("topos"), hashTerm("sheaf")); // discriminates
  const h = hashTerm("anything");
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
});

test("childPosition sits NEAR the parent but not ON it, deterministically", () => {
  const parent = { e1: 0.9, e2: 0.3, e3: 0.0 };
  const a = childPosition(parent, "power object");
  const b = childPosition(parent, "power object");
  assert.deepEqual(a, b); // same term ⇒ same spot (idempotent placement)

  // offset is small (a child is an elaboration, not a journey)
  const d = Math.hypot(a.e1 - parent.e1, a.e2 - parent.e2, a.e3 - parent.e3);
  assert.ok(d > 0.0 && d < 0.2, `offset ${d} should be small and nonzero`);

  // different terms fan out to different spots
  const c = childPosition(parent, "subobject classifier");
  assert.notDeepEqual(a, c);
});

test("childPosition tolerates a parent missing coords (defaults to origin-ish)", () => {
  const p = childPosition({}, "term");
  assert.ok(Number.isFinite(p.e1) && Number.isFinite(p.e2) && Number.isFinite(p.e3));
});

test("starterBody names the lineage and never fabricates a definition", () => {
  const body = starterBody("power object", "Elementary Topos Theory");
  assert.match(body, /# power object/);
  assert.match(body, /Elementary Topos Theory/);
  assert.match(body, /No definition yet/i); // honest stub, not a hallucinated gloss
});

test("prompts embed the term and the parent context", () => {
  const dp = draftPlateauPrompt("adjoint functor", "Category Theory");
  assert.match(dp, /adjoint functor/);
  assert.match(dp, /Category Theory/);
  assert.match(dp, /Do NOT include a title heading/i); // so it slots under our own H1

  assert.match(inlinePrompt("sheaf", "Topos", "define"), /define .*sheaf/i);
  assert.match(inlinePrompt("sheaf", "Topos", "example"), /example/i);
});
