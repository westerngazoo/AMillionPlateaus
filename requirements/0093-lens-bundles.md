# R-0093 — 🔬 Lens bundles: publish a lens, adopt anyone's

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-23
- **Depends on:** R-0038 (authored lenses), R-0081 (world snapshot in a repo), R-0086 (any forge),
  R-0085 (private-repo read token).
- **Source:** the owner: "now if I want to create new lenses how do I do that dynamically — I want
  to create a lens for my university career, university physics, where I will have all I've
  learned; all people shall be able to do it. I think we need at least a local graph db that could
  be p2p file partitioned and a global knowledge db so every time the app shall sync."

## 1. Statement

Until now a lens was **local**: authored lenses lived only in this browser's `mp.domains`, and the
only shareable artifact was the **whole world** as one opaque snapshot (R-0081). You could not
hand someone *just* "University Physics."

A **lens bundle** is the partitioned, shareable unit. One lens — its domain (a way of seeing) plus
every plateau under it, the bridges among those plateaus, and their resources — serializes to a
single self-contained file, `lenses/<domain-id>.json`, sitting beside the world snapshot in the
same repo. **Publish** writes that file to your connected 📓 Sync repo. **Adopt** lists the
`lenses/` folder of *any* repo (public, or private with a read token) and merges a chosen lens onto
your map as new islands. Adoption seeds **idempotently by id**: nothing of yours is touched or
overwritten, and adopting the same lens twice is a no-op.

This is the first of the "file-partitioned local graph + global knowledge db" arc: R-0093 makes a
lens portable, R-0094 adds a browsable registry, R-0095 the global query layer.

## 2. Acceptance criteria

- **AC1** — pure `lens-bundle.js`. `buildLensBundle(domain, plateaus, bridges, resources, meta)`
  keeps only the lens's plateaus, the bridges with **both** endpoints in the lens (no dangling
  edges), and the resources on those plateaus; output is **deterministic** — the same content
  yields byte-identical JSON regardless of input order. `parseLensBundle` validates/normalizes and
  returns null on junk. `lensBundlePath(id)` → `lenses/<id>.json`, sanitized so an odd id cannot
  escape the folder. Unit-tested.
- **AC2** — **every id a bundle carries is a valid UUID.** Plateau/domain ids are carried verbatim
  (already UUIDs); bridge and resource ids are **synthesized from their content** as deterministic
  v5-style UUIDs, so a bundle is a pure function of what the lens contains — re-publishing after
  the publisher deletes and recreates an edge still yields the same id, and re-adoption stays
  idempotent. Required because the Rust `seed_plateau`/`seed_bridge`/`seed_resource` each parse
  every id with `Uuid::parse_str`.
- **AC3** — `applyLensBundle(bundle, seeders)` is dependency-injected (pure to test) and seeds in a
  safe order: **all plateaus before any bridge/resource** (the seed API rejects an endpoint that
  does not exist yet), and the **domain registers last** — if a seed throws, no empty orphan lens
  is stranded in the reader's picker.
- **AC4** — Publish: 🔬 Publish / adopt a lens lists your lenses with live topic counts; publishing
  writes `lenses/<id>.json` to the connected sync repo (update-in-place via its sha), stamped with
  the lens label and your public wizard id as provenance. Guarded: no 📓 Sync → a clear prompt to
  connect; an empty lens → a prompt to map something first.
- **AC5** — Adopt: paste any repo (bare `owner/repo` = GitHub, a full URL = any forge; optional
  read token for a private one, kept in this browser and sent only to that forge). List reads the
  remote `lenses/` folder, shows each valid bundle with its topic/bridge counts, and Adopt merges
  it — registering the lens locally so it is immediately faceable and pickable. Re-adopting reports
  "you already had these topics" and adds nothing.
- **AC6** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-23 created (Accepted) + implemented. Suite 590/590 (11 new lens-bundle tests).
  Live-verified end-to-end against a stubbed forge: listing a repo's `lenses/` showed
  "University Physics (demo) — 2 topics, 1 bridge"; Adopt merged it (113 → 115 topics) and the lens
  appeared in the publish picker with the correct count; **re-adopting the identical bundle left
  the count at 115** ("you already had these topics") — idempotent. Both guards verified (publish
  with no sync connected; adopt with a malformed repo string).
- 2026-07-23 — two defects found by live verification, before merge: (1) synthesized bridge/resource
  ids were `b-<hash>`/`r-<hash>`, which the Rust seed API rejected with "invalid character: found
  `v` at 0" — every id must be UUID-shaped, so `contentUuid` now emits a v5-style UUID (AC2);
  (2) the domain was registered *before* seeding, so a failed adopt stranded an empty orphan lens —
  the domain now registers last (AC3). Both are covered by regression tests.
