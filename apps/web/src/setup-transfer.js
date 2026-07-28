// setup-transfer.js — move your WHOLE device setup in one paste (R-0102). Pure.
//
// Your DATA syncs through git (world snapshot + profile/state.json). But the
// things that CANNOT go in git — your wizard secret key, your GitHub sync token,
// your model API keys, relay URLs — still had to be re-entered by hand on every
// device. On an e-ink Boox that's painful.
//
// This bundles exactly those secret/device keys into ONE opaque blob you move
// device-to-device YOURSELF (copy on one device, paste into the next). It is the
// complement of profile.js:
//   • profile.js  → your data,   git-synced,   secrets EXCLUDED by construction.
//   • setup-transfer → your secrets+device config, moved BY HAND, NEVER git-synced.
// Together they are your whole self. The blob is never pushed to a repo, never
// sent to a server, never logged — the caller reveals it for copy and clears it.
//
// SECURITY: this blob contains your token and keys. Anyone who gets it can act as
// you AND read/write your repo. It is a password. The UI warns accordingly and the
// blob only ever exists in a textarea the user copies, then hides.

// The secret + device-local keys to carry. This is exactly profile.js's NEVER_SYNC
// set minus `mp.tutorialSeen` (trivial UI state not worth moving). Kept in sync
// deliberately: what git must never hold is exactly what you move by hand.
export const SETUP_KEYS = [
  "mp.wizardSecret", // your identity secret key
  "mp.notesSync", // sync repo + GitHub/Gitea token + server
  "mp.modelConfig", // active model provider + API key
  "mp.modelSlots", // saved model configs (API keys)
  "mp.relayUrl", // Scan-Note relay (device config)
  "mp.pairRelayUrl", // live-sync pairing relay (device config)
  "mp.peers", // followed peers (some carry read tokens)
];

export const SETUP_PREFIX = "MPSETUP1.";
export const SETUP_V = 1;

// UTF-8 ⇄ base64 that works in both the browser and node (TextEncoder/atob/btoa
// exist in both). Chunked to stay clear of call-stack limits on large blobs.
function bytesToB64(bytes) {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Read the setup keys out of a localStorage-like store as their RAW string values
 * (so a round-trip writes back byte-identical — no reserialize drift). Returns
 * `{ v, keys: { "mp.foo": "<raw string>", … } }` for present keys only. Pure.
 */
export function buildSetup(storage) {
  const keys = {};
  for (const k of SETUP_KEYS) {
    let raw;
    try {
      raw = storage.getItem(k);
    } catch {
      raw = null;
    }
    if (raw != null) keys[k] = raw;
  }
  return { v: SETUP_V, keys };
}

/** Encode a setup object into one paste-safe, whitespace-free blob string. */
export function encodeSetup(setup) {
  const json = JSON.stringify(setup);
  const b64 = bytesToB64(new TextEncoder().encode(json));
  return SETUP_PREFIX + b64;
}

/**
 * Decode a blob back to `{ v, keys }`, or null if it isn't one of ours / is
 * corrupt / is from a newer schema. Tolerates surrounding whitespace from a sloppy
 * paste. Only recognised SETUP_KEYS are kept — a hand-edited blob can't smuggle in
 * an arbitrary localStorage key.
 */
export function decodeSetup(blob) {
  if (typeof blob !== "string") return null;
  const trimmed = blob.trim();
  if (!trimmed.startsWith(SETUP_PREFIX)) return null;
  let obj;
  try {
    const bytes = b64ToBytes(trimmed.slice(SETUP_PREFIX.length));
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  if (Number.isFinite(obj.v) && obj.v > SETUP_V) return null; // newer app wrote it
  if (!obj.keys || typeof obj.keys !== "object") return null;
  const keys = {};
  for (const k of SETUP_KEYS) {
    if (typeof obj.keys[k] === "string") keys[k] = obj.keys[k];
  }
  return { v: SETUP_V, keys };
}

/**
 * Write a decoded setup's raw values into a localStorage-like store. Only
 * SETUP_KEYS are written. Returns the keys actually changed, so the caller can
 * decide to reload (the app reads this config at module init).
 */
export function applySetup(setup, storage) {
  const keys = (setup && setup.keys) || {};
  const changed = [];
  for (const k of SETUP_KEYS) {
    if (typeof keys[k] !== "string") continue;
    let prev = null;
    try {
      prev = storage.getItem(k);
    } catch {
      prev = null;
    }
    if (keys[k] !== prev) {
      try {
        storage.setItem(k, keys[k]);
        changed.push(k);
      } catch {
        /* quota / private mode — skip; other keys still apply */
      }
    }
  }
  return changed;
}

/**
 * The wizard secret hex carried by a decoded setup (or ""). The UI validates it
 * against the wasm identity before applying, so a blob with a junk key is rejected
 * before it overwrites this device's identity.
 */
export function setupSecret(setup) {
  const v = setup && setup.keys && setup.keys["mp.wizardSecret"];
  return typeof v === "string" ? v.trim() : "";
}

/** Human summary of what a blob will bring over — shown before the user commits. */
export function describeSetup(setup) {
  const keys = (setup && setup.keys) || {};
  const has = (k) => typeof keys[k] === "string" && keys[k].length > 0;
  const parts = [];
  if (has("mp.wizardSecret")) parts.push("your identity");
  if (has("mp.notesSync")) parts.push("sync repo + token");
  if (has("mp.modelConfig") || has("mp.modelSlots")) parts.push("model setup");
  if (has("mp.relayUrl") || has("mp.pairRelayUrl")) parts.push("relays");
  if (has("mp.peers")) parts.push("followed wizards");
  return parts.length ? parts.join(", ") : "nothing";
}
