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

/**
 * Open the app database, requiring `required` object stores — WITHOUT ever
 * letting boot hang on a version upgrade. The R-0045 media store shipped as a
 * blind `open(DB_NAME, 2)` at boot; an IndexedDB upgrade WAITS INDEFINITELY
 * while any older tab / installed PWA holds version 1 open, and pre-R-0045
 * clients never close their connection — so the app froze at "loading…" on
 * every device with an old tab alive (the production black-screen outage).
 *
 * Strategy:
 * 1. Open VERSIONLESS — attaches to v1 legacy and v2 databases alike, and can
 *    never block. If the required stores exist (legacy v1 always has the
 *    snapshot store), that's the answer.
 * 2. Only when a store is genuinely missing, upgrade to `version + 1` —
 *    a fresh browser (empty db), or the first MEDIA use on a legacy db.
 * 3. Every connection we hand out auto-yields to future upgrades
 *    (`onversionchange → close`), so new clients never become the blocker,
 *    and an upgrade that IS blocked (an old tab still alive) REJECTS instead
 *    of hanging — callers degrade (media reads null) and retry later.
 */
export function openWithStores(idb, required) {
  return new Promise((resolve, reject) => {
    const first = idb.open(DB_NAME); // versionless: never triggers an upgrade
    first.onerror = () => reject(first.error);
    first.onsuccess = () => {
      const db = first.result;
      db.onversionchange = () => db.close(); // yield: never block a future upgrade
      const missing = required.filter((s) => !db.objectStoreNames.contains(s));
      if (missing.length === 0) return resolve(db);

      const nextVersion = Number(db.version || 1) + 1;
      db.close();
      let settled = false;
      const up = idb.open(DB_NAME, nextVersion);
      up.onupgradeneeded = () => {
        const udb = up.result;
        for (const s of [STORE, MEDIA_STORE]) {
          if (!udb.objectStoreNames.contains(s)) udb.createObjectStore(s);
        }
      };
      up.onblocked = () => {
        // An old-version connection is alive elsewhere. Reject NOW (the caller
        // degrades honestly); if the upgrade later completes, onsuccess closes
        // the unused connection so we never hold the new version hostage.
        if (!settled) {
          settled = true;
          reject(new Error("IndexedDB upgrade blocked by another open tab/app"));
        }
      };
      up.onsuccess = () => {
        const udb = up.result;
        if (settled) return udb.close();
        settled = true;
        udb.onversionchange = () => udb.close();
        resolve(udb);
      };
      up.onerror = () => {
        if (!settled) {
          settled = true;
          reject(up.error);
        }
      };
    };
  });
}

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
    // BOOT-critical: requires only the snapshot store, which every db version
    // has — so this never upgrades and NEVER blocks on other tabs.
    if (dbPromise) return dbPromise;
    dbPromise = openWithStores(idb, [STORE]).catch((e) => {
      dbPromise = null; // let a later call retry rather than cache the failure
      throw e;
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
    // NON-boot: needs the media store, so a legacy v1 db upgrades HERE — at
    // first media use, not at boot. If an old tab blocks the upgrade this
    // rejects (get → null, put → swallowed) and retries on the next call.
    if (dbPromise) return dbPromise;
    dbPromise = openWithStores(idb, [STORE, MEDIA_STORE]).catch((e) => {
      dbPromise = null;
      throw e;
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
