// profile.js — sync your WHOLE self under one user (R-0101). Pure.
//
// The graph (R-0081) and notes (R-0075) already sync to your repo, but everything
// else — your progress, your annotations, the lenses you adopted, your persona —
// sat in localStorage on ONE device. This bundles all of that personal state into
// one file, `profile/state.json`, alongside the world snapshot, so it travels with
// you. Merged additively across devices (never clobbers), pulled at boot, backed
// up automatically.
//
// TWO hard rules, enforced by the allow-list below and a test:
//   1. SECRETS NEVER LEAVE. Your wizard secret key, API keys, your GitHub sync
//      token and follow tokens are NOT in the synced set. The secret key IS your
//      identity — to be "you" on another device you move it yourself (R-0101 Part
//      B: export/import), it is never written to git.
//   2. Device config stays local. Relay URLs, the followed-peer list, tutorial
//      state describe THIS device's setup, not you — they don't sync.
//
// notesSync/privateNotes are handled by their own R-0075 channel (markdown files),
// so they are deliberately absent here — syncing them twice would fight.

// The personal state that travels with you. Add a new key here ONLY if it is
// yours-not-the-device's and contains no secret.
export const PROFILE_KEYS = [
  "mp.eventLog", // signed mastery/traversal/proof events — your PROGRESS (pubkey only, no secret)
  "mp.lessonProgress", // Teach-me progress per topic
  "mp.pretest", // pretest answers/state
  "mp.fade", // faded-derivation progress
  "mp.reviewQueue", // SM-2 spaced review
  "mp.confusions", // "I don't get this" marks
  "mp.prereqs", // prerequisites you added (R-0100)
  "mp.paths", // curriculum paths (incl. authored)
  "mp.domains", // custom / adopted lenses (R-0038 / R-0093)
  "mp.authoredPersona", // your persona
  "mp.privateShelf", // per-plateau private resources
  "mp.proofs", // saved proofs / solutions
  "mp.unwired", // capture inbox
  "mp.baton", // R-0105 "I'm on this topic" pointer, so another device can open its notes
];

// Keys that MUST NEVER be written into the synced profile. The test asserts these
// never appear; collectProfile only ever reads PROFILE_KEYS, so this is defence in
// depth for the day someone adds a key to the wrong list.
export const NEVER_SYNC = [
  "mp.wizardSecret", // the secret key — your identity; moved by you, never git
  "mp.modelConfig", // model provider + API key
  "mp.modelSlots", // saved model configs (API keys)
  "mp.notesSync", // repo + GitHub token
  "mp.peers", // followed peers, some carrying read tokens
  "mp.relayUrl", // device config
  "mp.pairRelayUrl", // device config
  "mp.tutorialSeen", // device UI state
];

export const PROFILE_FILE = "profile/state.json";
export const PROFILE_V = 1;

const isPlainObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

/**
 * Read the syncable state out of a localStorage-like store. Returns
 * `{ v, keys: { "mp.foo": <parsed value>, … } }` for the PROFILE_KEYS that are
 * present and parseable. Never touches a NEVER_SYNC key. Pure w.r.t. `storage`.
 */
export function collectProfile(storage) {
  const keys = {};
  for (const k of PROFILE_KEYS) {
    let raw;
    try {
      raw = storage.getItem(k);
    } catch {
      raw = null;
    }
    if (raw == null) continue;
    try {
      keys[k] = JSON.parse(raw);
    } catch {
      /* a corrupt local value is skipped rather than synced as junk */
    }
  }
  return { v: PROFILE_V, keys };
}

// Union two arrays, deduping by a stable key: an element's `id` when it has one
// (signed events, lens domains), else its JSON. Order: local first, then the
// remote elements local lacks — so local never loses an entry.
function unionArrays(local, remote) {
  const keyOf = (x) =>
    x && typeof x === "object" && x.id != null ? `id:${x.id}` : `j:${JSON.stringify(x)}`;
  const seen = new Set(local.map(keyOf));
  const out = [...local];
  for (const x of remote) if (!seen.has(keyOf(x))) out.push(x);
  return out;
}

/**
 * Additive deep merge, local-wins. Arrays union (dedup by id/JSON); objects merge
 * key-by-key (remote fills what local lacks, shared keys merge recursively);
 * scalars/type-mismatches keep local unless it is undefined. So a merge can only
 * ADD to what a device already has — progress and annotations are never lost, and
 * two devices editing different topics both keep their work.
 */
export function deepMergeUnion(local, remote) {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (Array.isArray(local) && Array.isArray(remote)) return unionArrays(local, remote);
  if (isPlainObject(local) && isPlainObject(remote)) {
    const out = { ...local };
    for (const k of Object.keys(remote)) {
      out[k] = k in local ? deepMergeUnion(local[k], remote[k]) : remote[k];
    }
    return out;
  }
  return local; // scalar or mismatched types — the current device wins
}

/**
 * Merge two profiles into one, per key. A key only one side has is carried over;
 * a shared key is deep-merged. Ignores any non-PROFILE key that somehow appears in
 * the input (a stale or hand-edited file can't smuggle secrets back in).
 */
export function mergeProfile(localProfile, remoteProfile) {
  const a = (localProfile && localProfile.keys) || {};
  const b = (remoteProfile && remoteProfile.keys) || {};
  const keys = {};
  for (const k of PROFILE_KEYS) {
    const inA = k in a;
    const inB = k in b;
    if (inA && inB) keys[k] = deepMergeUnion(a[k], b[k]);
    else if (inA) keys[k] = a[k];
    else if (inB) keys[k] = b[k];
  }
  return { v: PROFILE_V, keys };
}

/**
 * Write a profile's values back into a localStorage-like store, as JSON. Only
 * PROFILE_KEYS are written; anything else in the object is ignored. Returns the
 * list of keys actually changed (so the caller can decide whether a reload is
 * needed to pick the new state up).
 */
export function applyProfile(profile, storage) {
  const keys = (profile && profile.keys) || {};
  const changed = [];
  for (const k of PROFILE_KEYS) {
    if (!(k in keys)) continue;
    const next = JSON.stringify(keys[k]);
    let prev = null;
    try {
      prev = storage.getItem(k);
    } catch {
      prev = null;
    }
    if (next !== prev) {
      try {
        storage.setItem(k, next);
        changed.push(k);
      } catch {
        /* quota / private mode — skip, the merge still holds in memory */
      }
    }
  }
  return changed;
}

/**
 * A stable fingerprint of the syncable state, for a cheap "has anything changed
 * since the last push?" check. Canonical key order so it doesn't flap.
 */
export function profileFingerprint(profile) {
  const keys = (profile && profile.keys) || {};
  const ordered = {};
  for (const k of PROFILE_KEYS) if (k in keys) ordered[k] = keys[k];
  return JSON.stringify(ordered);
}

/** Parse a profile file's text; null if unusable or from a newer schema. */
export function parseProfile(text) {
  let j;
  try {
    j = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  if (Number.isFinite(j.v) && j.v > PROFILE_V) return null; // written by a newer app
  if (!isPlainObject(j.keys)) return null;
  return { v: PROFILE_V, keys: j.keys };
}
