# R-0094 — lenses/index.json: a lens can be discovered, not just fetched

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-24
- **Depends on:** R-0093 / R-0093a (a lens is a portable, validated bundle).
- **Source:** the owner: "ok do them both" — the remaining half of the "go big" lens arc, and the
  piece standing between what exists and their original "all people shall be able to do it".

## 1. Statement

R-0093 made a lens a portable file, but adopting one still meant **knowing a repo URL**, and listing
a repo meant fetching **every bundle in the folder** to learn its title and size — N serial requests,
rate-limit-prone, with no way to see what a lens holds before pulling it.

This adds `lenses/index.json`: one small file describing what a repo publishes. Publishing now keeps
it in step; listing reads it in **one fetch** and shows each lens's title and counts, and the bundle
itself is fetched **only when you adopt**. That is also what makes a *shared* registry repo possible
— several wizards publishing into one index is how discovery stops meaning "ask me for my URL".

The index is **derived data**: every row restates what is already inside a bundle, so it can always
be rebuilt by reading the folder. It is a cache that happens to live in git, never the source of
truth — and a reader that has no index (or distrusts it) still falls back to listing the directory.

## 2. Acceptance criteria

- **AC1** — pure `lens-registry.js`: `buildIndexEntry` derives a row from a bundle (id, path, label,
  counts, optional title/author/note); `upsertIndex` is keyed by lens id, ordered by label, and
  **never mutates its input**, so re-publishing replaces a row instead of duplicating it;
  `removeFromIndex` unpublishes; `registryJson` emits canonical bytes so the file's git diff stays
  readable. Unit-tested.
- **AC2** — `parseIndex` treats rows as **untrusted**: a `path` is fetched with the reader's token
  attached, so any row whose path escapes `lenses/` is **dropped, not repaired**; ids dedupe; counts
  are coerced non-negative; a **future** registry version is refused rather than half-read.
- **AC3** — publishing writes the bundle **and** upserts the index. If the index write fails the
  bundle is still published and still adoptable, and the message says exactly that rather than
  implying the publish failed.
- **AC4** — listing a repo reads `lenses/index.json` in **one fetch** and renders each lens with its
  preview; the bundle is fetched only on Adopt. This is also the proper fix for R-0093a's finding
  that listing was unbounded and serial.
- **AC5** — **backwards compatible**: a repo published by plain R-0093 has no index, so listing falls
  back to the folder via `indexFromPaths`, and those rows say "counts unknown (no index in that
  repo)" instead of pretending to know.
- **AC6** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-24 created (Accepted) + implemented. Suite 624/624 (8 new lens-registry tests).
  Live-verified against a stubbed forge, both paths: a repo **with** an index listed in exactly ONE
  fetch (`lenses/index.json`) showing "Optics for Engineers — 2 topics, 1 bridge · from
  someone/lenses" without touching the bundle, and Adopt then fetched it and merged (170 → 172
  topics); a repo **without** an index fell back to the folder, reported "(no index — counts show
  after adopting)", and its row read "counts unknown (no index in that repo)".
