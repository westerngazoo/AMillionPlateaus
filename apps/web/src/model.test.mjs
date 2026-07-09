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
  // a LOCAL endpoint is usable with NO key (Ollama/LM Studio are keyless) —
  // regression guard: this used to fall back to offline on save (R-0049)
  assert.equal(isConfigured({ kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" }), true);
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

test("isLocalConfig: this-machine endpoints are local; hosted, fake and junk are not", async () => {
  const { isLocalConfig } = await import("./model.js");
  const local = { kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" };
  const loop = { kind: "openai-compatible", endpoint: "http://127.0.0.1:1234/v1", model: "m" };
  const hosted = { kind: "openai-compatible", endpoint: "https://api.groq.com/openai/v1", model: "m", apiKey: "k" };
  assert.equal(isLocalConfig(local), true);
  assert.equal(isLocalConfig(loop), true);
  assert.equal(isLocalConfig(hosted), false);
  assert.equal(isLocalConfig({ kind: "fake", model: "offline" }), false);
  assert.equal(isLocalConfig({ kind: "openai-compatible", endpoint: "not a url", model: "m" }), false);
  // a look-alike host must NOT count as local
  assert.equal(isLocalConfig({ kind: "openai-compatible", endpoint: "https://localhost.evil.test/v1", model: "m" }), false);
});

test("rememberSlot files usable configs by class, ignores fake/incomplete, never mutates", async () => {
  const { rememberSlot } = await import("./model.js");
  const local = { kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" };
  const hosted = { kind: "openai-compatible", endpoint: "https://api.groq.com/openai/v1", model: "m", apiKey: "k" };
  const s0 = { local: null, hosted: null };
  const s1 = rememberSlot(s0, local);
  const s2 = rememberSlot(s1, hosted);
  assert.equal(s2.local, local);
  assert.equal(s2.hosted, hosted);
  assert.deepEqual(s0, { local: null, hosted: null }, "input slots untouched");
  // fake and key-less hosted (unusable) change nothing
  assert.deepEqual(rememberSlot(s2, { kind: "fake", model: "offline" }), s2);
  assert.deepEqual(rememberSlot(s2, { kind: "openai-compatible", endpoint: "https://x/v1", model: "m" }), s2);
});

test("flipTarget crosses to the other side; offline prefers the cost-free local slot", async () => {
  const { flipTarget } = await import("./model.js");
  const local = { kind: "openai-compatible", endpoint: "http://localhost:11434/v1", model: "llama3.1" };
  const hosted = { kind: "openai-compatible", endpoint: "https://api.groq.com/openai/v1", model: "m", apiKey: "k" };
  const both = { local, hosted };
  assert.equal(flipTarget(both, local), hosted);
  assert.equal(flipTarget(both, hosted), local);
  assert.equal(flipTarget(both, { kind: "fake", model: "offline" }), local, "offline flips to the free side first");
  assert.equal(flipTarget({ local: null, hosted }, { kind: "fake" }), hosted, "…or hosted if no local was ever saved");
  assert.equal(flipTarget({ local: null, hosted: null }, hosted), null, "nothing saved → no flip offered");
  // a corrupt slot (e.g. hand-edited storage) is never offered
  assert.equal(flipTarget({ local: { kind: "openai-compatible" }, hosted: null }, hosted), null);
});

test("Groq ships as a key-bearing free-tier preset on the OpenAI-compatible adapter", () => {
  const g = PRESETS.find((p) => p.id === "groq-free");
  assert.ok(g, "a Groq preset exists");
  assert.equal(g.kind, "openai-compatible");
  assert.equal(g.needsKey, true);
  assert.equal(g.endpoint, "https://api.groq.com/openai/v1");
  // flows through the shared adapter: right URL, bearer auth, no anthropic header
  const req = buildRequest({ kind: g.kind, endpoint: g.endpoint, model: g.model, apiKey: "k" }, []);
  assert.equal(req.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer k");
  assert.equal("anthropic-dangerous-direct-browser-access" in req.headers, false);
});
