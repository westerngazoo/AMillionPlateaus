# BACKLOG — what's outstanding

A live view of the work **not yet done**, cross-linked to GitHub issues. Complements
[`ROADMAP.md`](../ROADMAP.md) (the high-level phase map) and the SDLC docs in
[`requirements/`](../requirements/README.md) + [`specs/`](../specs/README.md): the roadmap
says *where we're going*; this file says *what's left on the active fronts and who's blocked
on what*.

Implementation is dispatched to the dev team as GitHub issues; Claude authors the
RFCs / requirements / specs and the dev-ready tickets. Last synced: 2026-07-02.

---

## Front 1 — RFC-0002: domains as bivectors

A domain becomes an oriented **plane (grade-2 bivector)** in the existing `Cl(3,0,0)`;
membership is the wedge (`v ∧ B ≈ 0`), overlap is the meet (`B₁ ∨ B₂` → a line = the
grounded island). Additive, garust-only, no new axis. See
[`docs/rfcs/0002-domains-as-bivectors.md`](rfcs/0002-domains-as-bivectors.md) and the spike
[`crates/mp-graph/examples/bivector_meet_spike.rs`](../crates/mp-graph/examples/bivector_meet_spike.rs).

Epic: **#13**.

| Phase | Task | Issue | Status |
|-------|------|-------|--------|
| 1 | `ga` adapter: `wedge` / `meet` / `dual` wrappers + tests | #14 | ✅ merged (PR #20) |
| 1 | `mp-domain`: `domain_plane(topics)` best-fit plane + canonical fallback | #15 | ✅ merged (PR #23 → consolidated in `domain.rs`) |
| 1 | `mp-domain`: `membership(v,B)` tolerance + `shared_line(meet)` + degeneracy guard | #16 | ✅ merged (PR #23 → consolidated in `domain.rs`) |
| 2 | Surface overlaps in clients + paths on the meet | #17 | ⬜ open (also R-0039 slice 5) |
| 3 | *(optional)* migrate reach/fog onto the domain plane | — | 🔒 future RFC, gated on Phase 2 evidence |

**Membership needs a near-plane tolerance** (real seed topics sit 26–32 % off a single
plane, per the spike) and the plane should be **fit** to a domain's topics — both baked into
#15 / #16.

---

## Front 2 — R-0039: learning paths (the flagship)

Author/follow/keep/publish an ordered route through the islands as a Rust-core signed
**`KIND_PATH` (30082)** artifact reused by web + Godot; paths intersect over grounded
islands via the RFC-0002 meet; trusted by earned reach (R-0035). `recompute` ignores it.
Requirement [`0039`](../requirements/0039-learning-paths.md), spec
[`0039`](../specs/0039-learning-paths.md) (Draft — §2.5 grounding gated on Phase 1).

Epic: **#24**. Architect-approved: **slices 1–4 + 6 do not depend on RFC-0002 Phase 1**;
only slice 5 (grounding) does.

| Slice | Task | Issue | Depends on |
|-------|------|-------|------------|
| 1 | Rust-core `Path` + `KIND_PATH` + recompute-ignores test | #19 | — ✅ done |
| 2 | Bindings: `sign_path` (wasm) + `path_domains` seam + `PathDto` (gdext) | #25 | #19 ✅ wasm + gdext DTO; `path_domains` in `mp-domain` |
| 3 | Web: author + follow (`paths.js`, `mp.paths`, render + next-step) | #26 | #25 ✅ |
| 4 | Web: publish + trust (opt-in `KIND_PATH`, `publishedPaths`, R-0035) | #27 | #26 ✅ publish; trust weighting still uses R-0035 reach on publish list (future polish) |
| 5 | Grounding: meet-based shared islands + resource reuse | #17 | #15 + #16 + #19 |
| 6 | Godot parity: path render/follow + **event-log ingestion** | #28 | #25 |

Note (slice 6): the Godot client consumes only the CRDT graph blob today — it has **no
signed-event-log ingestion** (no proof/mastery/path DTO there yet); slice 6 must add it.

---

## Front 3 — Study mode: the first real-life test

The owner is now studying WITH the tool (the "ground-up new physicist" lens): the QC
curriculum region is seeded in-app ([`curriculum.js`](../apps/web/src/curriculum.js) —
22 plateaus / 28 bridges across the Classical ↔ Intuitionistic fork, bodies + KaTeX),
and the long-horizon spine + usage loop live in
[`curriculum/lem-free-foundations.md`](curriculum/lem-free-foundations.md) +
[`curriculum/STUDY-GUIDE.md`](curriculum/STUDY-GUIDE.md). Code adjusts as study exposes
gaps.

| Task | Issue | Status |
|------|-------|--------|
| LOD roadmaps: expand a plateau into a sub-roadmap (semantic zoom in/out, progress roll-up) | #31 | ⬜ needs R-0040 requirement first |

---

## Owed by Claude (spec/doc work, not dev-team)

- Finalize **SPEC-0039 §2.5** (the meet-grounding design) against the *real* API once #15 + #16
  land, then a full architect review of the complete spec.
- Tick epic checkboxes (#13, #24) as slices merge; QA each merged requirement.
- When #15 + #16 land, the RFC-0002 Phase-1 primitives are done → decide whether Phase 3
  (reach-on-plane) is warranted (its own RFC).

---

## Parked / known gaps (not on an active front)

- **R-0025 (VR / immersive, Godot)** — Accepted, slice 1 landed; remaining: native
  reachable/fog, vote/sign in-world, cross-binding parity, the OpenXR rig (AC4), worldspace
  study (AC5), a native sync transport (AC7). Parked in favour of mobile+web + the
  bivector/paths work.
- **JS static-analysis gate** — `apps/web` has no lint/format gate (only Rust has
  `cargo fmt`/`clippy`); the growing JS surface is unenforced. Candidate infra task.
- **PWA** — suggested over Electron for an installable desktop build; not yet ticketed.

---

## Dependency picture

```
RFC-0002 Phase 1:   #14 ✅ ──► #15 domain_plane ─┐
                                #16 membership ──┴─► #17 grounding (R-0039 slice 5)
                                                        ▲
R-0039 core:        #19 Path+KIND_PATH ─► #25 bindings ─┼─► #26 web author/follow ─► #27 publish/trust
                                                        └─► #28 Godot parity
```
Two tracks run in parallel; they converge only at grounding (#17).
