# R-0014 — Trail Markers: anchor a note or resource to a plateau

- **Status:** Accepted
- **Milestone:** POC — Draft DB (annotation)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** R-0011 (plateau authoring), R-0012 (durability), R-0013 (bridge authoring pattern), R-0005 (sync + render)
- **Realized by:** SPEC-0014 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A wizard can grow the world's nodes (R-0011) and connect them (R-0013), but
cannot yet leave **content** on a plateau. This requirement lets a wizard
**anchor a marker** to an existing plateau: a short **title**, a **kind**
(Note / Article / Video / Interactive / Paper / Tool), and an optional **link
(URI)**. The marker enters the shared CRDT `resources` map, renders near its
plateau on the map, syncs to other open tabs, and survives a reload (R-0012).

This is the VISION's "trail marker" / "floating debris" mechanic in its first
form: contributed content starts **Floating** (uncrystallized). Voting it into
permanence is the next requirement (R-0015); here we only **place** it.

## 2. Rationale

Plateaus and bridges give the world its shape; markers give it **substance** —
the papers, explanations, and personal notes that make a plateau worth visiting.
It is also the precondition for the social layer: you cannot vote a resource into
the bedrock (R-0015) until resources can be contributed. The `Resource` type, the
`resources` CRDT map, and the `vote`/`resource_vote` tally already exist in the
core; what is missing is a way to **author** a resource from the browser and to
**see** it. This requirement adds exactly that, mirroring the R-0011/R-0013
authoring pattern (pure factory + form), plus a thin additive Rust binding and a
small render affordance.

## 3. Acceptance criteria

- **AC1 — Marker authoring form.** A **"Drop a marker" form** offers: a
  **plateau** select (the anchor, populated from the current graph, by name), a
  **title** text input, a **kind** select (the six `ResourceKind` values under
  human labels), and an optional **link** text input, plus a submit button. The
  plateau + kind selects are rebuilt from the current graph/kind-list when the
  form opens.

- **AC2 — Marker appears on the map.** On submit, the marker is added to the CRDT
  `resources` map and rendered **near its anchor plateau** in the same frame,
  visually distinct from plateau discs (e.g. a small marker glyph + its title),
  and marked **Floating** (not yet crystallized). Multiple markers on one plateau
  are laid out without fully overlapping.

- **AC3 — Validation, no degenerate markers.** The form rejects, with an inline
  error and no CRDT write: a **missing plateau** anchor. A **blank title** gets a
  sensible fallback (e.g. "Untitled note"); an **empty link** is allowed (a note
  need not link anywhere); an unknown/blank **kind** defaults to **Note**.

- **AC4 — Syncs across tabs and survives a reload.** The marker propagates to
  other open tabs via the existing BroadcastChannel CRDT path (R-0005) and is in
  the IndexedDB snapshot (R-0012), so it is still present, still anchored to its
  plateau, after a full close/reload with no other tab open.

- **AC5 — State starts Floating; attribution deferred.** A new marker is created
  in `ResourceState::Floating` with `vote_count = 0`. Like authored plateaus and
  bridges, it records no wizard attribution this phase (`contributor = nil`,
  empty signature) — wizard-signed contribution is tracked with the other
  attribution work as a future requirement.

- **AC6 — Pure `buildResource` factory, unit-tested.** A new pure
  `buildResource({ plateau, title, kind, uri })` validates/normalises (require a
  plateau; trim title + fallback; default an unknown/blank kind to "Note"; trim
  uri, empty allowed) and returns the arg shape `add_resource` accepts as a tagged
  result (`{ plateau, title, kind, uri, error: null }` or `{ error }`). Tested via
  `node --test`, no WASM: valid → ok; missing plateau → error; blank title →
  fallback; unknown/blank kind → "Note"; empty uri allowed; deterministic.

- **AC7 — Additive Rust only; the four root keys are unchanged.** The Rust change
  is limited to: a `Resource` creation constructor and a thin
  `WasmCrdtDoc::add_resource` binding (wrapping the existing core `add_resource`),
  plus a `ResourceDto` + a `WasmGraph::resources()` accessor for rendering (value
  marshalling, no GA). The synced doc's root keys stay exactly
  `{bridges, plateaus, resources, votes}` (resources was always one of the four);
  no reputation enters the CRDT (CLAUDE.md §7).

- **AC8 — Green across all suites.** `cargo test --workspace`, `wasm-pack test
  --node`, `node --test apps/web/src/*.test.mjs`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt --all --check` all green; the page drops a marker,
  reloads, and shows it with no uncaught console errors.

## 4. Constraints & non-goals

- **Reuse the existing `resources`/`votes` core.** Markers are `Resource`s in the
  already-audited `resources` CRDT map; the only new Rust is the creation
  constructor, the `add_resource` WASM binding, and a render DTO/accessor.
- **Markers are CRDT graph state**, like plateaus and bridges — not
  reputation-bearing signed events. (Signed, attributed contribution converges on
  the event-sourced model later, the same seam noted for bridges in SPEC-0013.)
- **Place only; do not vote/crystallize.** Voting a marker toward Crystallized
  (changing its state and terrain) is **R-0015**. This requirement leaves every
  marker Floating.
- **Existing plateaus only.** A marker anchors to a plateau that already exists.
- **Non-goals:** voting / crystallization / state transitions (R-0015); wizard
  attribution & signed contribution events (future); free-positioning a marker
  within a plateau (it anchors to the plateau, not an (x,y) inside it); rich
  link/embed previews; editing or deleting markers; IPFS content (Layer 3).

## 5. Open questions

- **Marker glyph + layout:** how to render multiple markers on one plateau
  (a small fan/stack offset from the disc) and how much label text to show
  (title only vs. title + kind). Spec decides; cosmetic, does not affect AC.
- **Kind labels:** the six `ResourceKind` values shown verbatim ("Note",
  "Article", …) vs. friendlier copy. Spec decides.
- **URI validation:** none beyond trim for this POC (any string accepted), or a
  light `http(s)`-prefix check? Leans toward none (a marker may reference a local
  idea, not a URL).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Trail markers are `Resource`s in the existing `resources` CRDT map; author via a pure factory + form (R-0011/R-0013 pattern) | Reuses audited core (`Resource`, `resources`, `vote`); thin additive Rust (constructor + binding + render DTO) |
| 2026-06-02 | New markers start `Floating`, attribution nil | Crystallization is R-0015; signed attribution is a future requirement, consistent with plateaus/bridges |
| 2026-06-02 | Marker anchors to a plateau (not a free (x,y) inside it) this phase | Keeps the model and render simple; intra-plateau positioning is a later enhancement |

## Changelog

- 2026-06-02 created (Draft) — pending SPEC-0014 + architect design review, then acceptance.
- 2026-06-02 SPEC-0014 drafted + architect-reviewed (APPROVE-WITH-NITS, all folded).
  **Status → Accepted.**
