// identity.test.mjs — node --test, no wasm. Proves the mint/restore orchestration
// and the key-hygiene invariant (SPEC-0010 §2.3, R-0010 AC1). The crypto is faked;
// what is under test is the localStorage handling, NOT BIP340 (that is host-tested
// in mp-identity). Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { loadOrMintIdentity, SECRET_KEY } from "./identity.js";

// A stand-in for `WasmIdentity`: a fresh ctor mints a known secret/pubkey; the
// static `from_secret` rebuilds from a hex (and throws on the sentinel "bad").
class FakeIdentity {
  constructor() {
    this._secret = "minted-secret-hex";
    this._pub = "minted-pubkey";
  }
  static from_secret(hex) {
    if (hex === "bad") throw new Error("invalid secret hex");
    const id = Object.create(FakeIdentity.prototype);
    id._secret = hex;
    id._pub = `pub-of-${hex}`;
    return id;
  }
  pubkey() {
    return this._pub;
  }
  secret() {
    return this._secret;
  }
}
const wasm = { WasmIdentity: FakeIdentity };

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

test("mints a fresh key when none is stored, persisting ONLY the secret (AC1)", () => {
  const storage = fakeStorage();
  const id = loadOrMintIdentity(wasm, storage);
  assert.equal(id.pubkey(), "minted-pubkey");
  // The secret is persisted under exactly the one local key.
  assert.equal(storage.getItem(SECRET_KEY), "minted-secret-hex");
  assert.deepEqual([...storage._map.keys()], [SECRET_KEY]);
});

test("restores from the stored secret instead of minting (AC1)", () => {
  const storage = fakeStorage({ [SECRET_KEY]: "deadbeef" });
  const id = loadOrMintIdentity(wasm, storage);
  assert.equal(id.pubkey(), "pub-of-deadbeef");
  // No re-mint happened: the stored secret is untouched.
  assert.equal(storage.getItem(SECRET_KEY), "deadbeef");
});

test("a corrupt stored secret is discarded and a fresh key minted (AC1 robustness)", () => {
  const storage = fakeStorage({ [SECRET_KEY]: "bad" });
  const id = loadOrMintIdentity(wasm, storage);
  assert.equal(id.pubkey(), "minted-pubkey");
  assert.equal(storage.getItem(SECRET_KEY), "minted-secret-hex");
});

test("the pubkey is never persisted — only the secret key is (AC1/AC6 hygiene)", () => {
  const storage = fakeStorage();
  const id = loadOrMintIdentity(wasm, storage);
  const persisted = JSON.stringify([...storage._map.entries()]);
  assert.ok(!persisted.includes(id.pubkey()), "pubkey must not be written to storage");
  assert.ok(persisted.includes("minted-secret-hex"), "secret is the only persisted half");
});
