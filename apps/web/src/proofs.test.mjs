// proofs.test.mjs — R-0036 / SPEC-0036. Pure parse of published proofs from the
// verified corpus. Deterministic, no DOM/wasm.

import { test } from "node:test";
import assert from "node:assert/strict";
import { publishedProofs, PROOF_KIND } from "./proofs.js";

const key = (n) => String(n).repeat(64).slice(0, 64);
const proof = (pubkey, plateau, kind, body, created_at = 1) => ({
  pubkey,
  kind: PROOF_KIND,
  created_at,
  content: JSON.stringify({ plateau, kind, body }),
});

test("PROOF_KIND is the pinned artifact kind", () => {
  assert.equal(PROOF_KIND, 30081);
});

test("publishedProofs: returns proofs for the topic, attributed to the signer", () => {
  const events = [
    proof(key(1), "calc", "proof", "By induction…"),
    proof(key(2), "calc", "solution", "x^2 + C"),
    proof(key(3), "algebra", "proof", "elsewhere"), // other topic — excluded
  ];
  const out = publishedProofs(events, "calc");
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((p) => p.pubkey).sort(), [key(1), key(2)]);
  const p1 = out.find((p) => p.pubkey === key(1));
  assert.equal(p1.kind, "proof");
  assert.equal(p1.body, "By induction…");
});

test("publishedProofs: LATEST per signer wins (re-publish supersedes by created_at)", () => {
  const events = [
    proof(key(1), "calc", "proof", "first draft", 1),
    proof(key(1), "calc", "proof", "revised proof", 5), // newer — supersedes
  ];
  const out = publishedProofs(events, "calc");
  assert.equal(out.length, 1);
  assert.equal(out[0].body, "revised proof");
});

test("publishedProofs: ignores non-proof kinds, malformed content, wrong shape", () => {
  const events = [
    { pubkey: key(1), kind: 30078, created_at: 1, content: JSON.stringify({ plateau: "calc" }) }, // traversal
    { pubkey: key(2), kind: PROOF_KIND, created_at: 1, content: "not json" }, // malformed — skip
    {
      pubkey: key(3),
      kind: PROOF_KIND,
      created_at: 1,
      content: JSON.stringify({ plateau: "calc" }),
    }, // no body/kind — skip
    proof(key(4), "calc", "proof", "the only valid one"),
  ];
  const out = publishedProofs(events, "calc");
  assert.equal(out.length, 1);
  assert.equal(out[0].pubkey, key(4));
});

test("publishedProofs: empty / no-match → []; deterministic", () => {
  assert.deepEqual(publishedProofs([], "calc"), []);
  const events = [proof(key(2), "calc", "proof", "b"), proof(key(1), "calc", "proof", "a")];
  // sorted by pubkey, deterministic across calls
  assert.deepEqual(publishedProofs(events, "calc"), publishedProofs(events, "calc"));
  assert.deepEqual(
    publishedProofs(events, "calc").map((p) => p.pubkey),
    [key(1), key(2)],
  );
});
