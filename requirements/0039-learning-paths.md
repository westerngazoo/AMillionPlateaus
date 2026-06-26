# R-0039 — Learning paths: author a route through the islands, publish it, intersect over grounded ground

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-24
- **Depends on:** R-0036 (the local-keep + opt-in signed-publish pattern, `KIND_PROOF` — paths mirror it), R-0035 (trusted-by-earned-reach weighting), R-0010 (Nostr-signed events + recompute that ignores non-reputation kinds), R-0030/R-0031 (topic mastery, for path progress), R-0038 (authored domains the path threads), **RFC-0002 Phase 1** (`domain_plane` / `shared_line`, GitHub #14–#16 — the geometry that makes path intersection *computed*)

- **Realized by:** SPEC-0039 (pending — deferred until RFC-0002 Phase 1 primitives land so the spec cites their real API)
- **Tracks:** GitHub #17 (RFC-0002 Phase 2)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A wizard can **author an ordered learning path** — a named, goal-bearing sequence of
plateaus (topic islands) — **follow it** (the path drawn over the map, with a "next step"),
**keep it locally and publish it deliberately** as a **signed `KIND_PATH` artifact**
(mirroring R-0036 proofs: local-first, opt-in publish, `recompute` ignores it), and have
paths **intersect over grounded islands** so authors **reuse** each other's resources,
exams, exercises, and practices on the shared topics. The `Path` type and its event live in
the **Rust core** (`mp-domain` + `mp-identity`), exposed via wasm + gdext, so **web and Godot
reuse one implementation**. Where two paths cross domains, the shared ground is **computed**
on the domain **meet** (`shared_line`, RFC-0002), not merely "same plateau id"; a published
path's standing is **weighted by the author's earned reach** in the relevant domain (R-0035),
never a head-count.

## 2. Rationale

This is the heart of the project's vision. The owner is authoring a personal route — study
AI + Physics, ground both in Geometric Algebra, rebuild math and computation toward physics
from that base, research hardware to build a GPU, then rewrite AI on their own hardware
(needing FPGA + electronics grounded in GA electromagnetics). That route is a **path**. Other
people's paths cross it over the **grounded islands** (GA, mechanics, electromagnetism, …),
and at each crossing everyone should **reuse and add** resources/exams/exercises/practices
instead of duplicating them. Paths are the connective tissue over the island world; RFC-0002
makes "where do these routes share ground?" a single geometric operation (the meet) rather
than a coincidence of identifiers.

## 3. Acceptance criteria

- **AC1 — Author a path.** A wizard creates a path with a **title + goal** and an **ordered
  list of plateaus**, and can reorder/insert/remove steps. Authoring is local and never
  silently published.

- **AC2 — Follow a path.** The path renders over the map (its plateaus/steps highlighted in
  order); the client surfaces the **next step** (the next not-yet-mastered plateau, using
  R-0030/R-0031 mastery), and shows progress along the route. Following changes camera/UI
  focus only — it does not alter reach or grant mastery.

- **AC3 — Rust-core artifact.** A `Path` type lives in the **Rust core** (`mp-domain`), pure
  (no async, garust-only where geometry is involved), exposed through **wasm and gdext** so
  both clients consume the *same* type — no parallel JS/GDScript reimplementation of the
  model. A `KIND_PATH` (= 30082) signed event carries a published path.

- **AC4 — Keep locally, publish deliberately.** A path is **durable locally** (a store
  mirroring `mp.proofs`, R-0036) and survives reload; publishing is an **explicit, opt-in**
  action that emits the signed `KIND_PATH` event. **`recompute` ignores `KIND_PATH`** — a
  path is content, never reputation (it sums only traversal + vouch, as for mastery/proof).

- **AC5 — Intersect over grounded islands.** When two paths traverse different domains, their
  **shared ground is computed** via the domain **meet** (RFC-0002 `shared_line` + near-plane
  membership) — surfaced as "grounded with <path/author>" on the shared topics — so the
  plateaus on that island **reuse the same resources/exams/exercises** (R-0027/R-0028) rather
  than forking them. Exact same-plateau reuse still works; the meet adds the *geometric*
  overlap where ids differ but the ground is the same.

- **AC6 — Trusted by earned reach.** A published path's prominence/trust is **weighted by the
  author's earned reach** in the domain(s) it covers (R-0035's weighted approval), **not** a
  head-count; a Sybil with no earned reach contributes ~0 (grade-collapse preserved).

