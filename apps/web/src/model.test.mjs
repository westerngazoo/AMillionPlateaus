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
