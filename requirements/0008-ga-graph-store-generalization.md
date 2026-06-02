# R-0008 — Generalize `mp-graph` into a domain-agnostic geometric graph store (RFC-0001 Scope A)

- **Status:** Met
- **Milestone:** Infrastructure — GA graph store extraction (RFC-0001 Scope A, in-tree)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0001 (must preserve), R-0002, R-0003, R-0004, R-0005, R-0006, R-0007 (all must stay Met)
- **Realized by:** SPEC-0008
- **QA:** `qa` agent run scoped to this requirement
- **Source:** `docs/rfcs/0001-ga-graph-store-extraction.md` §6, §7, §11 (Scope A)

## 1. Statement

`mp-graph` today is, almost by accident, a reusable kernel: a graph store whose
node positions are Grade-1 multivectors, whose edges are even-grade rotors, and
whose primary query is a geometric-algebra projection. But that kernel is
entangled with A Million Plateaus' **domain vocabulary** — `PlateauNode`,
`Bridge`, `WizardProfile`, `WizardReputation`, `AlebrijeState`, `Resource`, the
`e1=Formal / e2=Physical / e3=Creative` axis semantics, and AMP-specific
thresholds — all declared inside the store's own modules.

This requirement is the **in-tree generalization** (RFC-0001 Scope A): refactor
`mp-graph` into a **domain-agnostic** geometric graph store — generic `Node<M>` /
`Edge<M>` carrying a caller-defined metadata payload, with a small **typed
geometric query surface** — and **move AMP's domain types out** of the store core
into an AMP-side module. AMP then consumes the generic store, mapping its
plateaus/wizards/reputation onto it.

This is a **refactor, not a feature**: it adds no user-visible behaviour. Its
whole value is structural — proving the abstraction against a real consumer (AMP)
while keeping every existing requirement (R-0001…R-0007) green and every
geometric result **bit-for-bit identical**. No new repository, no crates.io
publish, and **no change to garust**. The geometric index (RFC-0001 §6.4(3)) and
the CRDT-schema generalization (§6.5) are explicitly **deferred to Scope B**; the
linear-scan query ships as-is, documented honestly.

## 2. Rationale

The GA-projection query primitive — `⟨direction · position⟩₀ > threshold`, with
rotor-carrying edges — is a genuinely unusual store primitive (neither adjacency
traversal nor cosine/L2 k-NN). It is the project's defensible differentiator. But
it can only become reusable if the store core stops naming AMP's domain. Scope A
is the lowest-risk, reversible first step: it lives in-tree, has clear acceptance
criteria, and forces the generic API to survive contact with a working consumer
before any repo split (Scope B) or publish (Scope C) is contemplated.

Doing it now also pays off immediately for AMP's own clarity: the fog query and
the companion-grounding query (R-0007) are the *same* geometric projection, and
expressing both through one small typed query API removes the last hardcoded,
wizard-specific framing from the store.

## 3. Acceptance criteria

- **AC1 — Domain-agnostic store core.** The store core exposes generic node/edge
  types parameterized by a caller payload (e.g. `Node<M>` / `Edge<M>`, or an
  equivalent `GeoGraph<N, E>`). The core's type and query modules contain **no AMP
  domain vocabulary** — no `Plateau`, `Wizard`, `Alebrije`, `Resource`, `Bridge`
  concept naming, no `e1=Formal/e2=Physical/e3=Creative` axis semantics, and no
  AMP thresholds. The position stays a private, invariant-checked multivector;
  caller data lives in the payload.
- **AC2 — Domain types moved out.** `WizardProfile`, `WizardReputation`,
  `Traversal`, `AlebrijeState` and creature types, `Resource`/`ResourceKind`/
  `ResourceState`, the axis semantics, and the AMP thresholds
  (`REACHABILITY_THRESHOLD`, `CRYSTALLIZE_THRESHOLD`, `DECAY_THRESHOLD`) live in an
  **AMP-side module** (a new `mp-domain` crate or equivalent), **not** in the store
  core. The store core compiles and tests **without** any of them present.
  `PlateauNode`/`Bridge` become AMP types defined as the generic core specialized
  with AMP payloads (alias or thin wrapper).
