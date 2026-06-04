# SPEC-0012 — Browser-durable graph: IndexedDB snapshot of the CRDT doc

- **Status:** Accepted
- **Realizes:** R-0012
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** SPEC-0004 (CrdtDoc save/load), SPEC-0005 (web sync), SPEC-0011 (plateau authoring)
- **Module(s):** `crates/mp-wasm/src/lib.rs` (2 thin bindings) + `convert.rs` (one additive DTO field), `apps/web/src/persistence.js` + `persistence.test.mjs` (new), `apps/web/src/main.js` (wiring)

## 1. Motivation

R-0012: make the browser graph durable. The core `CrdtDoc::save()/load()` exist
and are tested (R-0004); the native `CrdtStore` persists that blob to redb. The
browser can't link redb, so we persist the **same Automerge save-blob** to
**IndexedDB**. This closes R-0011's corrected AC3.

## 2. Design

### 2.1 Module layout

```
crates/mp-wasm/src/lib.rs   ← EDIT  expose WasmCrdtDoc::save()/load() (wrappers)
crates/mp-wasm/src/convert.rs ← EDIT  add domain_id to PlateauDto (additive marshalling)
apps/web/src/persistence.js ← NEW   IndexedDB get/put of the snapshot + debounce
apps/web/src/persistence.test.mjs ← NEW  node --test, fake IndexedDB
apps/web/src/main.js        ← EDIT  restore-on-start, persist-on-change wiring
```

### 2.2 WASM bindings (the only Rust change)

`WasmCrdtDoc` wraps `mp_crdt::CrdtDoc`. Add two thin methods:

```rust
/// Serialize the whole CRDT doc to bytes (R-0012 AC1). Delegates to the
/// audited core; &mut because Automerge commits pending ops before saving.
pub fn save(&mut self) -> Vec<u8> {
    self.inner.save()
}

/// Reconstruct a doc from bytes produced by `save` (R-0012 AC1). A bad blob
/// is a thrown JS Error so the caller can fall back to a fresh seed (AC7).
pub fn load(bytes: &[u8]) -> Result<WasmCrdtDoc, JsError> {
    Ok(WasmCrdtDoc { inner: CrdtDoc::load(bytes)? })
}
```

`Vec<u8>` ↔ JS `Uint8Array` and `&[u8]` ← `Uint8Array` are handled by
wasm-bindgen. No core logic changes.

**One additive DTO field (AC5).** `PlateauDto` (`convert.rs`) today exposes
`{ id, name, description, position }` — not the domain. Rebuilding `DOMAIN_OF`
from the restored doc (AC5) needs each plateau's domain, which `PlateauNode`
already holds. Add it to the DTO and its converter — pure value marshalling, no
GA, no new logic, and it keeps the doc the single source of truth (vs. a parallel
persisted JS map that could drift):

```rust
pub struct PlateauDto { pub id: String, pub name: String,
                        pub description: String, pub domain_id: String,  // NEW
                        pub position: PositionDto }
// plateau_dto(): domain_id: p.domain_id.to_string()
```

### 2.3 `persistence.js` — IndexedDB snapshot store

A tiny promise-wrapped store over one object store, with an injectable
`indexedDB` factory so it is unit-testable without a browser (mirrors how
`events.js` takes an injected `storage`).

```js
// persistence.js — durable CRDT snapshot in IndexedDB (SPEC-0012 / R-0012).
export const DB_NAME = "mp-graph";
export const STORE = "snapshot";
export const SNAPSHOT_KEY = "crdt-doc-v1"; // versioned: a future bump invalidates cleanly

// createSnapshotStore({ idb }) → { load(): Promise<Uint8Array|null>,
//                                  save(bytes): void (debounced),
//                                  flush(): Promise<void> }
// All errors resolve to a safe value (load→null, save→swallow) so a
// persistence fault never takes down the world (AC7).
export function createSnapshotStore({ idb = globalThis.indexedDB, debounceMs = 300, schedule } = {}) {
  if (!idb) return inertStore();           // no IndexedDB → no-op (AC7)
  // open(): lazy idb.open(DB_NAME, 1), createObjectStore(STORE) onupgradeneeded
  // load(): get(SNAPSHOT_KEY) → Uint8Array | null   (any error → null)
  // save(bytes): stash latest; (schedule||setTimeout)(flush, debounceMs)  (AC3 coalesce)
  // flush(): put(latest, SNAPSHOT_KEY)               (any error → swallow)
}
```