- **AC7 — Additive, safe, verified.** The core `Path` + `KIND_PATH` are **pure + unit-tested**;
  both clients reuse the bindings; **reputation is never a scalar and never in the CRDT**;
  the Grade-1 plateau / even-grade bridge invariants are untouched; **garust is the only math
  layer**. All suites green; browser (web) + headless (Godot) verified.

## 4. Constraints & non-goals

- **A path is content, not reputation.** `KIND_PATH` is a **signed event**, never CRDT
  authoritative state and never a reputation input (`recompute` ignores it) — same discipline
  as `KIND_PROOF`/`KIND_MASTERY`.
- **Intersection is the meet, not a new axis.** Grounding uses RFC-0002's grade-2 domain
  planes + `shared_line`; no higher-dimensional algebra, no garust change.
- **Following ≠ mastering.** Walking a path never grants mastery or reach; progress is read
  from the existing mastery signals.
- **Cross-user alignment** of domains reuses R-0038's name-derived domain ids + RFC-0002
  planes; this requirement does not introduce a separate domain registry.
- **Non-goals:** real-time collaborative path editing; a path-versioning/history UI beyond
  re-publishing; automatic path curation/ranking pages; turning paths into a course-completion
  credential. (Each a possible later requirement.)

## 5. Open questions

- **Step granularity:** plateaus only, or may a step also pin a specific bridge/resource/exam?
  (Lean: plateaus for v1; resources reused via the existing per-plateau study view.)
- **Grounding tolerance:** how "near the meet line" a path's plateaus must sit to count as
  grounded — reuse RFC-0002's `MEMBERSHIP_TOLERANCE`, or a separate path-grounding band?
- **`KIND_PATH` payload shape:** ordered plateau ids + title + goal + domain set; how (if at
  all) to encode the grounded-island references so a consumer can verify them.
- **Sequencing:** SPEC-0039 is gated on RFC-0002 Phase 1 (#14–#16). Author the spec when
  `domain_plane`/`shared_line` exist so it cites the real API; until then this requirement is
  the stable WHAT.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-24 | Paths are a **Rust-core signed artifact** (`Path` + `KIND_PATH`), both clients reuse | Owner choice ("rust all"); avoids a parallel JS/GDScript model; mirrors the proven R-0036 proof-publish pattern |
| 2026-06-24 | Path **intersection = the domain meet** (RFC-0002 `shared_line`), not just shared ids | Makes "grounded islands" computed structure; the whole point of RFC-0002, and what lets reuse span differently-identified-but-same ground |
| 2026-06-24 | `recompute` **ignores `KIND_PATH`**; trust via R-0035 reach | A path is content; reputation stays earned from traversal/vouch only (CLAUDE.md §4/§7) |
| 2026-06-24 | SPEC deferred until RFC-0002 Phase 1 lands | The spec must cite the real `domain_plane`/`shared_line` API (#14–#16) |

## Changelog

- 2026-06-24 created (Accepted) — author/follow/keep/publish an ordered learning path as a
  Rust-core signed `KIND_PATH` (30082) artifact, reused by web + Godot; paths intersect over
  grounded islands via RFC-0002's domain meet (`shared_line`), reusing resources/exams on the
  shared ground; trusted by earned reach (R-0035); `recompute` ignores it. Tracks GitHub #17.
  SPEC-0039 pending RFC-0002 Phase 1 (#14–#16).
