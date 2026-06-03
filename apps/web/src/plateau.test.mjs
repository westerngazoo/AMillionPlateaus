// plateau.test.mjs — node --test, no browser/wasm. Proves the pure buildPlateau
// factory (SPEC-0011 §2.2, R-0011 AC6). Run: `node --test apps/web/src/*.test.mjs`

import test from "node:test";
import assert from "node:assert/strict";

import { buildPlateau, PLATEAU_NAME_FALLBACK } from "./plateau.js";

// Valid domain ids from persona.js (hardcoded here to avoid test coupling to WASM)
const MATH = "11111111-1111-1111-1111-111111111111";
const MUSIC = "22222222-2222-2222-2222-222222222222";
const UNKNOWN = "00000000-0000-0000-0000-000000000000";

// ── success path ──────────────────────────────────────────────────────────────

test("valid input produces a normalised result with error: null (AC6)", () => {
  const p = buildPlateau({ name: "Arithmetic", domain: MATH, e1: 0.8, e2: 0, e3: 0 });
  assert.equal(p.error, null);
  assert.equal(p.name, "Arithmetic");
  assert.equal(p.domain, MATH);
  assert.equal(p.e1, 0.8);
  assert.equal(p.e2, 0);
  assert.equal(p.e3, 0);
});

test("result is deterministic for the same input (AC6)", () => {
  const a = buildPlateau({ name: "Rhythm", domain: MUSIC, e1: 0, e2: 0, e3: 0.9 });
  const b = buildPlateau({ name: "Rhythm", domain: MUSIC, e1: 0, e2: 0, e3: 0.9 });
  assert.deepEqual(a, b);
});

// ── name normalisation (AC1 / AC6) ───────────────────────────────────────────

test("blank name falls back to PLATEAU_NAME_FALLBACK", () => {
  const p = buildPlateau({ name: "   ", domain: MATH, e1: 1, e2: 0, e3: 0 });
  assert.equal(p.error, null);
  assert.equal(p.name, PLATEAU_NAME_FALLBACK);
});

test("name is trimmed", () => {
  const p = buildPlateau({ name: "  Topology  ", domain: MATH, e1: 1, e2: 0, e3: 0 });
  assert.equal(p.error, null);
  assert.equal(p.name, "Topology");
});

test("missing name falls back to PLATEAU_NAME_FALLBACK", () => {
  const p = buildPlateau({ domain: MATH, e1: 0, e2: 0.5, e3: 0 });
  assert.equal(p.error, null);
  assert.equal(p.name, PLATEAU_NAME_FALLBACK);
});

// ── error cases (AC5 / AC6) ───────────────────────────────────────────────────

test("unknown domain returns error (AC6)", () => {
  const p = buildPlateau({ name: "Test", domain: UNKNOWN, e1: 1, e2: 0, e3: 0 });
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

test("missing domain returns error", () => {
  const p = buildPlateau({ name: "Test", e1: 1, e2: 0, e3: 0 });
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

test("all-zero direction returns error (AC5 / AC6)", () => {
  const p = buildPlateau({ name: "Ghost", domain: MATH, e1: 0, e2: 0, e3: 0 });
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

test("NaN coordinate returns error (AC6 — non-finite guard)", () => {
  const p = buildPlateau({ name: "Ghost", domain: MATH, e1: NaN, e2: 0, e3: 0 });
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

test("Infinity coordinate returns error (AC6 — non-finite guard)", () => {
  const p = buildPlateau({ name: "Ghost", domain: MATH, e1: Infinity, e2: 0, e3: 0 });
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

test("empty call returns error (unknown domain)", () => {
  const p = buildPlateau();
  assert.ok(typeof p.error === "string" && p.error.length > 0);
});

// ── Music domain (AC2 — domain scoping) ──────────────────────────────────────

test("authored plateau in Music domain round-trips correctly", () => {
  const p = buildPlateau({ name: "Harmony", domain: MUSIC, e1: 0, e2: 0, e3: 0.9 });
  assert.equal(p.error, null);
  assert.equal(p.domain, MUSIC);
  assert.equal(p.e3, 0.9);
});
