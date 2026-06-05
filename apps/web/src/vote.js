// vote.js — pure. Validates a stone (a vote). No WASM, no GA.
//
// The VOTER ID is deliberately NOT derived here: it is the canonical
// `wizard_id_of(pubkey)` from Rust (UUIDv5 over the full pubkey) — the same id
// reputation and discovery key by — so a vote attaches to the wizard's REAL
// identity (R-0015 AC6). Do not hand-roll a pubkey→id mapping in JS; a truncated
// or otherwise different mapping would diverge from the canonical one and could
// collide. The single sanctioned path is the `wizard_id_of` wasm export.

// buildVote({ resource, weight }) → { resource, weight, error: null } | { error }.
// Requires a marker to vote on; weight must be a finite positive number (the
// slider guarantees this — the guard makes the pure unit total).
export function buildVote({ resource, weight } = {}) {
  if (!resource) return { error: "Pick a marker to place your stone on." };
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return { error: "Weight must be positive." };
  return { resource, weight: w, error: null };
}
