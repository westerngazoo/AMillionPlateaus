// persistence.test.mjs — node --test, no browser. Proves the IndexedDB snapshot
// store (SPEC-0012 §2.3, R-0012 AC8): put/get round-trip, debounce coalesce,
// explicit flush, the no-IndexedDB fallback, and that every error resolves
// safely. The `idb` is a hand-rolled in-memory fake (NO fake-indexeddb npm dep —
// the repo has none) and `schedule` is injected to drive the debounce
// deterministically. Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { createSnapshotStore, createMediaStore, openWithStores, SNAPSHOT_KEY, STORE, MEDIA_STORE } from "./persistence.js";

// ── a minimal in-memory IndexedDB fake ──────────────────────────────────────
// Mirrors just the request/transaction event model the store uses. Writes are
// applied synchronously on put(); success/complete events fire on a microtask so
// the store's awaits resolve, matching real IndexedDB's async shape.
function fakeIDB(initial = {}) {
  const data = new Map(Object.entries(initial));
  const stores = new Set();
  const db = {
    version: 1,
    close: () => {},
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n) => stores.add(n),
    transaction() {
      const tx = {};
      const store = {
        get(key) {
          const req = {};
          queueMicrotask(() => {
            req.result = data.has(key) ? data.get(key) : undefined;
            req.onsuccess && req.onsuccess();
          });
          return req;
        },
        put(val, key) {
          data.set(key, val); // synchronous — no read/write ordering race
          const req = {};
          queueMicrotask(() => req.onsuccess && req.onsuccess());
          return req;
        },
      };
      tx.objectStore = () => store;
      queueMicrotask(() => tx.oncomplete && tx.oncomplete());
      return tx;
    },
  };
  return {
    _data: data,
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
}

// An idb whose open always errors — to prove load() resolves null, never throws.
function brokenIDB() {
  return {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.error = new Error("open failed");
        req.onerror && req.onerror();
      });
      return req;
    },
  };
}

const bytes = (...xs) => new Uint8Array(xs);

// ── tests ───────────────────────────────────────────────────────────────────

test("save → flush → load round-trips the snapshot (AC1/AC3)", async () => {
  const idb = fakeIDB();
  const store = createSnapshotStore({ idb, schedule: () => {} }); // no auto-fire
  store.save(bytes(1, 2, 3, 4));
  await store.flush();
  assert.deepEqual(await store.load(), bytes(1, 2, 3, 4));
  // Stored under exactly the snapshot key.
  assert.ok(idb._data.has(SNAPSHOT_KEY));
});

test("an empty store loads null, not an error (AC2/AC7)", async () => {
  const store = createSnapshotStore({ idb: fakeIDB(), schedule: () => {} });
  assert.equal(await store.load(), null);
});

test("rapid saves coalesce to ONE write carrying the final state (AC3)", async () => {
  const idb = fakeIDB();
  let scheduleCount = 0;
  let fire = null;
  const store = createSnapshotStore({
    idb,
    schedule: (cb) => {
      scheduleCount += 1;
      fire = cb;
    },
  });
  store.save(bytes(1));
  store.save(bytes(2));
  store.save(bytes(3));
  assert.equal(scheduleCount, 1, "three saves arm exactly one flush");
  fire(); // drive the debounced flush
  await store.flush(); // settle the write
  assert.deepEqual(await store.load(), bytes(3), "the LAST save wins");
});

test("the debounce re-arms after a flush fires (AC3)", async () => {
  const idb = fakeIDB();
  let scheduleCount = 0;
  let fire = null;
  const store = createSnapshotStore({
    idb,
    schedule: (cb) => {
      scheduleCount += 1;
      fire = cb;
    },
  });
  store.save(bytes(1));
  fire(); // first window flushes
  store.save(bytes(2)); // a new edit after the flush re-arms
  assert.equal(scheduleCount, 2);
});

test("flush with nothing saved is a no-op (no write, no throw)", async () => {
  const idb = fakeIDB();
  const store = createSnapshotStore({ idb, schedule: () => {} });
  await store.flush();
  assert.equal(idb._data.size, 0);
});

test("a load error resolves to null, never throws (AC7)", async () => {
  const store = createSnapshotStore({ idb: brokenIDB(), schedule: () => {} });
  assert.equal(await store.load(), null);
});

