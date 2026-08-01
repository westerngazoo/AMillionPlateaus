# R-0107 — A prerequisite you add is a real bridge, and you can take it back

**Status:** Accepted
**Theme:** POC — Knowledge content
**Depends on:** [R-0100](0100-add-prerequisite.md) (add a prerequisite the plan missed), [R-0081](0081-world-sync.md) (the world snapshot), [R-0093](0093-lens-bundles.md) (`contentUuid`)

## Why

[R-0100](0100-add-prerequisite.md) let you record the single most useful correction
you can make to a curriculum — *"actually, Analytical Geometry comes before
Optics"* — but it stored it in `localStorage` only. That meant the correction was
**stranded on one device** and **invisible on the map**, while every other kind of
state had learned to sync. It was the last thing in the app that couldn't travel.

It stayed that way for a concrete reason: the CRDT had **no way to delete a
bridge**. `mp-crdt` treated plateaus, bridges and resources as write-once, so a
prerequisite written into the graph could be added but never retracted — and an
un-retractable mistake is worse than a device-local one. Fixing the storage meant
fixing the engine first.

## What

**1. The engine can retract a bridge.** `CrdtDoc::remove_bridge` (and the
`WasmCrdtDoc::remove_bridge` binding) delete the entry from the `bridges` map.

This is the **first deletion** in the document, and the asymmetry is deliberate:
plateaus and resources stay write-once because unmaking a topic or a citation
destroys authored content, whereas a bridge is a *claim* that two topics are
related — and a claim you make you must be able to retract.

Deleting a map key is a first-class Automerge op, so the removal **merges**: it
propagates to peers instead of being resurrected by the next sync (pinned by a
two-replica test). The one case worth understanding is a delete *concurrent* with
an edit of the same bridge, which Automerge resolves in favour of the surviving
write — the bridge comes back. For a relation you can simply remove again,
resurrection is the safe direction to fail: it never destroys a peer's work.

**2. A prerequisite is a bridge.** Adding one now mints a `"prerequisite of"`
bridge from the prerequisite to the topic, so it lives in the graph — it syncs with
the world snapshot, draws as an edge, and is visible on every device. Removing one
deletes that bridge.

The bridge id is **derived** from `(from, to, concept)` with the same content hash
lens bundles use (`contentUuid`, R-0093). That buys two properties for free:
*idempotency* — adding the same prerequisite on two devices mints one bridge, since
the maps merge to a single entry — and *removability*, since either device can
recompute the id without having stored it.

**3. Nothing already recorded is lost.** A one-time per-device migration folds any
pre-R-0107 `mp.prereqs` entries into real bridges at boot, then marks itself done.
The old key is left in place as a backup rather than deleted.

## Acceptance criteria

1. **AC1 — it's in the graph.** Adding a prerequisite creates a `"prerequisite of"`
   bridge in the persisted CRDT snapshot; the legacy `mp.prereqs` key is not written.
2. **AC2 — it syncs.** Being in the world snapshot, it reaches other devices through
   the existing push/pull with no extra channel.
3. **AC3 — it can be retracted.** Removing deletes the bridge, and the deletion
   merges to a peer rather than being resurrected.
4. **AC4 — idempotent.** Adding the same prerequisite twice, or on two devices,
   yields exactly one bridge.
5. **AC5 — retracting twice is fine.** Removing an absent bridge is a no-op, not an
   error, so two devices can retract the same prerequisite.
6. **AC6 — migration preserves history.** Prerequisites added before this change
   appear as bridges after one boot; a prerequisite whose endpoint no longer exists
   is skipped without aborting the rest.
7. **AC7 — version skew is survivable.** New JS against an older cached wasm (no
   `remove_bridge`) warns and no-ops instead of throwing.

## Notes

- Rust: `crates/mp-crdt/src/doc.rs` (+4 tests, incl. the two-replica merge and the
  no-op cases) and the `crates/mp-wasm` binding. `cargo fmt`, `clippy -D warnings`
  and the workspace tests all pass natively.
- The local wasm32 toolchain on the owner's machine is broken (Homebrew rustc
  shadows rustup), so the browser bundle is built by CI. The add path and the
  version-skew guard were verified locally against the older bundle; the retract
  path is verified against the CI-built bundle after deploy.
- Live-verified: adding *Geometría Analítica → Óptica* produced exactly one
  `"prerequisite of"` bridge in the persisted snapshot with a deterministic id, the
  legacy key stayed unwritten, and clicking ✕ under an older wasm warned without
  throwing and left the chip intact.
