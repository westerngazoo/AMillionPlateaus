# SPEC-0039 — Learning paths: a Rust-core `Path` + signed `KIND_PATH`, grounded on the domain meet

- **Status:** Draft (partial — the non-gated core is specified; §2.5 grounding is **deferred to RFC-0002 Phase 1**, GitHub #14–#16)
- **Realizes:** R-0039
- **Depends on:** R-0036 / SPEC-0036 (the `KIND_PROOF` local-keep + opt-in-publish pattern this mirrors), R-0010 / SPEC-0010 (`NostrEvent`, `sign`, `recompute` that ignores non-reputation kinds), R-0030/R-0031 (mastery, for follow-progress), R-0035 (reach weighting), R-0038 (authored domains), **RFC-0002 Phase 1** (`domain_plane`/`shared_line` — §2.5 only)
- **Not accepted yet:** needs architect review + the §2.5 API to exist. This draft fixes the ~80% that is a re-application of proven R-0036 machinery so the team has a runway; §2.5 (the novel meet-grounding) is sketched, not final.

## 1. Approach

A **path** is a named, goal-bearing, ordered list of plateau ids. It mirrors R-0036's
proof artifact almost exactly: a **pure Rust-core type** (`mp-domain`), a **signed
`KIND_PATH` event** (`mp-identity`, kind **30082**) that `recompute` **ignores** (a path is
content, not reputation), a **durable local store** (`mp.paths`, like `mp.proofs`), an
**opt-in publish**, and a **derived "published paths" view** (like `publishedProofs`). Both
clients consume the *same* wasm/gdext bindings — no parallel model.

The one genuinely new thing is **grounding**: where two paths cross domains, the shared
topics are computed on the domain **meet** (`shared_line`, RFC-0002). That is the only part
gated on Phase 1; everything else can be built against today's code.

## 2. Design

### 2.1 Core type (`crates/mp-domain`, pure)

```rust
/// An ordered route through plateaus. Pure data + invariants; no async, no IO.
pub struct Path {
    pub id: Uuid,
    pub title: String,
    pub goal: String,
    pub steps: Vec<PlateauId>,   // ordered; deduped; non-empty to publish
    pub domains: Vec<DomainId>,  // the domains the steps span (derived from the graph)
}
```
Constructor validates: non-empty `title`, `steps` deduped preserving order. `steps` reference
plateaus by id (the path does not embed positions — it is resolved against the live graph,
like a `Mastery` references a plateau). Pure helpers: `reorder`, `insert`, `remove`.

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
`recompute` is **unchanged** — it already sums only `KIND_TRAVERSAL` + `KIND_VOUCH`, so
`KIND_PATH` is ignored by construction (assert with a regression test, as proofs/mastery do).

### 2.3 Bindings (`crates/mp-wasm` + `crates/mp-godot`)

- `sign_path_json(...) -> NostrEvent` mirroring `sign_proof_json` (cap `title`/`goal` lengths,
  char-boundary-safe; cap `steps` count). Host test: signs, verifies, leaves reputation
  untouched.
- A `PathDto { id, title, goal, steps, domains }` re-derived in `mp-godot` (the pure-consumer
  DTO pattern), so Godot reads paths without depending on `mp-wasm`.

### 2.4 Web: author / follow / keep / publish (`apps/web`, mirrors R-0036 proofs)

- **Pure module `paths.js`**: `PATH_KIND = 30082`; `buildPath({title, goal, steps})` factory
  (validate, dedup); `publishedPaths(events)` (latest-per-signer, malformed-skip, sorted) —
  the `publishedProofs` shape.
- **Local store** `mp.paths` (durable, like `mp.proofs`): create/edit/reorder locally;
  survives reload.
- **Follow**: render the path's steps over the map in order (highlight + connecting line);
  the **next step** = the first step whose plateau is not yet mastered (R-0030/R-0031);
  show progress `k/n`. Camera/UI only — never grants mastery or reach.
- **Publish**: an explicit button → `sign_path` → emit `KIND_PATH`; published paths appear in
  a derived list, trust-weighted by author reach (§2.6).

### 2.5 Grounding — intersect over islands (**DEFERRED to RFC-0002 Phase 1, #14–#16**)

> This section is intentionally not final: it needs `domain_plane` (#15) and
> `shared_line`/`membership` (#16). Intended shape, to be confirmed against the real API:

- For each domain a path spans, take its `domain_plane` (fitted, #15).
- Two paths are **grounded together** on the topics lying near `shared_line(planeA, planeB)`
  (#16) within `MEMBERSHIP_TOLERANCE` — surfaced as "grounded with <author/path>" on those
  plateaus, where their resources/exams (R-0027/R-0028) are **reused**, not forked.
- Exact same-plateau reuse remains the fast path; the meet adds the geometric overlap where
  ids differ but the ground is the same.

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
5. **Grounding (after Phase 1 #14–#16 + slice 1):** §2.5 — meet-based shared islands + reuse.
6. **Godot parity (after 2):** render a path + follow in the Godot client.

Slices 1–4 + 6 are **unblocked** by Phase 1; only slice 5 waits on #14–#16.

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
- **e2e (web):** author a path → follow (next-step tracks mastery) → reload (persists) →
  publish (signed event appears) → console clean.

## Changelog

- 2026-06-24 drafted (partial). Non-gated core fully specified (mirrors R-0036); §2.5
  grounding deferred to RFC-0002 Phase 1 (#14–#16). Not accepted — pending architect review +
  the Phase-1 API. Slices 1–4/6 are buildable now; slice 5 waits on #14–#16.
