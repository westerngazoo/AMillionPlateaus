// resource.test.mjs — node --test, no browser/wasm. Proves the pure buildResource
// factory (SPEC-0014 §2.3, R-0014 AC6). Run: `node --test apps/web/src/*.test.mjs`

import test from "node:test";
import assert from "node:assert/strict";

import { buildResource, RESOURCE_KINDS, TITLE_FALLBACK } from "./resource.js";

const P = "00000000-0000-0000-0000-0000000000a1";

// ── success path ──────────────────────────────────────────────────────────────

test("valid input → ok, tagged error:null (AC6)", () => {
  const r = buildResource({ plateau: P, title: "Spectral theorem notes", kind: "Paper", uri: "https://ex.com" });
  assert.equal(r.error, null);
  assert.equal(r.plateau, P);
  assert.equal(r.title, "Spectral theorem notes");
  assert.equal(r.kind, "Paper");
  assert.equal(r.uri, "https://ex.com");
});

test("result is deterministic for the same input (AC6)", () => {
  const a = buildResource({ plateau: P, title: "n", kind: "Note", uri: "" });
  const b = buildResource({ plateau: P, title: "n", kind: "Note", uri: "" });
  assert.deepEqual(a, b);
});

test("title is trimmed; uri is trimmed", () => {
  const r = buildResource({ plateau: P, title: "  trimmed  ", kind: "Note", uri: "  https://x  " });
  assert.equal(r.title, "trimmed");
  assert.equal(r.uri, "https://x");
});

// ── normalisation / fallbacks (AC3/AC6) ─────────────────────────────────────────

test("blank title → TITLE_FALLBACK", () => {
  const r = buildResource({ plateau: P, title: "   ", kind: "Note" });
  assert.equal(r.error, null);
  assert.equal(r.title, TITLE_FALLBACK);
});

test("missing title → TITLE_FALLBACK", () => {
  const r = buildResource({ plateau: P, kind: "Note" });
  assert.equal(r.title, TITLE_FALLBACK);
});

test("unknown kind → Note (AC3)", () => {
  const r = buildResource({ plateau: P, title: "x", kind: "Sandwich" });
  assert.equal(r.kind, "Note");
});

test("blank/missing kind → Note (AC3)", () => {
  assert.equal(buildResource({ plateau: P, title: "x", kind: "" }).kind, "Note");
  assert.equal(buildResource({ plateau: P, title: "x" }).kind, "Note");
});

test("every RESOURCE_KIND is accepted verbatim", () => {
  for (const k of RESOURCE_KINDS) {
    assert.equal(buildResource({ plateau: P, title: "x", kind: k }).kind, k);
  }
});

test("empty uri is allowed (a note need not link)", () => {
  const r = buildResource({ plateau: P, title: "x", kind: "Note", uri: "" });
  assert.equal(r.error, null);
  assert.equal(r.uri, "");
});

test("missing uri normalises to empty string", () => {
  const r = buildResource({ plateau: P, title: "x", kind: "Note" });
  assert.equal(r.uri, "");
});

// ── error case (AC3/AC6) ─────────────────────────────────────────────────────────

test("missing plateau anchor → error (AC3)", () => {
  const r = buildResource({ title: "x", kind: "Note" });
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});

test("empty call → error (no plateau)", () => {
  const r = buildResource();
  assert.ok(typeof r.error === "string" && r.error.length > 0);
});