The `schedule` injection lets tests drive the debounce deterministically (call
the captured callback synchronously) instead of waiting on real timers.

`SNAPSHOT_KEY`'s version suffix (`-v1`) tracks the **serde shape** of the stored
types (golden-pinned, GA_DB.md §3), not the app version — so the bump trigger is
unambiguous: change the suffix only when `PlateauNode`/`Bridge` serialization
changes, and old blobs are simply never read (clean discard, no migration).

**Testing (AC8) — no new dependency.** `apps/web` has no `package.json` and the
node tests run as bare `node --test` with zero npm deps; every test hand-rolls a
synchronous fake (e.g. `fakeStorage()` in `events.test.mjs`). `persistence.test.mjs`
follows suit with a **hand-rolled in-memory `idb` fake** passed via the injected
`idb` factory — **not** the `fake-indexeddb` npm package (which would add the
project's first JS dependency + lockfile). The injected `schedule` drives the
debounce synchronously. This is why §2.3 takes `idb`/`schedule` as parameters.

### 2.4 `main.js` wiring — restore on start, persist on change

```js
import { createSnapshotStore } from "./persistence.js";

const snapshots = createSnapshotStore();          // AC7: inert if no IndexedDB

// Restore: load the snapshot, else a fresh doc. A corrupt/old blob throwing in
// load() must NOT abort main() (the top-level main().catch does not reseed) —
// catch it here and discard-and-reseed (AC7).
const saved = await snapshots.load();             // resolves null on any error
let doc;
try { doc = saved ? WasmCrdtDoc.load(saved) : WasmCrdtDoc.new(); }
catch { doc = WasmCrdtDoc.new(); }                // corrupt blob → fresh + reseed

// ALWAYS apply the deterministic seed — an idempotent upsert over a restore
// (AC4, §2.5). Authored nodes (random ids) are never touched.
for (const p of SEED_PLATEAUS) doc.seed_plateau(p.id, p.name, p.domain, p.e1, p.e2, p.e3);
for (const b of SEED_BRIDGES)  doc.seed_bridge(b.id, b.from, b.to, b.concept);

// Rebuild DOMAIN_OF from the restored doc so authored plateaus traverse under
// their own domain, not a fallback (AC5). plateaus() now carries domain_id (§2.2).
for (const p of doc.to_graph().plateaus()) DOMAIN_OF.set(p.id, p.domain_id);

// One persist helper; debounced inside the store (AC3).
function persist() { snapshots.save(doc.save()); }
```

**Where `persist()` is called (exact sites — `sync.js` stays persistence-unaware).**
`createSync` is a pure transport and must not know about persistence (SRP), so we
**wrap its callback** rather than edit it:

```js
const sync = createSync(doc, session, () => { draw(); persist(); }); // inbound sync
```

and call `persist()` at each local-edit site: after the drafted-plateau
`add_plateau` (the R-0011 submit handler) and after a `vote`. The signed-event
ingest path is **not** a persist site — that is the localStorage event log, not
the CRDT doc.

**Flush on hide (AC2/AC3 — close the debounce loss window).** A plateau authored
< `debounceMs` before the tab closes would never reach IndexedDB, undercutting
AC2. Add a best-effort flush on the bfcache-safe hide event:

```js
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") snapshots.flush();
});
```

(`flush()` returns a Promise that may not settle during unload; this is
best-effort, and the 300 ms debounce covers the common case. Stated as an
accepted POC bound, not a guarantee.)

**Concurrent tabs are safe-by-construction.** Two tabs persist to the same
`SNAPSHOT_KEY`, but they first converge via the existing BroadcastChannel sync
*before* either persists (the wrapped `onRemote` callback runs on every inbound
change). Last-writer-wins on the key is therefore safe: the loser's state is
already contained in the winner's converged doc (R-0004 AC4). Snapshotting the
*converged whole doc* — not diffs — is what makes this hold.

### 2.5 Restore-vs-seed ordering (open question → decided)

**Load snapshot, then apply the idempotent seed.** The seed uses fixed ids via
`seed_plateau`/`seed_bridge`. At the core these are an Automerge map **`put`
keyed by the fixed UUID string** (`doc.rs:258`, `put_entry`) — an idempotent
*upsert*, not an append — so re-applying a seed writes identical JSON to the
identical key: convergent, no duplication (R-0004 AC4). Authored nodes carry
fresh random ids and are never on a seed key, so they are never overwritten.
(Latent caveat, safe for this POC: because re-seeding *overwrites* the seed key,
a seed node must never become user-editable while this runs every load — moot
today since the world is create-only, R-0011, and seed nodes are not edited.)
This is simpler than seeding a fresh doc and merging, and needs no second
`WasmSyncSession`.

## 3. Code outline

See §2 — two ~3-line Rust wrappers, one additive `PlateauDto` field + its
converter line, one ~60-line JS module with an injected `idb`/`schedule`, and
~8 lines of `main.js` wiring. Fully specified.

## 4. Non-goals

- No redb in wasm; native `CrdtStore` untouched.
- No incremental/change-chunk persistence or compaction — whole-doc blob only.
- No snapshot sync/upload; cross-device durability stays on the sync/relay path.
- No migration of old snapshots beyond discard-and-reseed on load error.
- No plateau delete/edit (still create-only).

## 5. Open questions (resolved here for acceptance)

- **Ordering** → load-then-idempotent-seed (§2.5).
- **Debounce** → 300 ms coalesce, injectable for tests (§2.3).
- **Versioning** → fixed key `crdt-doc-v1`; a schema bump changes the suffix and
  the old key is simply never read (effectively discarded).
- **Corrupt/old blob** → `load` error ⇒ discard, reseed, overwrite (§2.4, AC7).

## 6. Acceptance criteria

Maps 1-to-1 to R-0012 AC:

- [ ] AC1 — `WasmCrdtDoc.save()/load()` exposed; round-trip preserves
      plateaus/bridges/resources/votes (wasm-pack test).
- [ ] AC2 — Snapshot present on start ⇒ authored plateau restored after full
      close/reload, no other tab, no relay.
- [ ] AC3 — Any local edit / changing inbound sync ⇒ debounced IndexedDB write;
      last write reflects final state.
- [ ] AC4 — Deterministic seed idempotent over a restore (no dup seeds, no lost
      authored nodes); restore-then-seed converges.
- [ ] AC5 — `DOMAIN_OF` rebuilt from the restored doc; restored authored plateau
      scores under its own domain.
- [ ] AC6 — Snapshot root keys stay `{bridges, plateaus, resources, votes}`; no
      reputation/persona/identity/model written into it.
- [ ] AC7 — No IndexedDB (or put/get error) ⇒ graceful in-memory fallback, no
      uncaught console errors.
- [ ] AC8 — `persistence.test.mjs` green with a **hand-rolled in-memory `idb`
      fake (no npm dependency)** + injected `schedule`: put/get round-trip,
      debounce coalesce, flush, no-idb fallback; full workspace + wasm + node +
      clippy + fmt green.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | IndexedDB store with injected `idb`/`schedule` | Unit-testable without a browser, mirrors `events.js` injected `storage`; deterministic debounce in tests |
| 2026-06-02 | Load snapshot then apply idempotent seed | Convergent fixed-id seeds; simpler than seed-fresh-then-merge, no extra sync session |
| 2026-06-02 | Versioned key `crdt-doc-v1`, discard-and-reseed on load error | Clean forward-compat without a migration engine in a POC |
| 2026-06-02 | All persistence errors resolve safely (load→null, save→swallow) | AC7 — a storage fault must never take down the world |
| 2026-06-02 | Corrupt-blob `load()` wrapped in try/catch in `main`, not left to the top-level catch | The top-level `main().catch` does not reseed; AC7 needs an explicit discard-and-reseed (architect finding 1) |
| 2026-06-02 | `persist()` wired by wrapping the `createSync` callback; `sync.js` stays persistence-unaware | SRP — transport must not know about durability (architect finding 2) |
| 2026-06-02 | Hand-rolled in-memory `idb` fake in tests; no `fake-indexeddb` npm dependency | `apps/web` has no package.json; adding one is real scope creep (architect finding 3) |
| 2026-06-02 | Best-effort `flush()` on `visibilitychange→hidden` | Closes the debounce loss window that bears on AC2 (architect finding 5) |

## Changelog

- 2026-06-02 created (Draft) — pending architect review, then Accepted.
- 2026-06-02 architect design review: **APPROVE-WITH-NITS**. All eight findings
  folded in (try/catch corrupt-blob fallback; wrap-the-callback / `sync.js` stays
  pure; hand-rolled `idb` fake, no npm dep; idempotent-upsert citation;
  flush-on-hide; concurrent-tab safety statement; `save(&mut)` note; DTO surfaces
  via the existing generic serializer). **Status → Accepted**; ready to implement.
