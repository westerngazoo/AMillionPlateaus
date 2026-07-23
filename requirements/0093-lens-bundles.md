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

## R-0093a — hardening (2026-07-23)

An architect review of the merged R-0093 found several **one-way doors**: the id scheme and the
bundle schema become the join key R-0094's registry and R-0095's query layer index on, and changing
either after lenses are published re-mints every id and breaks idempotency for everyone who already
adopted. Fixed while it was still free — nothing had been published yet. **The id scheme changed;
any bundle written in the first hour of R-0093 should be re-published.**

- **AC7** — every id is namespaced by kind. Bridges and resources previously shared one id space
  and provably collided: the same UUID came back for a bridge `{from:A,to:B,concept:""}` and a
  resource `{plateau:A,uri:B,title:""}`. Each kind now hashes under its own prefix
  (`mp:bridge:1`, `mp:resource:1`).
- **AC8** — the field separator is written as the escape sequence `\u001f`, not a raw control byte
  pasted into source (which any reformat or re-encode could have silently normalized away,
  re-minting every id in the ecosystem). `contentUuid` has a **golden vector** test — fixed input →
  fixed UUID — so a change to the scheme fails loudly instead of silently. The hash gains a murmur3
  finalizer plus a cross-mix round, and the doc comment no longer claims it is a v5 UUID: it
  borrows v5's shape, it is not SHA-1, and saying so misleads the next implementer.
- **AC9** — **adopting never overwrites.** `doc.seed_*` are last-writer-wins upserts and the
  built-in lenses use fixed plateau ids that every install shares, so adopting someone's
  "Mathematics" would have rewritten the reader's own Arithmetic. An injected `has(kind, id)`
  predicate skips anything already present, making adoption purely additive — which is what AC5
  always claimed but never enforced.
- **AC10** — `parseLensBundle` fully validates rather than merely checking presence: every id must
  be UUID-shaped, every bridge endpoint and resource anchor must be a plateau the bundle itself
  defines, coordinates are coerced finite, and the raw graph shape (`position:{e1,e2,e3}`) is
  accepted alongside the bundle shape. `applyLensBundle` mutates a live CRDT row by row and cannot
  roll back, so anything that could throw mid-seed is rejected while rejecting is still free.
- **AC11** — cross-lens bridges are **preserved** as `external_bridges` rather than dropped. They
  cannot be seeded (the far endpoint is outside the lens) but they are the meet between two ways of
  seeing — RFC-0002's domain overlap — and dropping them from the file destroyed them permanently
  for every adopter.
- **AC12** — a bundle from a **future** schema version is refused and reported as such ("written by
  a NEWER version of the app") instead of being half-read as v1, which would have made a breaking
  v2 unshippable. `parseLensBundleResult` distinguishes too-new from corrupt.
- **AC13** — build and parse emit ONE canonical shape (`canonicalJson`), so re-emitting a bundle
  reproduces the bytes it was read from — the precondition for the content digest and signature
  slot a registry will want.
- **AC14** — adopt-path robustness: a file over GitHub's 1 MB contents-API limit (which returns
  empty content rather than an error — squarely the size a real degree-sized lens reaches) is
  reported as "too large" instead of silently reading as corrupt; remote-declared paths are refused
  unless they stay inside `lenses/` (R-0094 will read paths from an index a stranger authored); the
  read token is cleared in a `finally` and on panel toggle, not only on the success path; rows show
  which repo a lens came from; and the adopt actions use the `fr-actions` class the stylesheet
  actually defines.

### Changelog

- 2026-07-23 R-0093a implemented. Suite 597/597 (18 lens-bundle tests, up from 11). Live-verified
  the decisive case: a bundle renaming the built-in `Arithmetic` plateau now reports "you already
  had these topics" and leaves the local copy untouched — before R-0093a it would have renamed and
  relocated the reader's own topic. A genuinely new lens still adopts (111 → 113 topics); a v99
  bundle reports "written by a NEWER version of the app"; a `lenses/../../../etc` path is refused
  before any token-bearing fetch is made.
