// bridge.test.mjs — node --test, no browser/wasm. Proves the pure buildBridge
// factory (SPEC-0013 §2.2, R-0013 AC6). Run: `node --test apps/web/src/*.test.mjs`

import test from "node:test";
import assert from "node:assert/strict";

import { buildBridge, CONCEPT_FALLBACK } from "./bridge.js";

const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000c1";

// ── success path ──────────────────────────────────────────────────────────────

test("distinct endpoints + concept → ok, tagged error:null (AC6)", () => {
  const r = buildBridge({ from: A, to: B, concept: "frequency ratios" });
  assert.equal(r.error, null);
  assert.equal(r.from, A);
  assert.equal(r.to, B);
  assert.equal(r.concept, "frequency ratios");
});

test("result is deterministic for the same input (AC6)", () => {
  const x = buildBridge({ from: A, to: B, concept: "ratio" });
  const y = buildBridge({ from: A, to: B, concept: "ratio" });
  assert.deepEqual(x, y);
});

test("concept is trimmed", () => {
  const r = buildBridge({ from: A, to: B, concept: "  limits  " });
  assert.equal(r.error, null);
  assert.equal(r.concept, "limits");
});

// ── concept fallback (AC3/AC6) ──────────────────────────────────────────────────

test("blank concept → fallback (AC3)", () => {
  const r = buildBridge({ from: A, to: B, concept: "" });
  assert.equal(r.error, null);
  assert.equal(r.concept, CONCEPT_FALLBACK);
});

test("whitespace-only concept → fallback (exercises .trim())", () => {
  const r = buildBridge({ from: A, to: B, concept: "   " });
  assert.equal(r.error, null);
  assert.equal(r.concept, CONCEPT_FALLBACK);
});

test("non-string concept → fallback (exercises the typeof guard)", () => {
  const r = buildBridge({ from: A, to: B, concept: 42 });
  assert.equal(r.error, null);
  assert.equal(r.concept, CONCEPT_FALLBACK);
});

test("missing concept → fallback", () => {
  const r = buildBridge({ from: A, to: B });
  assert.equal(r.error, null);
  assert.equal(r.concept, CONCEPT_FALLBACK);
});

// ── error cases (AC3/AC6) ───────────────────────────────────────────────────────

test("self-loop (from === to) → error (AC3)", () => {
  const r = buildBridge({ from: A, to: A, concept: "x" });
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});

test("missing 'to' endpoint → error (AC3)", () => {
  const r = buildBridge({ from: A, concept: "x" });
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});

test("missing 'from' endpoint → error (AC3)", () => {
  const r = buildBridge({ to: B, concept: "x" });
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});

test("empty call → error (no endpoints)", () => {
  const r = buildBridge();
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});
