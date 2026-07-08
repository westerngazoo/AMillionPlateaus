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
      const base = String(cfg.endpoint).replace(/\/$/, "");
      const headers = {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      };
      // Anthropic's OpenAI-compatible endpoint requires an explicit opt-in header
      // to permit a direct browser (CORS) call with the visitor's own key. Keyed
      // off the endpoint so no config plumbing is needed — Gemini/OpenAI/Ollama
      // are unaffected. (The key still only ever rides this header set, R-0007 AC5.)
      if (/(^|\.)api\.anthropic\.com$/i.test(new URL(base).hostname)) {
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
      return {
        url: `${base}/chat/completions`,
        headers,
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
// A local key-less default, a free hosted tier, and a generic BYO-key slot.
export const PRESETS = [
  {
    id: "local-ollama",
    kind: "openai-compatible",
    label: "Local — Ollama (open-source, no key, fully offline)",
    endpoint: "http://localhost:11434/v1",
    model: "llama3.1",
    needsKey: false,
  },
  {
    // LM Studio serves the SAME OpenAI-compatible surface as Ollama, on port 1234
    // by default (Developer tab → Start Server), no key, fully offline. `model` is
    // whatever you've loaded in LM Studio — swap it for that model's identifier
    // (shown next to the loaded model); recent LM Studio also routes any id to the
    // loaded model. Same adapter, different base URL — nothing else to wire.
    id: "local-lmstudio",
    kind: "openai-compatible",
    label: "Local — LM Studio (no key, fully offline)",
    endpoint: "http://localhost:1234/v1",
    model: "llama-3.2-3b-instruct",
    needsKey: false,
  },
  {
    // Google exposes an OpenAI-compatible surface for Gemini, so the same
    // adapter reaches it with only a different base URL + key. The free AI
    // Studio tier (aistudio.google.com/apikey) is generous enough for study
    // (2.5-flash: 10 req/min, 250/day), and its endpoint returns permissive
    // CORS headers, so the browser can call it directly — no proxy. Swap
    // `model` for any Gemini you can access — `gemini-2.5-flash-lite` has the
    // biggest free quota (15/min, 1000/day). NOTE: a RETIRED model id answers
    // 429 for every request (gemini-2.0-flash died 2026-03-03 and shipped here
    // as the default — every Gemini connect looked "rate limited").
    id: "gemini-free",
    kind: "openai-compatible",
    label: "Google Gemini (free tier — paste a free key)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    needsKey: true,
  },
  {
    // Groq's developer tier is free with NO card (console.groq.com) and beats
    // Gemini's free tier for study chat: 30 req/min + 1,000/day (vs 10/250),
    // on very fast LPU inference. OpenAI-compatible + CORS-open (verified with
    // a live preflight against this app's origin), so browser-direct works.
    // Swap `model` for any you can access — llama-4-scout has a bigger daily
    // token budget; llama-3.3-70b answers stronger per token.
    id: "groq-free",
    kind: "openai-compatible",
    label: "Groq (free tier, fast — paste a free key)",
    endpoint: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    needsKey: true,
  },
  {
    // Anthropic exposes an OpenAI-compatible surface for Claude, reachable from
    // the browser once the adapter sends the anthropic-dangerous-direct-browser-
    // access header (buildRequest adds it for this host). Swap `model` for any
    // Claude you have access to (claude-opus-4-8, claude-haiku-4-5, …).
    id: "claude",
    kind: "openai-compatible",
    label: "Anthropic Claude (paste your key)",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-sonnet-5",
    needsKey: true,
  },
  {
    id: "hosted",
    kind: "openai-compatible",
    label: "Other hosted (OpenAI-style) — bring your key",
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

export function visionMessages(imageDataUri, prompt) {
  return [{ role: "user", content: [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageDataUri } },
  ] }];
}

