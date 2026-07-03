# SPEC-0039 — Learning paths: a Rust-core `Path` + signed `KIND_PATH`, grounded on the domain meet

- **Status:** Draft — **§2.5 (meet-grounding) finalized 2026-07-03** against the now-landed RFC-0002 Phase 1 API (#14–#16); the spec now reads complete end to end. **Proposed: Draft → Accepted**, pending an architect review of the finalized §2.5 (see Changelog — this is a *proposal*, not a recorded approval).
- **Realizes:** R-0039
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-24
- **Depends on:** R-0036 / SPEC-0036 (the `KIND_PROOF` local-keep + opt-in-publish pattern this mirrors), R-0010 / SPEC-0010 (`NostrEvent`, `sign`, `recompute` that ignores non-reputation kinds), R-0030/R-0031 (mastery, for follow-progress), R-0035 (reach weighting), R-0038 (authored domains), **RFC-0002 Phase 1** (`domain_plane`/`membership`/`shared_line`/`MEMBERSHIP_TOLERANCE` — **landed**, `crates/mp-domain/src/domain.rs`; §2.5 only)
- **Status note:** the non-gated core (§2.1–§2.4, §2.6) is a re-application of proven R-0036 machinery and was architect-approved to start (Changelog 2026-06-24). §2.5 (the novel meet-grounding) was the one gated part; now that the Phase 1 API exists it is **finalized against the real signatures** (§2.5). What remains before `Accepted` is the architect review of that finalized §2.5.

## 1. Approach

A **path** is a named, goal-bearing, ordered list of plateau ids. It mirrors R-0036's
proof artifact almost exactly: a **pure Rust-core type** (`mp-domain`), a **signed
`KIND_PATH` event** (`mp-identity`, kind **30082**) that `recompute` **ignores** (a path is
content, not reputation), a **durable local store** (`mp.paths`, like `mp.proofs`), an
**opt-in publish**, and a **derived "published paths" view** (like `publishedProofs`). Both
clients consume the *same* wasm/gdext bindings — no parallel model.

The one genuinely new thing is **grounding**: where two paths cross domains, the shared
topics are computed on the domain **meet** (`shared_line`, RFC-0002). This was the only part
gated on Phase 1; that API has since **landed** (`mp-domain::{domain_plane, membership,
shared_line, MEMBERSHIP_TOLERANCE}`), so §2.5 is now finalized against the real signatures and
everything in the spec is buildable against today's code.

## 2. Design

### 2.1 Core type (`crates/mp-domain`, pure)

```rust
/// An ordered route through plateaus. Pure data + invariants; no async, no IO.
pub struct Path {
    pub id: Uuid,
    pub title: String,
    pub goal: String,
    pub steps: Vec<PlateauId>,   // ordered; deduped; non-empty to publish
}
```
Constructor validates: non-empty `title`, `steps` deduped preserving order. `steps` reference
plateaus by id (the path does not embed positions — it is resolved against the live graph,
like a `Mastery` references a plateau). Pure helpers: `reorder`, `insert`, `remove`.

**The spanned `domains` is NOT on the core `Path`** (architect finding #2): each plateau
already carries its own `domain_id`, so the domain set is a *derived projection* of live graph
state — baking it into the pure `Path` would make it a graph-validated invariant the pure type
can't uphold (and would tempt slice 5 to widen the core). Instead it is computed **at the
binding seam** — a `path_domains(&graph, &path) -> Vec<DomainId>` helper (like `convert.rs`
resolves names from the graph) — and carried only on `PathDoc`/`PathDto` (§2.2/§2.3). The core
`Path` stays pure and graph-free.

### 2.2 Signed event (`crates/mp-identity`, mirrors `Proof`)

```rust
pub const KIND_PATH: u32 = 30082;   // next after KIND_PROOF (30081)

/// Path content payload — self-contained, and NOT read by `recompute` (content,
/// not reputation): consumers are the local store + the "published paths" view.
pub struct PathDoc {
    pub id: Uuid,
    pub title: String,
    pub goal: String,
    pub steps: Vec<Uuid>,
    pub domains: Vec<Uuid>,
}
```
`recompute` is **unchanged** — it already sums only `KIND_TRAVERSAL` + `KIND_VOUCH` (verified:
`recompute.rs` matches kinds by equality, never exclusion), so `KIND_PATH` is ignored by
construction (assert with a byte-identical regression test over a log containing a vouch, as
`proof_signs_verifies_and_leaves_reputation_untouched` does). The `domains` field is filled by
`path_domains(&graph, &path)` at sign time (§2.1). Also export `path_kind() -> u32` from wasm
and pin it with `console.assert(path_kind() === PATH_KIND)`, mirroring `proof_kind()` — keeps
the constant single-sourced.

### 2.3 Bindings (`crates/mp-wasm` + `crates/mp-godot`)

- `sign_path_json(...) -> NostrEvent` mirroring `sign_proof_json` (cap `title`/`goal` lengths,
  char-boundary-safe; cap `steps` count). Host test: signs, verifies, leaves reputation
  untouched.
- A `PathDto { id, title, goal, steps, domains }` re-derived in `mp-godot` (the pure-consumer
  DTO pattern), so Godot reads paths without depending on `mp-wasm`.

### 2.4 Web: author / follow / keep / publish (`apps/web`, mirrors R-0036 proofs)

- **Pure module `paths.js`**: `PATH_KIND = 30082`; `buildPath({title, goal, steps})` factory
  (validate, dedup); `publishedPaths(events)` (latest-per-signer, malformed-skip, sorted) —
  the `publishedProofs` shape. Path `title`/`goal` are peer-authored free text → render via
  **`textContent`** (the safe attribution path), never the markdown-body renderer.
- **Local store** `mp.paths` (durable, like `mp.proofs`): create/edit/reorder locally;
  survives reload.
- **Follow**: render the path's steps over the map in order (highlight + connecting line);
  the **next step** = the first step whose plateau is not yet mastered (R-0030/R-0031);
  show progress `k/n`. Camera/UI only — never grants mastery or reach.
- **Publish**: an explicit button → `sign_path` → emit `KIND_PATH`; published paths appear in
  a derived list, trust-weighted by author reach (§2.6).

### 2.5 Grounding — intersect over islands (**finalized 2026-07-03 against the landed RFC-0002 Phase 1 API**)

RFC-0002 Phase 1 has landed (#14–#16): `mp-domain` now exports the meet/membership
primitives, pure and garust-backed, host-tested in `crates/mp-domain/src/domain.rs`. This
section is finalized against those **real** signatures (no longer a sketch):

```rust
// crates/mp-domain — re-exported from the crate root (lib.rs).
pub const MEMBERSHIP_TOLERANCE: f32 = 0.35; // near-plane band; seed topics sit 26–32% off
pub fn domain_plane(topics: &[&Mv], fallback_axis: &Mv) -> Mv; // grade-2, normalized
pub fn membership(v: &Mv, b: &Mv) -> f32;      // out-of-plane fraction in [0,1] (0 = in-plane)
pub fn is_member(v: &Mv, b: &Mv, tolerance: f32) -> bool;
pub fn shared_line(b1: &Mv, b2: &Mv) -> Mv;    // grade-1 meet; zero when planes are parallel
pub fn has_domain_overlap(b1: &Mv, b2: &Mv) -> bool;
```

**2.5.1 A domain's plane is derived, not stored (RFC-0002 §6.3b).** A grounding pass first
resolves, for each domain a path spans, that domain's characteristic plane via
`domain_plane(topics, fallback_axis)`, where `topics` = the grade-1 `position()` of every
plateau in the **live graph** whose `domain_id` matches (RFC-0002 §6.2 best-fit), and
`fallback_axis` = the domain's canonical/authored grade-1 lens direction (R-0038). Planes are
computed from live graph state and are **never baked into the signed `KIND_PATH`** — the
artifact stays content-only, and because positions live in the CRDT and domain ids are
name-derived (R-0038) both clients derive the *same* plane from the *same* synced topics.

**Seam note — the core has no domain registry.** Per RFC-0002 §3 there is no `Domain` record,
so `domain_plane`'s `fallback_axis` must be **supplied by the caller**. Grounding is therefore
a graph-aware helper at the **same binding seam** as `path_domains(&graph, &path)` (§2.1): it
takes the live `&KnowledgeGraph` (for positions + `domain_id`s) plus a
`domain_axis: impl Fn(DomainId) -> Mv` injected from the client's `DOMAINS`/`authorDomain`
mapping. For any domain with ≥2 topics the best-fit dominates and the fallback is unused, so
the injected axis only matters for **sparse (0–1 topic) domains**.

**2.5.2 A grounded island = the meet line of two domain planes.** Two domains overlap when
`has_domain_overlap(plane_a, plane_b)`; the island itself is `shared_line(plane_a, plane_b)` —
the grade-1 line of shared topics (RFC-0002 §4, the regressive meet). Parallel/degenerate
planes return the zero vector and are **skipped** — the "no meaningful overlap" guard is built
into `shared_line`/`has_domain_overlap` (RFC-0002 §6.1/§6, tested by
`parallel_planes_have_no_overlap`).

**2.5.3 A plateau is grounded on an island when it near-belongs to both planes.** A plateau's
grade-1 `position` lies on the meet line exactly when it is near *both* planes, so grounding
reuses `is_member` directly rather than inventing a point-to-line metric:

```
grounded(plateau, plane_a, plane_b)  ≔  is_member(pos, plane_a, τ) && is_member(pos, plane_b, τ)
```

with `τ = MEMBERSHIP_TOLERANCE` (0.35) reused verbatim — the same fuzzy band RFC-0002 tuned
against the real seeds (§2.5.7 flags whether path-grounding should get its own band).

**2.5.4 Two scopes — intra-path and inter-path.**
- **Intra-path:** a single path threading ≥2 domains has an internal grounded island wherever
  two of *its own* domains meet — the "study AI + Physics, both grounded in GA" crossing
  (R-0039 §2). For each unordered pair of the path's `path_domains`, compute the island and the
  path steps grounded on it.
- **Inter-path:** two authors' paths "intersect over a grounded island" when a domain of one
  and a domain of the other meet **and** both paths have steps grounded on that line — surfaced
  as "grounded with <author/path>" on those plateaus.

**2.5.5 Resource reuse — collect, never fork.**
- **Same-plateau fast path (unchanged):** two paths sharing a plateau UUID literally share that
  plateau's `Resource` rows in the CRDT; reuse is automatic.
- **Geometric reuse (the new part):** two *different* plateau ids both grounded on the same
  island present their resources/exams (R-0027/R-0028) as **one pooled study surface** rather
  than forking — the union across the island's plateaus, deduped by normalized URI (reuse
  R-0028's `normalizeUrl`/`crossLinks`), rendered under "grounded with …". Authoring still
  targets a real plateau; the island is a **read-side overlay that collects existing
  resources and stores nothing new** (CLAUDE.md §6) — no new CRDT/authoritative entity.

**2.5.6 Where it lives (proposed).** A pure, graph-aware helper beside `path_domains` in
`crates/mp-domain/src/path.rs` (or a sibling `grounding.rs`), host-tested against the seed
planes exactly as `domain.rs` is:

```rust
pub struct GroundedIsland {
    pub domain_a: DomainId,
    pub domain_b: DomainId,
    pub line: Mv,                    // shared_line(plane_a, plane_b), grade-1
    pub plateaus_a: Vec<PlateauId>,  // path-A steps grounded on the line
    pub plateaus_b: Vec<PlateauId>,  // path-B steps grounded on the line (== plateaus_a intra-path)
}

/// Islands where two paths (or one path with itself, `a == b`) cross grounded ground.
/// Uses the live graph for positions/domains; `domain_axis` injects the R-0038 lens
/// fallback for sparse domains (the core has no domain registry — §2.5.1 seam note).
pub fn grounded_islands(
    graph: &KnowledgeGraph,
    a: &Path,
    b: &Path,
    domain_axis: impl Fn(DomainId) -> Mv,
) -> Vec<GroundedIsland>;
```

Exposed to both clients through `mp-wasm` + `mp-godot` as JSON (RFC-0002 Phase 2 / R-0039
slice 5, #17), so web and Godot render the *same* islands — no parallel model.

**2.5.7 Open questions flagged for the architect (do not treat as settled):**
- **Grounding band:** reuse `MEMBERSHIP_TOLERANCE` (0.35) as above, or a separate — likely
  wider — path-grounding band? (R-0039 §5, RFC-0002 §10.) *Lean: reuse until evidence says
  otherwise.*
- **Cross-user plane agreement:** derived planes agree only when both users hold the same
  domain topics; divergent topic sets → divergent planes → divergent meets. Is derived
  (RFC-0002 §6.3b) sufficient for *shared* paths, or does it force an authoritative synced
  plane (§6.3a)? (R-0039 "Depends on" note.)
- **Meet degeneracy threshold:** `shared_line` zeroes parallel planes at `ga::EPSILON`; do we
  want a wider "not meaningfully overlapping" band for *near*-parallel domains? (RFC-0002 §10.)
- **`KIND_PATH` encoding:** confirm grounded islands stay **derived** (computed read-side),
  not encoded into the signed artifact — the recommendation here (keeps the payload
  self-contained and consistent with derived planes). (R-0039 §5.)

### 2.6 Trust (R-0035)

A published path's prominence is weighted by the author's **earned reach** in the path's
domain(s), via the existing `rank_wizards`/weighted-approval machinery — never a head-count;
a no-reach Sybil contributes ~0 (grade-collapse preserved). No new reputation path.

## 3. Files (planned)

| File | Change |
|------|--------|
| `crates/mp-domain/src/path.rs` (new) | `Path` type + pure helpers + tests |
| `crates/mp-identity/src/event.rs` | `KIND_PATH = 30082` + `PathDoc` payload |
| `crates/mp-identity/src/recompute.rs` | regression test: `KIND_PATH` leaves reputation untouched (no code change expected) |
| `crates/mp-wasm/src/convert.rs` + `lib.rs` | `sign_path` + host tests |
| `crates/mp-godot/src/dto.rs` + binding | `PathDto` + accessor |
| `apps/web/src/paths.js` (new) + `paths.test.mjs` | pure `buildPath`/`publishedPaths` + tests |
| `apps/web/src/main.js`, `index.html` | author/follow/publish UI + `mp.paths` store |
| `requirements/0039-*`, `specs/0039-*`, READMEs | status/index |

## 4. Implementation slices (the runway for GitHub issues, once accepted)

1. **Core + event (unblocked now):** `Path` (mp-domain) + `KIND_PATH`/`PathDoc` (mp-identity)
   + `recompute`-ignores test. Pure, host-tested.
2. **Bindings (after 1):** `sign_path` (wasm) + `PathDto` (gdext) + host tests.
3. **Author + follow, web (after 2):** `paths.js`, `mp.paths` store, build/edit/reorder,
   render + next-step.
4. **Publish + trust, web (after 3):** opt-in `KIND_PATH` publish, `publishedPaths`, reach
   weighting (R-0035).
5. **Grounding (Phase 1 #14–#16 landed → now unblocked):** §2.5 — `grounded_islands` over the
   meet + membership + resource reuse, host-tested against the seed planes. This is #17 /
   RFC-0002 Phase 2. Finalized in §2.5 against the real API; awaits the architect review of the
   finalized section before implementation.
6. **Godot parity (after 2):** render a path + follow in the Godot client. **Sub-task
   (architect note):** mp-godot today consumes only the CRDT graph blob and has no
   signed-event-log ingestion (no proof/mastery DTO exists there either) — slice 6 must add
   an event-log source to the Godot client before a `PathDto` can be fed (see
   `docs/SYNC_CONTRACT.md` for the proposed `events.json` ingestion slice).

Slices 1–4 are **implemented** on the active branch (`Path` + `KIND_PATH`, `sign_path`,
`PathDto` + `path_domains`, web author/follow/publish). Slice 5 (grounding) was the only part
gated on Phase 1; that API has **landed**, so §2.5 is finalized and slice 5 is unblocked
pending review. Slice 6 (Godot parity + event-log ingestion) tracks #28.

## 5. Non-goals (from R-0039 §4)

`KIND_PATH` is a signed event, never CRDT/authoritative/reputation; following ≠ mastering;
no new GA axis (grounding uses RFC-0002 planes); no real-time collab editing, no version
history UI beyond re-publish, no auto-curation, no completion credential.

## 6. Test plan (core slices)

- **mp-domain:** `buildPath` validates/dedups/preserves order; empty title rejected; reorder
  helpers deterministic.
- **mp-identity:** a `KIND_PATH` event signs + verifies; **`recompute` over a log containing a
  `KIND_PATH` yields byte-identical reputation** to the log without it.
- **paths.js:** `publishedPaths` = latest-per-signer, malformed-skipped, sorted; `buildPath`
  pure.
- **grounding (§2.5):** `grounded_islands` over the seed planes — canonical Math∧Physics meet
  yields an island on the shared axis; parallel/same-domain planes yield **no** island (the
  degeneracy guard); a plateau grounded on an island is `is_member` of both planes at
  `MEMBERSHIP_TOLERANCE`; resource pooling dedupes by normalized URI. Reuses `domain.rs`'s
  existing seed-plane tests as the fixtures.
- **e2e (web):** author a path → follow (next-step tracks mastery) → reload (persists) →
  publish (signed event appears) → console clean.

## Changelog

- 2026-07-03 **§2.5 (meet-grounding) finalized** against the landed RFC-0002 Phase 1 API
  (#14–#16, `crates/mp-domain/src/domain.rs`): cited the real `domain_plane` / `membership` /
  `is_member` / `shared_line` / `has_domain_overlap` / `MEMBERSHIP_TOLERANCE` signatures;
  defined a grounded island as `shared_line(plane_a, plane_b)`, a grounded plateau as
  `is_member` of *both* planes at `MEMBERSHIP_TOLERANCE`, the intra-/inter-path scopes, and
  read-side resource pooling (collect, never fork — no new CRDT entity). Added the derived-plane
  seam note (the core has no domain registry → `domain_axis` injected at the binding seam, like
  `path_domains`), the proposed `grounded_islands` helper, and four open questions flagged for
  the architect (grounding band, cross-user plane agreement, near-parallel degeneracy,
  `KIND_PATH` encoding stays derived). With the gated section now complete, **proposed Status
  Draft → Accepted, pending an architect review of the finalized §2.5** — recorded here as a
  proposal only; no approval is claimed.
- 2026-06-24 architect review of the **non-gated core**: **APPROVE** — slice 1 (`Path` +
  `KIND_PATH` + recompute-ignores test) is safe to start now, in parallel with Phase 1, no
  rework risk; the §2.5 deferral line is correct. Folded the required edit (keep `domains` off
  the pure `Path`; derive at the binding seam via `path_domains`) + advisories (`path_kind()`
  export + pin; `title`/`goal` via `textContent`; slice-6 needs Godot event-log ingestion).
  Core sections now ready to implement; overall status stays **Draft** until §2.5 + full
  architect review once the Phase-1 API exists.
- 2026-06-24 drafted (partial). Non-gated core fully specified (mirrors R-0036); §2.5
  grounding deferred to RFC-0002 Phase 1 (#14–#16). Slices 1–4/6 buildable now; slice 5 waits.
