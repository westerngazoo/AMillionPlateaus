// persistence.js — durable CRDT snapshot in IndexedDB (SPEC-0012 / R-0012).
//
// The browser analogue of the native redb `CrdtStore`: it persists the SAME
// Automerge save-blob (`WasmCrdtDoc.save()` → Uint8Array) so the graph survives
// a full close/reload. redb does not target wasm32, so the browser backing is
// IndexedDB — binary-blob capable, large quota (localStorage would need base64
// and caps at ~5 MB). Only graph state is stored; reputation is never in the
// doc (CLAUDE.md §7), so it can never be in the snapshot.
//
// `idb` and `schedule` are INJECTED so this is unit-testable in node with a
// hand-rolled in-memory fake — no `fake-indexeddb`, no npm dependency (the repo
// has none). Every error resolves to a safe value (load→null, save/flush→swallow)
// so a storage fault never takes down the world (R-0012 AC7).

export const DB_NAME = "mp-graph";
export const STORE = "snapshot";
export const MEDIA_STORE = "media";
// The version suffix tracks the stored types' SERDE SHAPE (golden-pinned,
// GA_DB.md §3), not the app version: bump it only when PlateauNode/Bridge
// serialization changes, and old blobs are simply never read (clean discard).
export const SNAPSHOT_KEY = "crdt-doc-v1";

// createSnapshotStore({ idb, debounceMs, schedule }) →
//   { load(): Promise<Uint8Array|null>, save(bytes): void, flush(): Promise<void> }
export function createSnapshotStore({
  idb = globalThis.indexedDB,
  debounceMs = 300,
  schedule,
} = {}) {
  if (!idb) return inertStore(); // no IndexedDB (private mode, node) → no-op (AC7)

  const sched = schedule || ((cb) => setTimeout(cb, debounceMs));
  let dbPromise = null;
  let latest = null; // most-recent bytes awaiting flush
  let armed = false; // a flush is scheduled

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null; // let a later call retry rather than cache the failure
        reject(req.error);
      };
    });
    return dbPromise;
  }

  // Resolve the stored snapshot, or null on any error / absence (AC7).
  async function load() {
    try {
      const db = await open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(SNAPSHOT_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  // Stash the latest bytes and arm a single debounced flush; rapid edits coalesce
  // to one write carrying the FINAL state (AC3).
  function save(bytes) {
    latest = bytes;
    if (armed) return;
    armed = true;
    sched(() => {
      armed = false;
      flush();
    });
  }

  // Write the latest stashed bytes now. Used by the debounce and by an explicit
  // flush-on-hide. Idempotent: re-writing the same bytes is harmless.
  async function flush() {
    if (latest == null) return;
    const bytes = latest;
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(bytes, SNAPSHOT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // Quota/denied/etc. — swallow; the doc stays authoritative in memory (AC7).
    }
  }

  return { load, save, flush };
}

// Null-object store for when IndexedDB is unavailable: the world loads from seed,
// authoring works for the session, nothing is persisted, nothing throws (AC7).
function inertStore() {
  return {
    load: async () => null,
    save: () => {},
    flush: async () => {},
  };
}

export function createMediaStore(idb = globalThis.indexedDB) {
  if (!idb) return { async get() { return null; }, async put() {} };
  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }
  return {
    async get(id) {
      try {
        const db = await open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(MEDIA_STORE, "readonly");
          const req = tx.objectStore(MEDIA_STORE).get(id);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch { return null; }
    },
    async put(id, blob) {
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(MEDIA_STORE, "readwrite");
          tx.objectStore(MEDIA_STORE).put(blob, id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch {}
    }
  };
}