test("no IndexedDB ⇒ inert store: load null, save/flush safe no-ops (AC7)", async () => {
  // In node globalThis.indexedDB is undefined → the store is inert by default.
  const store = createSnapshotStore();
  assert.equal(await store.load(), null);
  assert.doesNotThrow(() => store.save(bytes(1, 2, 3)));
  await assert.doesNotReject(() => store.flush());
});

// ── openWithStores: the boot-must-never-block contract ───────────────────────
// R-0045 shipped a blind open(DB_NAME, 2) at boot; the version upgrade waits
// forever while any pre-R-0045 tab holds v1 → the app froze at "loading…" in
// production. These pin the fix: versionless-first, upgrade only when a store
// is missing, REJECT (not hang) when an old tab blocks the upgrade.

// A versioned fake: tracks stores + version; `blockUpgrades` simulates an old
// tab holding the database open (fires onblocked, never onsuccess).
function versionedIDB({ version = 1, stores = [], blockUpgrades = false } = {}) {
  const state = { version, stores: new Set(stores), opens: [] };
  function makeDb() {
    return {
      get version() { return state.version; },
      close: () => {},
      objectStoreNames: { contains: (n) => state.stores.has(n) },
      createObjectStore: (n) => state.stores.add(n),
      transaction() {
        const tx = {};
        tx.objectStore = () => ({
          get: () => { const r = {}; queueMicrotask(() => { r.result = undefined; r.onsuccess?.(); }); return r; },
          put: () => { const r = {}; queueMicrotask(() => r.onsuccess?.()); return r; },
        });
        queueMicrotask(() => tx.oncomplete?.());
        return tx;
      },
    };
  }
  return {
    _state: state,
    open(_name, reqVersion) {
      state.opens.push(reqVersion ?? null);
      const req = {};
      queueMicrotask(() => {
        if (reqVersion === undefined) { // versionless: attach, never upgrade
          req.result = makeDb();
          req.onsuccess?.();
        } else if (blockUpgrades) {
          req.onblocked?.(); // an old connection never yields
        } else {
          state.version = reqVersion;
          req.result = makeDb();
          req.onupgradeneeded?.();
          req.onsuccess?.();
        }
      });
      return req;
    },
  };
}

test("boot open on a legacy v1 db attaches WITHOUT any upgrade (the outage regression)", async () => {
  const idb = versionedIDB({ version: 1, stores: [STORE] }); // pre-R-0045 db
  const db = await openWithStores(idb, [STORE]);
  assert.ok(db.objectStoreNames.contains(STORE));
  assert.deepEqual(idb._state.opens, [null], "exactly one VERSIONLESS open — no version request, nothing to block");
  assert.equal(idb._state.version, 1, "the legacy db is left at v1");
});

test("boot open on a legacy v1 db succeeds even while old tabs would block upgrades", async () => {
  const idb = versionedIDB({ version: 1, stores: [STORE], blockUpgrades: true });
  const db = await openWithStores(idb, [STORE]); // never requests a version → never blocked
  assert.ok(db.objectStoreNames.contains(STORE));
});

test("a fresh empty db upgrades once and creates both stores", async () => {
  const idb = versionedIDB({ version: 1, stores: [] });
  const db = await openWithStores(idb, [STORE]);
  assert.ok(db.objectStoreNames.contains(STORE));
  assert.ok(db.objectStoreNames.contains(MEDIA_STORE));
  assert.equal(idb._state.version, 2);
});

test("a BLOCKED media upgrade rejects — and mediaStore degrades to null, never hangs", async () => {
  const idb = versionedIDB({ version: 1, stores: [STORE], blockUpgrades: true });
  await assert.rejects(() => openWithStores(idb, [STORE, MEDIA_STORE]), /blocked/);
  const media = createMediaStore(idb);
  assert.equal(await media.get("some-id"), null); // resolves, no hang (AC7 discipline)
  await assert.doesNotReject(() => media.put("some-id", new Uint8Array([1])));
});

test("connections yield to future upgrades (onversionchange closes)", async () => {
  const idb = versionedIDB({ version: 2, stores: [STORE, MEDIA_STORE] });
  const db = await openWithStores(idb, [STORE]);
  let closed = false;
  db.close = () => { closed = true; };
  db.onversionchange();
  assert.ok(closed, "the handler closes the connection so a new tab can upgrade");
});