- **AC3 — Generalized typed query surface.** The single hardcoded reachability
  query is replaced by a small, typed query API on the generic graph, at minimum:
  `project_above(direction, threshold)` (today's reachability, framing removed),
  `nearest(direction, k)` (today's `nearest_plateaus`), `by_grade(grade)`, and
  `transport(edge, v)` (apply an edge rotor). AMP's fog reachability and the
  R-0007 companion retrieval are **re-expressed in terms of this API** (e.g. the
  fog query becomes `graph.project_above(&rep, REACHABILITY_THRESHOLD)`), sharing
  one projection scorer.
- **AC4 — Behaviour preserved (the regression bar).** No user-visible or numeric
  behaviour changes. Fog reachability, `nearest_plateaus`, CRDT sync, the
  `mp-wasm` bindings, and the web POC all produce **identical** results to before
  the refactor; the projection metric is unchanged to the bit. Every existing gate
  stays green: `cargo test --workspace`, `wasm-pack test --node`, the
  `apps/web/src/*.test.mjs` node suite, and a browser smoke of the fog-world POC
  (persona creator, fog lighting, two-tab sync, companion) with no console errors.
- **AC5 — Invariants survive the move.** The store core still enforces the Grade-1
  position invariant and the even-grade rotor invariant **at construction**, and
  still **re-validates on load/deserialize**. No `unwrap()` without a `// SAFETY:`
  note, and no panic crosses the WASM FFI (CLAUDE.md §5).
- **AC6 — In-tree only, honest scope, rules intact.** No new repository, no
  crates.io publish, and **no modification to garust**. The projection query
  remains an O(n) linear scan, **documented as such**, with the geometric index
  (RFC-0001 §6.4(3)) and CRDT-schema generalization (§6.5) explicitly deferred to a
  future scope. CLAUDE.md non-negotiables hold: garust-only math (§1), dependencies
  point inward (§2), reputation never a scalar (§4), reputation/config/chat never
  in the CRDT (§7) — the CRDT root keys remain `{plateaus, bridges, resources,
  votes}` unless a future scope changes them.
- **AC7 — Pure, tested, lint-clean.** The store core's generic types and query API
  carry their own unit tests (independent of AMP domain types). Clippy is clean on
  host and `wasm32-unknown-unknown` under `-D warnings`, and `cargo fmt --check`
  passes.

## 4. Out of scope (deferred)

- The geometric index (grade buckets / spatial index over the grade-1 subspace) —
  RFC-0001 §6.4(2)(3). Scope A ships the linear scan.
- Splitting the store into a sibling/public repo, or publishing garust — RFC-0001
  Scope B / C.
- Generalizing the CRDT schema from fixed `{plateaus, bridges, resources, votes}`
  keys to "nodes + edges + caller maps" — RFC-0001 §6.5 (Scope B).
- Incremental persistence (`put_node`/`put_edge`/`delete` as individual txns),
  parametrizing the algebra beyond G(3,0,0), and exposing storage transactions —
  RFC-0001 §6.3, §9, §10.
- Any rename of the crate / product (`rotor-store` et al.) — RFC-0001 §5.

## 5. Open questions (to settle in SPEC-0008 / architect review)

- **Destination of the domain types** — a new `mp-domain` crate vs. folding them
  into `mp-reputation` / an AMP-side module. (`mp-reputation` already depends on
  `WizardReputation`; the destination must keep dependencies pointing inward.)
- **Alias vs. wrapper** for `PlateauNode = Node<PlateauMeta>` — a type alias is
  lightest but exposes the generic surface; a thin newtype preserves AMP's
  construction ergonomics. Confirm the chosen form migrates without churn.
- **One crate with modules vs. an internal core/domain split** for the in-tree
  step (RFC-0001 §6 shows the eventual multi-crate shape; Scope A may stay simpler).
- **Whether `mp-wasm` re-exports change shape** at all, given AC4 forbids any
  behaviour change to the browser-facing API.

## 6. Changelog

- 2026-05-31 created (Draft) — scopes RFC-0001 Scope A as a tracked requirement.
  Awaiting SPEC-0008 + architect design review before implementation.
- 2026-05-31 SPEC-0008 drafted and architect-reviewed (APPROVE WITH CHANGES, all folded
  in: `pub score` resolves the cross-crate scorer, `transport` gets a garust-built
  reverse+sandwich `ga` helper, `resources` stays `pub`, construction stays a
  `debug_assert`, AC3 retrieval path traced through `mp-wasm`). The design preserves the
  serde wire/disk shape (verified against `types.rs`/`db.rs`/`doc.rs`), satisfying AC4.
  Acceptance criteria unambiguous. Status Draft → Accepted.
- 2026-06-01 SPEC-0008 implemented and **QA signed off** → Status Accepted → **Met**.
  AC-by-AC: **AC1** generic `GeoGraph<N: Positioned, E: Rotored>` core with zero AMP
  vocabulary in its type/query modules (the lone carryovers are the documented redb
  table string `"plateaus"`/`"bridges"` for on-disk back-compat — const named `NODES`/
  `EDGES` — and test-fixture variable names, neither domain vocabulary in the API);
  **AC2** all domain types (`PlateauNode`/`Bridge`/`Resource*`/`Wizard*`/`Traversal`/
  `AlebrijeState`+creatures/axis docs/thresholds) moved to the new `mp-domain` crate, and
  `mp-graph` compiles+tests with only `TestNode`/`TestEdge`; **AC3** typed query surface
  `project_above`/`nearest`/`by_grade`/`transport`(+`pub score`) on `GeoGraph`, with fog
  reachability and the R-0007 companion retrieval re-expressed through the one shared
  scorer; **AC4** behaviour bit-preserved — `mp-domain/tests/persistence.rs` adds a literal
  **bincode golden** (deterministic id/created_at fixture) + full blade-layout pin
  `[1,e1,e2,e12,e3,e13,e23,e123]` + flat-JSON key guards + generic-`GraphDb` round-trip, and
  CRDT `root_keys()` stays `{bridges, plateaus, resources, votes}`; **AC5** Grade-1/even-rotor
  invariants enforced at construction (`debug_assert`) and re-validated on `load`, no bare
  `unwrap`, no panic across FFI; **AC6** in-tree only, garust untouched, O(n) scan documented,
  index + CRDT-schema generalization deferred to Scope B; **AC7** core unit-tested without AMP
  types, clippy clean host + `wasm32 -D warnings`, `cargo fmt --check` clean. Gates: workspace
  tests (mp-crdt 12+6, mp-domain 16+4, mp-graph 16, mp-reputation 11+1, mp-wasm 13),
  `wasm-pack test --node` 5, `node --test apps/web/src/*.test.mjs` 26, fog-world browser smoke
  (Geometer lights 1/8 plateaus, companion active, zero console errors). QA caught and fixed a
  bug in the golden test's hand-computed bytes (a `Uuid` serializes under bincode as a u64
  length-prefix + 16 bytes, not 16 raw bytes); the corrected golden now passes.
