// proofs.js — pure derivation of "published proofs for a topic" from the verified
// signed-event log (R-0036 / SPEC-0036). No DOM, no wasm, no GA. The events passed
// in are ALREADY BIP340-verified by events.js makeLog; this filters and parses them.
// A published proof is a shareable completion ARTIFACT, not reputation — recompute
// ignores KIND_PROOF, so nothing here touches reach (mirrors mastery.js).

// MUST match mp_identity::KIND_PROOF. Pinned at runtime by a
// `console.assert(proof_kind() === PROOF_KIND)` in main.js after init() (mirrors
// MASTERY_KIND) — this module is node-tested and can't load wasm.
export const PROOF_KIND = 30081;

/**
 * Published proofs for `plateauId`, derived from the verified corpus →
 * `[{ pubkey, kind, body }]`. Only KIND_PROOF events whose parsed content names this
 * topic; the LATEST per signer wins (by `created_at`, so a re-publish supersedes an
 * earlier one); malformed content or other kinds are skipped; sorted by pubkey for a
 * deterministic order. Pure + deterministic. The `body`/`kind` are UNTRUSTED peer text —
 * the caller MUST render `body` via the safe renderer and `kind`/attribution via
 * textContent (never innerHTML).
 */
export function publishedProofs(events = [], plateauId) {
  const latest = new Map(); // pubkey → { pubkey, kind, body, created_at }
  for (const e of events) {
    if (!e || e.kind !== PROOF_KIND) continue;
    let parsed;
    try {
      parsed = JSON.parse(e.content);
    } catch {
      continue; // malformed content — skip
    }
    if (!parsed || parsed.plateau !== plateauId) continue;
    if (typeof parsed.body !== "string" || typeof parsed.kind !== "string") continue;
    const at = typeof e.created_at === "number" ? e.created_at : 0;
    const prev = latest.get(e.pubkey);
    if (!prev || at >= prev.created_at) {
      latest.set(e.pubkey, {
        pubkey: e.pubkey,
        kind: parsed.kind,
        body: parsed.body,
        created_at: at,
      });
    }
  }
  return [...latest.values()]
    .map(({ pubkey, kind, body }) => ({ pubkey, kind, body }))
    .sort((a, b) => (a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0));
}
