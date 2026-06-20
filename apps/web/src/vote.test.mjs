// vote.test.mjs — node --test, no browser/wasm. Proves the pure buildVote
// factory (SPEC-0015 §2.3, R-0015 AC6). The voter id is NOT tested here — it is
// the Rust `wizard_id_of` (host-tested in mp-identity), exposed to JS.
// Run: `node --test apps/web/src/*.test.mjs`

import test from "node:test";
import assert from "node:assert/strict";

import { buildVote } from "./vote.js";

const R = "00000000-0000-0000-0000-0000000000d1";

test("valid stone → ok, tagged error:null (AC6)", () => {
  const v = buildVote({ resource: R, weight: 10 });
  assert.equal(v.error, null);
  assert.equal(v.resource, R);
  assert.equal(v.weight, 10);
});

test("weight is coerced to a number", () => {
  const v = buildVote({ resource: R, weight: "25" }); // slider .value is a string
  assert.equal(v.error, null);
  assert.equal(v.weight, 25);
});

test("result is deterministic for the same input", () => {
  assert.deepEqual(buildVote({ resource: R, weight: 5 }), buildVote({ resource: R, weight: 5 }));
});

test("missing marker → error (AC6)", () => {
  const v = buildVote({ weight: 10 });
  assert.ok(typeof v.error === "string" && v.error.length > 0);
});

test("zero / negative weight → error", () => {
  assert.ok(buildVote({ resource: R, weight: 0 }).error);
  assert.ok(buildVote({ resource: R, weight: -3 }).error);
});

test("non-finite weight → error", () => {
  assert.ok(buildVote({ resource: R, weight: NaN }).error);
  assert.ok(buildVote({ resource: R, weight: Infinity }).error);
  assert.ok(buildVote({ resource: R, weight: "abc" }).error);
});

test("empty call → error (no marker)", () => {
  assert.ok(buildVote().error);
});
