// mastery.js — pure derivation of "topics I've mastered" from the verified
// signed-event log (R-0030 / SPEC-0030). No DOM, no wasm, no GA. The events
// passed in are ALREADY BIP340-verified by events.js makeLog; this just filters
// and parses them. Mastery is a completion claim, NOT reputation — recompute
// ignores KIND_MASTERY, so nothing here touches reach.

// MUST match mp_identity::KIND_MASTERY. Pinned at runtime by a
// `console.assert(mastery_kind() === MASTERY_KIND)` in main.js after init()
// (mirrors the doc-root-keys assert) — this module is node-tested and can't
// load wasm, so the cross-language pin lives in main.js.
export const MASTERY_KIND = 30080;

// MUST match mp_identity::KIND_TRAVERSAL (30078, shipped since R-0010). Pinned by
// a unit test (=== 30078), NOT a runtime wasm pin like MASTERY_KIND: there is no
// `traversal_kind()` accessor, adding one forces a wasm rebuild (breaking
// R-0033's JS-only scope), and 30078 is frozen since R-0010 (changing it would
// break every existing signed log). The JS assertion is an adequate drift-guard.
export const TRAVERSAL_KIND = 30078;

/**
 * The set of plateau ids `pubkey` has signed a (verified) mastery event for.
 * Pure + deterministic: only KIND_MASTERY events by that pubkey, content parsed
 * for `plateau`, deduped (a topic mastered twice appears once). Malformed
 * content or other kinds/pubkeys are skipped.
 */
export function masteredTopics(events = [], pubkey) {
  const out = new Set();
  for (const e of events) {
    if (!e || e.kind !== MASTERY_KIND || e.pubkey !== pubkey) continue;
    try {
      const plateau = JSON.parse(e.content)?.plateau;
      if (plateau) out.add(plateau);
    } catch {
      /* malformed content — skip */
    }
  }
  return out;
}

/**
 * Plateau ids `pubkey` has a (verified) traversal for — i.e. "studying/visited"
 * (R-0033). Pure sibling of masteredTopics. Traversal content carries an OPTIONAL
 * `plateau` (a positional-only traversal serializes `plateau: null`); a null is
 * safely skipped — the web app's signTraversal always passes the plateau id.
 */
export function visitedTopics(events = [], pubkey) {
  const out = new Set();
  for (const e of events) {
    if (!e || e.kind !== TRAVERSAL_KIND || e.pubkey !== pubkey) continue;
    try {
      const plateau = JSON.parse(e.content)?.plateau;
      if (plateau) out.add(plateau);
    } catch {
      /* malformed content — skip */
    }
  }
  return out;
}

// ── Community approval (R-0031 / SPEC-0031) ────────────────────────────────────
// A topic the crowd has mastered. Counted from the SAME verified corpus
// (own + discovered mastery events) — never the CRDT. Pubkey-AGNOSTIC, unlike
// masteredTopics. Raw distinct-pubkey count this phase (Sybil-resistant weighting
// by the master's reputation is a future Rust-side refinement, R-0031 §4).

// Distinct wizards a topic needs before it's community-approved (canonical).
// A wizard COUNT (R-0015's crystallize threshold is a Rust vote-weight sum; this
// has no GA semantics, so it lives in JS).
export const COMMUNITY_THRESHOLD = 3;

/** plateauId → number of DISTINCT pubkeys with a (verified) mastery event for it. */
export function masteryCounts(events = []) {
  const byTopic = new Map(); // plateauId → Set<pubkey>
  for (const e of events) {
    if (!e || e.kind !== MASTERY_KIND) continue;
    try {
      const plateau = JSON.parse(e.content)?.plateau;
      if (!plateau) continue;
      let who = byTopic.get(plateau);
      if (!who) byTopic.set(plateau, (who = new Set()));
      who.add(e.pubkey);
    } catch {
      /* malformed content — skip */
    }
  }
  const counts = new Map();
  for (const [plateau, who] of byTopic) counts.set(plateau, who.size);
  return counts;
}

/** Topics with ≥ `threshold` distinct masters — community-approved. Deterministic. */
export function communityApproved(events = [], threshold = COMMUNITY_THRESHOLD) {
  const out = new Set();
  for (const [plateau, n] of masteryCounts(events)) if (n >= threshold) out.add(plateau);
  return out;
}
