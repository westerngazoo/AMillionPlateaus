// model.test.mjs — node --test, pure, no network (SPEC-0007 §3, R-0007 AC6).
import test from "node:test";
import assert from "node:assert/strict";
import { buildRequest, parseResponse, isConfigured, PROVIDERS, PRESETS } from "./model.js";

test("openai-compatible builds a /chat/completions POST with bearer auth", () => {
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "k" };
  const req = buildRequest(cfg, [{ role: "user", content: "hi" }]);
  assert.equal(req.url, "http://x/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer k");
  assert.match(req.body, /"model":"m"/);
});

test("trailing slash on endpoint is normalized", () => {
  const cfg = { kind: "openai-compatible", endpoint: "http://x/v1/", model: "m" };
  assert.equal(buildRequest(cfg, []).url, "http://x/v1/chat/completions");
});

test("local endpoint omits the auth header when no key", () => {
  const cfg = { kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" };
  assert.equal("authorization" in buildRequest(cfg, []).headers, false);
});

test("Anthropic endpoint gets the browser-access opt-in header; others don't", () => {
  const claude = { kind: "openai-compatible", endpoint: "https://api.anthropic.com/v1", model: "claude-sonnet-5", apiKey: "k" };
  assert.equal(buildRequest(claude, []).headers["anthropic-dangerous-direct-browser-access"], "true");
  const openai = { kind: "openai-compatible", endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: "k" };
  assert.equal("anthropic-dangerous-direct-browser-access" in buildRequest(openai, []).headers, false);
  // hostname match must be exact — a look-alike host must NOT get the header
  const evil = { kind: "openai-compatible", endpoint: "https://api.anthropic.com.evil.test/v1", model: "x", apiKey: "k" };
  assert.equal("anthropic-dangerous-direct-browser-access" in buildRequest(evil, []).headers, false);
});

test("parseResponse extracts assistant text; missing → empty string", () => {
  const cfg = { kind: "openai-compatible" };
  assert.equal(parseResponse(cfg, { choices: [{ message: { content: "ok" } }] }), "ok");
  assert.equal(parseResponse(cfg, {}), "");
});

test("providers are swappable behind one interface", () => {
  for (const k of Object.keys(PROVIDERS)) {
    assert.equal(typeof PROVIDERS[k].buildRequest, "function");
    assert.equal(typeof PROVIDERS[k].parseResponse, "function");
  }
});

test("an unknown provider kind throws (no silent misroute)", () => {
  assert.throws(() => buildRequest({ kind: "nope" }, []), /unknown provider/);
});

test("isConfigured gates on endpoint/model and key-when-needed", () => {
  assert.equal(isConfigured(null), false);
  assert.equal(isConfigured({ kind: "fake" }), true); // offline fallback is always usable
  assert.equal(isConfigured({ kind: "openai-compatible", endpoint: "http://x/v1", model: "m" }), false); // hosted needs a key
  assert.equal(isConfigured({ kind: "openai-compatible", endpoint: "http://x/v1", model: "m", apiKey: "k" }), true);
});

test("presets offer at least two options including a key-less local one", () => {
  assert.ok(PRESETS.length >= 2);
  assert.ok(PRESETS.some((p) => p.needsKey === false), "a local, key-less preset exists");
  assert.ok(PRESETS.some((p) => p.needsKey === true), "a hosted, key-bearing preset exists");
});

test("LM Studio ships as a key-less local preset on the OpenAI-compatible adapter", () => {
  const lm = PRESETS.find((p) => p.id === "local-lmstudio");
  assert.ok(lm, "an LM Studio preset exists");
  assert.equal(lm.kind, "openai-compatible");
  assert.equal(lm.needsKey, false);
  assert.match(lm.endpoint, /:1234\/v1$/); // LM Studio's default server port
  // and it flows through the shared adapter with no auth header (local, no key)
  const req = buildRequest({ kind: lm.kind, endpoint: lm.endpoint, model: lm.model }, []);
  assert.equal(req.url, "http://localhost:1234/v1/chat/completions");
  assert.equal("authorization" in req.headers, false);
});

test("the Gemini preset points at a LIVE free-tier model (a retired id 429s everything)", () => {
  const g = PRESETS.find((p) => p.id === "gemini-free");
  assert.ok(g, "the Gemini preset exists");
  assert.notEqual(g.model, "gemini-2.0-flash", "retired 2026-03-03 — answered 429 to every request");
  assert.match(g.model, /^gemini-2\.5-|^gemini-3/, "a current free-tier generation");
});

test("httpHint explains the statuses a BYO-key learner actually hits", async () => {
  const { httpHint } = await import("./companion.js");
  assert.match(httpHint(429), /rate\/quota/);
  assert.match(httpHint(429), /retired/); // the gemini-2.0-flash lesson
  assert.match(httpHint(401), /key rejected/);
  assert.match(httpHint(404), /retired/);
  assert.match(httpHint(500), /outage/);
  assert.equal(httpHint(418), "");
});
