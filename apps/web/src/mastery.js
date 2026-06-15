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
