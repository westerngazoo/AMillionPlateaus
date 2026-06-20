// events.js — the verified local event log; the SOURCE of reputation
// (SPEC-0010 §2.3, R-0010 AC3). Replaces the old `seedReputation` magnitude: a
// fresh key with an empty log has an EMPTY reputation and reaches nothing — reach
// is now earned from signed history, never gifted.
//
// Every event entering the log is gated through `verify_event` (wasm/Rust: id ==
// sha256(canonical) AND a valid BIP340 signature by the event's pubkey). An event
// that fails is dropped and contributes nothing (R-0010 AC2). Reputation is
// `recompute_reputation(log, myPubkey)` — the SAME `{domain_reps, synthesis}` JSON
// the fog queries already consume, recomputed deterministically by the unchanged
// GA engine in Rust. JS does no GA and no crypto here.
//
// The log is mirrored to localStorage (`mp.eventLog`) for THIS browser only; it is
// never written to the CRDT (CLAUDE.md §7). The wasm module and storage are
// INJECTED so this is unit-testable in node without a wasm runtime (R-0010 AC8).

export const LOG_KEY = "mp.eventLog";

// A fresh/empty log reaches nothing — the same shape the fog query parses, with no
// seed magnitude (the `synthesis` key defaults in the Rust parser).
export const EMPTY_REPUTATION = { domain_reps: {} };

function loadRaw(storage) {
  try {
    const raw = storage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/// Build the verified event log for `myPubkey`. Returns `{ add, reputation, all,
/// has, clear }`. The persisted mirror is re-verified on load so a hand-edited
/// `localStorage` cannot smuggle an unsigned event into `all()` (what we publish).
export function makeLog(wasm, myPubkey, storage) {
  // Re-verify the persisted mirror: only events that still pass survive (a tampered
  // mirror is silently pruned). Verification is in Rust; JS only ferries JSON.
  let evs = loadRaw(storage).filter(
    (e) => e && typeof e.id === "string" && wasm.verify_event(JSON.stringify(e)),
  );
  let seen = new Set(evs.map((e) => e.id));

  function persist() {
    try {
      storage.setItem(LOG_KEY, JSON.stringify(evs));
    } catch {
      // Quota/denied — the log stays authoritative in memory for this session.
    }
  }

  /// Verify-gate, dedupe by id, append, persist. Returns true iff it was added.
  function add(json) {
    if (!wasm.verify_event(json)) return false; // the ONLY trust gate (Rust BIP340)
    let ev;
    try {
      ev = JSON.parse(json);
    } catch {
      return false;
    }
    if (!ev || typeof ev.id !== "string" || seen.has(ev.id)) return false;
    evs.push(ev);
    seen.add(ev.id);
    persist();
    return true;
  }

  /// `{domain_reps, synthesis}` for `myPubkey`, recomputed from the verified log.
  /// Empty log ⇒ empty reputation (reaches nothing — no free seed).
  function reputation() {
    if (evs.length === 0) return { domain_reps: {} };
    try {
      return JSON.parse(wasm.recompute_reputation(JSON.stringify(evs), myPubkey));
    } catch {
      return { domain_reps: {} };
    }
  }

  return {
    add,
    reputation,
    all: () => evs.slice(),
    has: (id) => seen.has(id),
    clear() {
      evs = [];
      seen = new Set();
      persist();
    },
  };
}
