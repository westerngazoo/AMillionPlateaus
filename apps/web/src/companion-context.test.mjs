// companion-context.test.mjs — node --test, pure (SPEC-0007 §3, R-0007 AC3/AC6).
import test from "node:test";
import assert from "node:assert/strict";
import { buildGroundingContext } from "./companion-context.js";
import { assembleMessages, sendTurn } from "./companion.js";

const plateaus = [
  { id: "a1", name: "Arithmetic" },
  { id: "c1", name: "Rhythm" },
];
const bridges = [{ from: "a1", to: "c1", concept: "ratio" }];

const GEOMETER = { name: "The Geometer", domainLabel: "Mathematics", id: "geometer" };
const COMPOSER = { name: "The Composer", domainLabel: "Music", id: "composer" };

test("context names the persona, the lit set, and nearest — deterministically", () => {
  const args = {
    persona: GEOMETER,
    plateaus,
    reachableIds: new Set(["a1"]),
    nearest: [{ id: "a1", score: 0.16 }, { id: "c1", score: 0.008 }],
    bridges,
  };
  const ctx = buildGroundingContext(args);
  assert.match(ctx, /The Geometer/);
  assert.match(ctx, /in reach: Arithmetic/);
  assert.match(ctx, /Arithmetic \(0\.16\)/);
  // same inputs → identical output
  assert.equal(ctx, buildGroundingContext(args));
});

test("two personas (different reachable/nearest) yield different context (AC3)", () => {
  const geo = buildGroundingContext({
    persona: GEOMETER, plateaus, bridges,
    reachableIds: new Set(["a1"]), nearest: [{ id: "a1", score: 0.16 }],
  });
  const com = buildGroundingContext({
    persona: COMPOSER, plateaus, bridges,
    reachableIds: new Set(["c1"]), nearest: [{ id: "c1", score: 0.16 }],
  });
  assert.notEqual(geo, com);
});

test("a nearest id absent from the snapshot never renders 'undefined'", () => {
  const ctx = buildGroundingContext({
    persona: GEOMETER, plateaus, bridges,
    reachableIds: new Set(["a1"]),
    nearest: [{ id: "ghost", score: 0.99 }, { id: "a1", score: 0.16 }],
  });
  assert.doesNotMatch(ctx, /undefined/);
  assert.match(ctx, /Arithmetic \(0\.16\)/);
});

test("assembleMessages puts voice+grounding in the system message", () => {
  const msgs = assembleMessages("VOICE", "GROUND", [{ role: "user", content: "prev" }], "now");
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /VOICE/);
  assert.match(msgs[0].content, /GROUND/);
  assert.equal(msgs.at(-1).content, "now");
});

test("round-trip works against the real openai-compatible adapter with an injected fetch (AC4)", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ choices: [{ message: { content: "grounded reply" } }] }) };
  };
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "k" };
  const reply = await sendTurn(cfg, [{ role: "user", content: "hi" }], { fetch: fakeFetch });
  assert.equal(reply, "grounded reply");
  assert.equal(calls[0].url, "http://x/v1/chat/completions");
  assert.equal(calls[0].opts.headers.authorization, "Bearer k");
});

test("a non-ok HTTP response surfaces a graceful error (AC4)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "bad" };
  await assert.rejects(() => sendTurn(cfg, [{ role: "user", content: "hi" }], { fetch: fakeFetch }), /HTTP 401/);
});

test("a thrown fetch (CORS/offline) surfaces distinctly, not an HTTP error (AC4)", async () => {
  const fakeFetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "k" };
  await assert.rejects(() => sendTurn(cfg, [{ role: "user", content: "hi" }], { fetch: fakeFetch }), /CORS\/network/);
});

test("the fake provider is an always-available offline reply", async () => {
  const reply = await sendTurn({ kind: "fake", model: "offline" }, [{ role: "user", content: "echo me" }]);
  assert.match(reply, /echo me/);
});
