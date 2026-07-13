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

  // Google Gemini's NATIVE endpoint (R-0054). Needed because Google's NEW
  // "AQ."-prefixed API keys (the default AI Studio issues in 2026, replacing the
  // legacy "AIza" keys) currently FAIL on the OpenAI-compatibility endpoint with
  // "Invalid Auth key" / "Multiple authentication credentials received" — a
  // Google-acknowledged rollout bug. They DO work on the native REST surface,
  // which takes the key in an `x-goog-api-key` header (not Bearer) and speaks
  // Gemini's own request/response shape. This adapter converts the app's
  // OpenAI-style messages to `contents` + `systemInstruction` and back.
  "gemini-native": {
    label: "Google Gemini (native — for new AQ. keys)",
    needsKey: true,
    buildRequest(cfg, messages) {
      const base = String(cfg.endpoint).replace(/\/$/, "");
      const contents = [];
      const systemParts = [];
      for (const m of messages || []) {
        const parts = geminiParts(m.content);
        if (m.role === "system") {
          systemParts.push(...parts);
        } else {
          // Gemini roles are "user" / "model" (not "assistant").
          contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
        }
      }
      const body = { contents };
      if (systemParts.length) body.systemInstruction = { parts: systemParts };
      return {
        url: `${base}/models/${cfg.model}:generateContent`,
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify(body),
      };
    },
    parseResponse(json) {
      const parts = json?.candidates?.[0]?.content?.parts;
      return Array.isArray(parts) ? parts.map((p) => p?.text ?? "").join("") : "";
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
    // adapter reaches it with only a different base URL + key (free key at
    // aistudio.google.com/apikey), and its endpoint returns permissive CORS so
    // the browser calls it directly — no proxy. DEFAULT is `gemini-2.5-flash-lite`:
    // the flash variant with the BIGGEST free quota (~15 req/min, 1,000/day) —
    // 4× the daily headroom of plain 2.5-flash (~10/min, 250/day), so it is the
    // most 429-resistant free choice. Swap `model` to `gemini-2.5-flash` for
    // stronger answers if you don't hit the limit. NOTE: a RETIRED model id
    // answers 429 to EVERY request (gemini-2.0-flash died 2026-03-03) — a single
    // query 429ing usually means a stale saved id, not real quota; re-pick this
    // preset in Model setup and Save to overwrite it.
    id: "gemini-free",
    kind: "openai-compatible",
    label: "Google Gemini Flash (OLD AIza key — OpenAI-compat)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash-lite",
    needsKey: true,
  },
  {
    // The NATIVE Gemini endpoint (R-0054) — use this when AI Studio gave you a
    // NEW key that starts with "AQ." (Google's 2026 default). Those keys fail on
    // the OpenAI-compat preset above (a Google rollout bug) but work here, where
    // the key rides an `x-goog-api-key` header on the `:generateContent` REST
    // surface. `gemini-flash-latest` always points at the current free Flash.
    id: "gemini-native",
    kind: "gemini-native",
    label: "Google Gemini (NEW AQ. key — paste your key)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-flash-latest",
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

// Convert one OpenAI-style message `content` (a string, or a vision array of
// {type:"text"|"image_url"} parts) into Gemini native `parts`. A base64 data
// URI becomes an `inline_data` part (Gemini's vision shape); a non-data image
// URL degrades to a text mention (the native endpoint can't fetch a remote URL
// inline). Pure — used only by the gemini-native adapter.
export function geminiParts(content) {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? "") }];
  return content.map((part) => {
    if (part?.type === "text") return { text: part.text ?? "" };
    if (part?.type === "image_url") {
      const url = part.image_url?.url ?? "";
      const m = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (m) return { inline_data: { mime_type: m[1], data: m[2] } };
      return { text: `[image: ${url}]` };
    }
    return { text: "" };
  });
}

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
// decide whether the companion is "connected" (R-0007 AC1). A LOCAL endpoint
// never needs a key (Ollama/LM Studio are keyless) — without this exemption a
// keyless local save silently fell back to offline (bug found by R-0049 tests).
export function isConfigured(cfg) {
  if (!cfg || !PROVIDERS[cfg.kind]) return false;
  if (cfg.kind === "fake") return true;
  if (!cfg.endpoint || !cfg.model) return false;
  if (PROVIDERS[cfg.kind].needsKey && !cfg.apiKey && !isLocalConfig(cfg)) return false;
  return true;
}

// ── Local ⇄ hosted quick-switch (R-0049) ───────────────────────────────────
// The app remembers the last LOCAL config (a runtime on this machine — free)
// and the last HOSTED one (a pasted key — may cost money), so switching is one
// click with no re-pasting. Slots are plain data the UI persists next to the
// active config, under the SAME trust boundary: this browser only, never
// synced, never on the wire except as the request the active config builds
// (R-0007 AC5). All three functions are pure.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/** True iff the config points at a runtime on this machine (free to call). */
export function isLocalConfig(cfg) {
  if (!cfg || cfg.kind === "fake" || !cfg.endpoint) return false;
  try {
    return LOCAL_HOSTS.has(new URL(cfg.endpoint).hostname);
  } catch {
    return false;
  }
}

/** Store a just-saved usable config in its slot; fake/incomplete change nothing. */
export function rememberSlot(slots, cfg) {
  const next = { local: slots?.local ?? null, hosted: slots?.hosted ?? null };
  if (!isConfigured(cfg) || cfg.kind === "fake") return next;
  next[isLocalConfig(cfg) ? "local" : "hosted"] = cfg;
  return next;
}

/**
 * The config a flip would switch TO, or null when nothing is saved on the
 * other side. From local → the hosted slot; from hosted → the local slot.
 * From offline (fake) prefer LOCAL — the cost-free neighbour — falling back
 * to hosted only if no local runtime was ever saved.
 */
export function flipTarget(slots, cfg) {
  const usable = (c) => (c && isConfigured(c) ? c : null);
  if (isLocalConfig(cfg)) return usable(slots?.hosted);
  if (cfg?.kind === "fake") return usable(slots?.local) ?? usable(slots?.hosted);
  return usable(slots?.local);
}

export function visionMessages(imageDataUri, prompt) {
  return [{ role: "user", content: [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageDataUri } },
  ] }];
}

