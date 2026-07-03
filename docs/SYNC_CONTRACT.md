# Dev sync contract — web → Godot

- **Status:** Living contract (dev-only). Documents the existing web→Godot sync files and a
  **proposed** `events.json` addition.
- **Author:** Gustavo Delgadillo (with Claude)
- **Created:** 2026-07-03
- **Realizes / supports:** SPEC-0025 (the Godot client as a pure consumer of the unchanged
  core), R-0039 slice 6 (Godot path render + event-log ingestion)
- **Module(s):** `scripts/serve.py` (the PUT endpoints), `apps/web/src/main.js` (the writer),
  `apps/godot/src/world.gd` (the reader). **Code-owned by other tracks — this doc is the
  shared spec, not an edit to them.**
- **Unblocks:** Track C2 (`export/events.json` for Godot), B5/B6 (deep-link + export status).

---

## 1. What this is

The parallel dev workflow (`./scripts/start-dev.sh`) runs the 2D web app and the 3D Godot
client **side by side over one world**. The web app is the authoring surface; Godot is a
read-only consumer. They share state through a handful of **files under
`apps/web/export/`**, written by the browser over HTTP `PUT` and polled by Godot.

This is a **development-time bridge, not the production transport.** The real cross-client
path is the CRDT sync (WebRTC datachannel, R-0018) plus each client owning its own transport
(SPEC-0025 §2.9, Track D). This contract exists so the two clients can be developed against
the *same* live world today, before that native transport lands.

**Direction is one-way: web writes, Godot reads.** Godot never writes these files. Anything
Godot needs to send back to the web app (votes, signed events cast in-world) is out of scope
here and waits on the native sync transport (SPEC-0025 §2.9 / Track D → AC7).

```
 apps/web (browser)                    scripts/serve.py                 apps/godot
 ─────────────────                     ───────────────                  ──────────
 doc.save()  ─ PUT /dev/world.bin ───▶ apps/web/export/world.bin ──┐
 {lens} ───── PUT /dev/focus.json ───▶ apps/web/export/focus.json  ├─ poll mtime (~1s) ─▶ world.gd
 rep ──────── PUT /dev/reputation ───▶ apps/web/export/reputation.json ┘   (MP_WORLD_BLOB
 (proposed)   PUT /dev/events.json ──▶ apps/web/export/events.json  ────▶   + siblings)
```

---

## 2. Transport

### 2.1 The dev server (`scripts/serve.py`)

`serve.py` serves `apps/web/` with caching disabled and adds three dev-only `PUT` routes.
Each route writes the request body verbatim to a fixed file under `apps/web/export/` and
answers `204 No Content`:

| Method + path | Writes to | Body |
|---------------|-----------|------|
| `PUT /dev/world.bin` | `apps/web/export/world.bin` | raw CRDT bytes |
| `PUT /dev/focus.json` | `apps/web/export/focus.json` | UTF-8 JSON |
| `PUT /dev/reputation.json` | `apps/web/export/reputation.json` | UTF-8 JSON |
| `PUT /dev/events.json` **(proposed — §4)** | `apps/web/export/events.json` | UTF-8 JSON |

CORS is wide open (`Access-Control-Allow-Origin: *`, methods `GET, HEAD, PUT, OPTIONS`) so
the browser can `PUT` from any dev port. Any other `PUT` path returns `404`.

### 2.2 The writer (`apps/web/src/main.js`)

On every local edit and inbound sync the web app calls `save()`, which:

1. `PUT`s the CRDT blob to `/dev/world.bin`;
2. `PUT`s `{ lens_id, lens_mode }` to `/dev/focus.json` (skipped when unchanged — a cheap
   dedupe against the last payload);
3. `PUT`s the `{ domain_reps, synthesis }` reputation object to `/dev/reputation.json`.

All three `PUT`s are best-effort (`.catch(() => {})`) — a missing dev server never breaks the
web app.

### 2.3 The reader (`apps/godot/src/world.gd`)

`start-dev.sh` exports `MP_WORLD_BLOB=$ROOT/apps/web/export/world.bin`. Godot derives the
sibling paths from that file's directory (`reputation.json`, `focus.json`, and — once added —
`events.json`), loads them on boot, then **polls modification time every ~1 s**. When
`world.bin` (or `reputation.json`) changes it rebuilds the scene; when `focus.json` changes it
re-applies the focus lens without a full rebuild.

**mtime, not content hashing**, is the change signal — keep writes atomic-enough that a
half-written file is not read (the current `PUT`-then-`204` writes the whole body in one call,
which is sufficient for dev).

