// identity.js — mint or restore the visitor's Nostr wizard identity
// (SPEC-0010 §2.3, R-0010 AC1).
//
// The SECRET key hex is persisted ONLY to localStorage (`mp.wizardSecret`), the
// same local-lens pattern as `mp.modelConfig`. It is NEVER synced, NEVER relayed,
// NEVER broadcast, NEVER placed in a URL, and NEVER logged. The PUBKEY (x-only
// hex) is the stable public wizard id and is the only half safe to display/share.
//
// Pure orchestration: all crypto lives in wasm (`WasmIdentity`). The wasm module
// and the storage are INJECTED so this is unit-testable in node without a wasm
// runtime or a browser (R-0010 AC8 — pure mapping, no network).

export const SECRET_KEY = "mp.wizardSecret";

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/// Return the visitor's `WasmIdentity`, restoring it from the locally-persisted
/// secret if present, else minting a fresh keypair and persisting ONLY its secret.
/// A corrupt/unparseable stored secret is discarded and a fresh key is minted, so
/// the world is always usable. `wasm` must expose the `WasmIdentity` class
/// (constructor + static `from_secret`); `storage` is a localStorage-like object.
export function loadOrMintIdentity(wasm, storage) {
  const saved = safeGet(storage, SECRET_KEY);
  if (saved) {
    try {
      return wasm.WasmIdentity.from_secret(saved);
    } catch {
      // Corrupt secret — fall through and mint a fresh one.
    }
  }
  const identity = new wasm.WasmIdentity();
  // Persist ONLY the secret hex, locally. Never the pubkey, never on any channel.
  try {
    storage.setItem(SECRET_KEY, identity.secret());
  } catch {
    // Storage denied/full — the identity still works for this session.
  }
  return identity;
}
