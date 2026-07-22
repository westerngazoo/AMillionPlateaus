# R-0081 — sync the graph itself to GitHub (the world crosses devices)

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0075 (GitHub notes-sync wizard), R-0012 (CRDT save/load), R-0079 (capture).
- **Source:** the owner: "in another PC I added the law of sines and cosines — where is it? … that's
  why I wanted to use GitHub, close the gap."

## 1. Statement

R-0075 synced the notepads but **not the graph**, so a topic captured on one machine stayed stranded
in that browser's IndexedDB. This closes the gap: the same private repo now also holds the **graph
itself** — one CRDT snapshot (`doc.save()` bytes) at **`world/graph.mpworld`** — so a plateau
captured on one device crosses to the others.

Because the graph is an Automerge CRDT, sync is **conflict-free**: **Pull** does `merge_bytes` (a
union — it never deletes local topics, only adds what's remote); **Push** merges the remote first,
then writes the union back, so it can never clobber a topic another device pushed since. **Connecting
a device auto-pulls the world** (that's what makes it "just sync"): open the app on PC-B, Test & save,
and the topics you captured on PC-A appear. **Back up everything ↑** pushes the world snapshot then
every notepad note; **Pull world ↓** re-merges on demand. Same security envelope as R-0075: the
token lives only in this browser's localStorage and is sent only to api.github.com.

## 2. Acceptance criteria

- **AC1** — pure `notes-sync.js`: `WORLD_FILE = "world/graph.mpworld"`; `b64FromBytes` /
  `bytesFromB64` round-trip RAW bytes (incl. values >127 and across the 0x8000 chunk boundary;
  empty/nullish safe). Unit-tested.
- **AC2** — `ghGetWorld` / `ghPutWorld` GET/PUT the snapshot (sha-aware, base64 of `doc.save()`);
  `pullWorld` merges remote (`merge_bytes`), registers imported domains, persists + redraws, and
  returns the count of new plateaus; `pushWorld` merges remote before PUT so a push never clobbers.
- **AC3** — Test & save auto-pulls the world (reports new topics merged); **Back up everything ↑**
  pushes world + all notes; **Pull world ↓** merges on demand. Panel copy states the map now syncs.
- **AC4** — additive, no new dependency, `apps/web` only; same token/localStorage security as
  R-0075; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 556/556 (2 new notes-sync tests: binary
  base64 round-trip, WORLD_FILE). Live-verified a full two-device simulation against a stubbed
  GitHub API: captured "SYNCPROBEZETA law of cosines" on device 1 → **Back up everything ↑**
  pushed a 55 KB snapshot → **deleted IndexedDB + reloaded** (fresh device, probe absent) →
  **Pull world ↓** → "Pulled ✓ — 1 new topic merged into your map" and search found the probe.
  Connect-time auto-pull confirmed ("World up to date").