---

## 3. File schemas (current)

### 3.1 `world.bin` — the CRDT world

Raw bytes from `CrdtDoc::save()` (Automerge) — the **same** blob the browser persists to
IndexedDB (R-0012) and merges over WebRTC (R-0018), and the same bytes `mp-godot`'s
`GraphData::load(bytes)` accepts. Not text; no schema beyond "a valid saved `CrdtDoc`".
This is the authoritative graph (plateaus, bridges, resources); everything else in this
contract is derived, per-viewer read state.

### 3.2 `focus.json` — the focus lens

```json
{ "lens_id": "<plateau-uuid | null>", "lens_mode": true }
```

| Field | Type | Meaning |
|-------|------|---------|
| `lens_id` | string \| null | The focused plateau's UUID, or `null`/`""`/`"null"` for none |
| `lens_mode` | bool | Whether the focus lens is active (dim non-focused) |

Reader semantics (`world.gd`): `lens_id == "null"` is coerced to empty; the effective focus is
`lens_id` only when `lens_mode` is true. Consumers must tolerate a missing key (default
`lens_mode = true`, no focus).

### 3.3 `reputation.json` — the viewer's recomputed reputation

The `{ domain_reps, synthesis }` object recomputed from the verified event log
(`recompute_reputation`), i.e. exactly the wire shape the fog query already consumes
(SPEC-0003 Reputation DTO; parity-parsed by `mp-godot`'s `parse_reputation`).

```json
{
  "domain_reps": { "<domain-uuid>": [f32, f32, f32, f32, f32, f32, f32, f32] },
  "synthesis":   [f32, f32, f32, f32, f32, f32, f32, f32]
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `domain_reps` | map<uuid, `[f32; 8]`> | Per-domain reputation multivector, blade order `[1, e1, e2, e12, e3, e13, e23, e123]` |
| `synthesis` | `[f32; 8]` | The blended cross-domain multivector (may be absent — defaults to zeros) |

**Never a scalar, never in the CRDT** (CLAUDE.md §4/§7). Godot consumes it read-only to drive
the fog/reach set via `reachable_plateaus_json(rep_json)`; it is *not* stored — it is a
recompute snapshot that becomes stale the moment the log changes, which is why the web app
re-PUTs it after every change.

An empty/absent reputation (`{}` or `{ "domain_reps": {} }`) reaches **nothing** — reach is
earned from signed history, never seeded.

---

## 4. `events.json` — the verified signed-event-log slice (PROPOSED)

**Status: proposed** — unblocks Track C2 and R-0039 slice 6 (Godot must ingest a
signed-event-log to render paths, mastery ✓, and published proofs, and to recompute reputation
itself instead of trusting the `reputation.json` precompute).

### 4.1 Why a new file

`world.bin` carries the CRDT graph but **no signed events** (events are never written to the
CRDT — CLAUDE.md §7; they live only in each browser's `localStorage` mirror, `mp.eventLog`).
Today Godot gets only a *precomputed* `reputation.json` and no way to see paths/mastery/proofs.
`events.json` exports the browser's **already-verified** event log so the native client can
derive the same content the web app derives (and, via `mp-godot`'s `mp-identity` dep, recompute
reputation itself — making `reputation.json` a convenience, not a dependency).

### 4.2 Schema

A **versioned wrapper** around a list of NIP-01 events (the `NostrEvent` shape:
`crates/mp-identity/src/event.rs`):

```json
{
  "version": 1,
  "generated_at": 1751500800000,
  "pubkey": "<viewer x-only pubkey hex>",
  "events": [
    {
      "id": "<64-hex sha256 of the canonical serialization>",
      "pubkey": "<64-hex x-only>",
      "created_at": 1751500000,
      "kind": 30082,
      "tags": [],
      "content": "<kind-specific JSON payload, as a string>",
      "sig": "<128-hex BIP340 schnorr>"
    }
  ]
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `version` | int | **Schema version. Start at `1`.** See §4.4 |
| `generated_at` | int | Unix **milliseconds** the slice was written (for staleness UI, e.g. B6) |
| `pubkey` | string | Whose viewpoint this log is (the local wizard's x-only pubkey hex) |
| `events` | array | Verified `NostrEvent`s — the browser's `log.all()` (each has passed `verify_event`) |

Event `content` is a JSON **string** whose shape depends on `kind`
(`crates/mp-identity/src/event.rs`): `Traversal`, `Vouch`, `Mastery`, `Proof`, `PathDoc`. The
relevant kinds:

| `kind` | Constant | Payload | Consumer |
|--------|----------|---------|----------|
| 30078 | `KIND_TRAVERSAL` | `Traversal` | reputation (recompute) |
| 30079 | `KIND_VOUCH` | `Vouch` | reputation (recompute) |
| 30080 | `KIND_MASTERY` | `Mastery` | mastered-topics ✓ (recompute ignores) |
| 30081 | `KIND_PROOF` | `Proof` | published proofs (recompute ignores) |
| 30082 | `KIND_PATH` | `PathDoc` | published paths / follow (recompute ignores) |

### 4.3 Trust model (do not skip)

The web writer only ever writes events that have **already passed `verify_event`** (id ==
sha256(canonical) **and** valid BIP340 signature — `apps/web/src/events.js`). But a file on
disk is not a trust boundary: **`mp-godot` MUST re-verify every event on ingest** (it depends
on `mp-identity`, so it can), exactly as the browser re-verifies its `localStorage` mirror on
load. An event that fails verification is dropped and contributes nothing (R-0010 AC2). This
keeps the "reputation is recomputed from a verified log" invariant true on both clients and
makes `events.json` untrusted input, not privileged state.

Godot must also tolerate: unknown `kind`s (ignore), duplicate `id`s (dedupe), and an empty
`events` array (reaches nothing / no content). Reputation recomputed from an empty log is
empty — same as `reputation.json = {}`.

### 4.4 Versioning

- `version` is a single integer, starting at **`1`**.
- **Additive changes** (new optional wrapper fields, new event `kind`s) do **not** bump
  `version` — readers ignore fields/kinds they don't recognize.
- **Breaking changes** (renamed/removed wrapper fields, changed event canonicalization) bump
  `version`. A reader that sees a `version` **greater than it supports** must refuse the file
  (log a warning, fall back to `reputation.json` + no content) rather than misparse it.
- The `NostrEvent` shape itself is pinned by NIP-01 + `mp-identity` and is **not** versioned
  here; only this wrapper is.

### 4.5 Producer / consumer / transport (proposed)

- **Producer:** `apps/web/src/main.js` `save()` also `PUT`s the wrapper to `/dev/events.json`
  (best-effort, like the others), built from `log.all()` + the local pubkey. *(Web track.)*
- **Transport:** add `PUT /dev/events.json → apps/web/export/events.json` to `serve.py`,
  mirroring the existing three routes. *(Web / infra track — one-line addition.)*
- **Consumer:** `apps/godot/src/world.gd` derives `events.json` beside the other sidecars from
  `MP_WORLD_BLOB`'s directory, polls its mtime, and feeds it to a new `mp-godot` ingestion
  entry that **re-verifies** and exposes derived views (paths, mastery, published proofs) and
  optionally a self-recomputed reputation. *(Godot / bindings track — C2 + R-0039 slice 6.)*

Because `mp-godot` can recompute reputation from a verified `events.json`, `reputation.json`
becomes an **optional precompute** kept for now (it is cheaper and already wired); if Godot
recomputes locally, `events.json` is the single source and `reputation.json` may later be
retired. That decision is deferred to when C2 lands.

---

## 5. Ownership & conflict rules

Per `docs/PARALLEL_DEV_TASKS.md` (Shared row), the export files are a **shared schema**:

- A schema change to any file here is **one PR that updates both clients together** (writer +
  reader), plus a note in this doc.
- The writer (`main.js`), the endpoints (`serve.py`), and the reader (`world.gd`) are owned by
  different tracks — coordinate through this contract, not by editing across tracks in one PR.
- Keep the DTO/JSON shapes here **identical** to what the bindings emit (`mp-wasm` ↔
  `mp-godot`); the binding parity test (Track C5) guards the graph DTOs, and this doc guards
  the sync-file envelopes.

## 6. Open questions

- **`events.json` size:** the full log can grow; do we cap/slice it (e.g. last-N, or only
  content kinds Godot renders) or send it whole? *Lean: whole for dev; revisit if it hurts.*
- **Retire `reputation.json`?** Once `mp-godot` recomputes from `events.json`, is the
  precompute worth keeping? (See §4.5 — deferred to C2.)
- **Atomicity:** mtime polling assumes whole-file writes; if a future writer streams, add a
  temp-write-then-rename or a checksum footer.
- **Two-way sync:** in-world votes/signs (Godot → web) are explicitly **out of scope** here and
  wait on the native transport (SPEC-0025 §2.9 / Track D).
