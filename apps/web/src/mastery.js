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

// ── Community approval (R-0031 / SPEC-0031, weighted by R-0035 / SPEC-0035) ─────
// A topic the crowd has mastered. Derived from the SAME verified corpus (own +
// discovered mastery events) — never the CRDT. Pubkey-AGNOSTIC, unlike
// masteredTopics. R-0035 weights each distinct master by their EARNED REACH (the
// grade-1 magnitude of their GA reputation in the topic's domain): a topic is
// approved when the summed reach clears a bar, so a vouch-ring Sybil (grade-0,
// reach ≈ 0) cannot manufacture approval by minting keys. The reach source is
// INJECTED (this module stays pure/wasm-free); the default unit weight + count
// bar reproduce R-0031's head-count.

// The DEFAULT bar when weights are unit (head-count) — a wizard COUNT (R-0015's
// crystallize threshold is a Rust vote-weight sum; this has no GA semantics, so
// it lives in JS). The app passes a calibrated REACH bar instead (R-0035).
export const COMMUNITY_THRESHOLD = 3;

/** plateauId → Set<pubkey> of (verified) masters. The shared dedup: a topic
 *  mastered twice by one wizard counts that wizard once. Pure. */
function mastersByTopic(events = []) {
  const byTopic = new Map();
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
  return byTopic;
}

/** plateauId → number of DISTINCT pubkeys with a (verified) mastery event for it.
 *  Unchanged R-0031 surface — kept for the "N mastered" display. */
export function masteryCounts(events = []) {
  const counts = new Map();
  for (const [plateau, who] of mastersByTopic(events)) counts.set(plateau, who.size);
  return counts;
}

/**
 * Community-approved topics, WEIGHTED by each master's earned reach (R-0035). For
 * each topic, sum `weightOf(pubkey, domainOf(topic))` over its DISTINCT masters and
 * approve when the sum ≥ `bar`. Pure + deterministic — the reach source is INJECTED:
 *   - `weightOf(pubkey, domainId) → number`  a master's grade-1 reach in that domain (default 1)
 *   - `domainOf(plateauId) → domainId`        the topic's domain (default undefined)
 * A weight that is absent / NaN / ≤ 0 contributes 0 — a Sybil or unknown master
 * never adds AND never subtracts (approval is monotonic in real reach). The
 * defaults (unit weight, `bar = COMMUNITY_THRESHOLD`) reproduce R-0031's head-count.
 */
export function communityApproved(events = [], opts = {}) {
  const { bar = COMMUNITY_THRESHOLD, weightOf = () => 1, domainOf = () => undefined } = opts;
  const out = new Set();
  for (const [plateau, who] of mastersByTopic(events)) {
    const domain = domainOf(plateau);
    let sum = 0;
    for (const pk of who) {
      const w = weightOf(pk, domain);
      if (Number.isFinite(w) && w > 0) sum += w; // clamp: absent/NaN/≤0 ⇒ 0
    }
    if (sum >= bar) out.add(plateau);
  }
  return out;
}
