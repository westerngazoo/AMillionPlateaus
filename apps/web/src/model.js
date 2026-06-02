// model.js — pure provider abstraction (SPEC-0007 §2.2, R-0007 AC1/AC4/AC6).
//
// Provider-agnostic, bring-your-own-model: one interface, concrete adapters
// swappable behind a `kind` field. This module is PURE — it builds the HTTP
// request descriptor and parses the response shape; it never calls `fetch`
// (that single impure edge lives in companion.js), which is what makes it
// node-unit-testable with no network.
//
// The app ships NO key. A hosted provider takes the visitor's own key; a local
// provider (Ollama/LM Studio/llama.cpp) needs none. The key, when present, only
// ever appears in the `authorization` header of the request this builds — it is
// never logged and never leaves the tab (R-0007 AC5).

export const PROVIDERS = {
  // One OpenAI-compatible `/chat/completions` shape spans hosted OpenAI-style
  // gateways AND local runtimes (Ollama, LM Studio, llama.cpp all expose it).
  // Only the base URL and key differ.
  "openai-compatible": {
    label: "OpenAI-compatible (hosted or local)",
    needsKey: true, // local endpoints may leave the key blank
    buildRequest(cfg, messages) {
      return {
        url: `${String(cfg.endpoint).replace(/\/$/, "")}/chat/completions`,
        headers: {
          "content-type": "application/json",
          ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: cfg.model, messages }),
      };
    },
    parseResponse(json) {
      return json?.choices?.[0]?.message?.content ?? "";
    },
  },

  // Deterministic, no network — the always-available offline reply so the UI
  // works before a model is configured, and a swappability fixture for tests.
  fake: {
    label: "Fake (offline / test)",
    needsKey: false,
    buildRequest(cfg, messages) {
      return { url: "fake://echo", headers: {}, body: messages };
    },
    parseResponse() {
      return "";
    },
  },
};

// Presets the setup screen offers (R-0007 AC1: ≥2 options including a local one).
// A local default needing no key, plus a blank hosted slot for a BYO key.
export const PRESETS = [
  {
    id: "local-ollama",
    kind: "openai-compatible",
    label: "Local — Ollama",
    endpoint: "http://localhost:11434/v1",
    model: "llama3.1",
    needsKey: false,
  },
  {
    id: "hosted",
    kind: "openai-compatible",
    label: "Hosted — bring your key",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
  },
];

export function buildRequest(cfg, messages) {
  const p = PROVIDERS[cfg.kind];
  if (!p) throw new Error(`unknown provider kind: ${cfg.kind}`);
  return p.buildRequest(cfg, messages);
}

export function parseResponse(cfg, json) {
  const p = PROVIDERS[cfg.kind];
  if (!p) throw new Error(`unknown provider kind: ${cfg.kind}`);
  return p.parseResponse(json);
}

// A config is usable iff it names a known provider with an endpoint+model, and
// supplies a key when the provider needs one. The setup screen uses this to
// decide whether the companion is "connected" (R-0007 AC1).
export function isConfigured(cfg) {
  if (!cfg || !PROVIDERS[cfg.kind]) return false;
  if (cfg.kind === "fake") return true;
  if (!cfg.endpoint || !cfg.model) return false;
  if (PROVIDERS[cfg.kind].needsKey && !cfg.apiKey) return false;
  return true;
}
