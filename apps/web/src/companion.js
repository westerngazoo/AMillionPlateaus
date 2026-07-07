// companion.js — orchestration: the single impure edge (SPEC-0007 §2.2, R-0007 AC4).
//
// Pure pieces live in model.js / companion-context.js / companion-voice.js. This
// module owns the ONE `fetch` and the message assembly. `fetch` is injectable
// (`deps.fetch`) so the round-trip is testable with a fake fetch — the real
// `openai-compatible` adapter's buildRequest → fetch → parseResponse path is
// exercised without a network.

import { buildRequest, parseResponse } from "./model.js";

// Assemble the chat messages: a system message (persona voice + graph grounding),
// the prior turns, then the new user message. Pure.
export function assembleMessages(voice, grounding, history, userText) {
  return [
    { role: "system", content: `${voice}\n${grounding}` },
    ...history,
    { role: "user", content: userText },
  ];
}

// Send one turn. The `kind === "fake"` short-circuit is the always-available
// OFFLINE reply (no model configured); it does NOT stand in for transport. Real
// transport fidelity is proven against the openai-compatible adapter with an
// injected fake `fetch` (see model + companion tests).
export async function sendTurn(cfg, messages, deps = { fetch: globalThis.fetch }) {
  if (cfg.kind === "fake") {
    return `(${cfg.model || "offline"}) I hear you: "${messages.at(-1).content}". Configure a model to go deeper.`;
  }
  const req = buildRequest(cfg, messages);
  let res;
  try {
    res = await deps.fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
  } catch (e) {
    // A thrown fetch rejection is CORS / DNS / offline (no response object).
    // Surface it distinctly from an HTTP-status error; both are caught by the UI.
    throw new Error(`model unreachable (CORS/network): ${e.message}`);
  }
  if (!res.ok) throw new Error(`model HTTP ${res.status}`);
  return parseResponse(cfg, await res.json());
}

export async function sendVisionTurn(cfg, messages, deps = { fetch: globalThis.fetch }) {
  if (cfg.kind === "fake") {
    return `(${cfg.model || "offline"}) [Image received] I see your image. Configure a multimodal model to read it.`;
  }
  const req = buildRequest(cfg, messages);
  let res;
  try {
    res = await deps.fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
  } catch (e) {
    throw new Error(`model unreachable (CORS/network): ${e.message}`);
  }
  if (!res.ok) throw new Error(`model HTTP ${res.status}`);
  return parseResponse(cfg, await res.json());
}
