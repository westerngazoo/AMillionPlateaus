# SPEC-0006 — Persona creator: a client-side starting-orientation lens

- **Status:** Implemented
- **Realizes:** R-0006
- **Author:** Claude
- **Created:** 2026-05-31
- **Depends on:** SPEC-0005
- **Module(s):** `apps/web` only (no Rust change — reuses the SPEC-0005 wasm surface)

## 1. Motivation

R-0006 wants the thesis *reputation is a direction in domain-scoped space* to be
the **first** thing a visitor touches: pick "who you are" and a different starting
map lights. The fog-world POC (R-0005) already renders the graph as geometry,
lifts fog from a local (un-synced) reputation, and converges two tabs over a
`BroadcastChannel`. What's missing is (a) a **second domain cluster** so domain
choice means something, and (b) a **persona creator** — a start overlay whose
archetypes each seed a different local reputation, lighting a different region.

The crucial property that shapes this whole design: the fog engine
(`mp-graph`) decides reachability **geometrically** — a plateau is reachable iff
`max over rep.domain_reps.values() of project(rep_d, position) > 0.15`. It does
**not** filter by `DomainId`. So a persona's "domain" is, in this POC, encoded as
a **grade-1 direction that points at that domain's cluster**; the domain key in
the reputation JSON is Phase-8-shape bookkeeping (and the bucket traversal grows),
but *what actually lights a cluster is the direction*. Therefore the two clusters
**must occupy different GA regions** (R-0006 AC3) for "choosing a domain" to
change the lit set at all. That is exactly what this spec arranges.

This is a **client-only** extension. No new graph/GA/CRDT logic; no math in JS
beyond assembling the existing reputation JSON shape; **no change to the Rust
core** (the SPEC-0005 `seed_plateau(id, name, domain, e1, e2, e3)` already takes a
domain argument, so a second domain needs zero new bindings).

## 2. Design

Layers unchanged (CLAUDE.md §2): `apps/web` → `mp-wasm` → {`mp-graph`,
`mp-crdt`}. Everything new lives in `apps/web`. On-disk layout: `index.html` sits
at `apps/web/`; **all** JS modules (new and existing, including `main.js`) live
under `apps/web/src/`:

```
apps/web/
  index.html              ← + persona-creator overlay markup & styles, + "Change persona" button
  src/
    persona.js            ← NEW. pure: archetype → local reputation JSON (the lens). No wasm.
    persona.test.mjs      ← NEW. node --test for persona.js (AC6, the pure mapping)
    main.js               ← MODIFIED. wire the overlay: choose/change persona re-seeds localRep + re-draws
    project.js            ← unchanged
    render.js             ← unchanged
    traverse.js           ← unchanged (its `accumulate(rep, domain, position, k)` signature is reused as-is)
    sync.js               ← unchanged
```

### 2.1 Two domains, two GA regions (AC3)

**This seed supersedes the SPEC-0005 single-domain seed.** SPEC-0005 seeded one
Mathematics domain with Arithmetic/Algebra/Geometry/Calculus/**Topology** at
different coordinates. This spec **replaces** those coordinates, **drops
Topology**, and **adds a Music cluster** — the names Algebra/Geometry/Calculus are
reused with the new positions in the table below (this is an intentional revision
of the demo seed, not a regression). Replace the single-domain seed in `main.js`
with **two clusters** under two `DomainId`s, separated on near-orthogonal grade-1
axes so each persona lights one and leaves the other fogged:

- **Mathematics** (`MATH_DOMAIN = 11111111-…-111111111111`) lives on the **e1**
  axis (e3 ≈ 0).
- **Music** (`MUSIC_DOMAIN = 22222222-…-222222222222`) lives on the **e3** axis
  (e1 ≈ 0).

e2 is kept small everywhere (a shared "depth" jitter for visual spread; it never
crosses the threshold for the seed magnitudes used, so it does not discriminate).

| Plateau | Domain | e1 | e2 | e3 |
|---|---|---|---|---|
| Arithmetic | Math | 1.00 | 0.05 | 0.05 |
| Algebra | Math | 0.80 | 0.20 | 0.10 |
| Geometry | Math | 0.70 | 0.10 | 0.35 |
| Calculus | Math | 0.60 | 0.30 | 0.30 |
| Rhythm | Music | 0.05 | 0.05 | 1.00 |
| Melody | Music | 0.10 | 0.20 | 0.80 |
| Harmony | Music | 0.35 | 0.10 | 0.70 |
| Counterpoint | Music | 0.30 | 0.30 | 0.60 |

Bridges (decorative — reachability is positional, **not** adjacency-based, so
bridges only draw labelled lines): intra-math (Arithmetic–Algebra "variables",
Algebra–Geometry "coordinates", Algebra–Calculus "rates of change",
Geometry–Calculus "limits"), intra-music (Rhythm–Melody "pitch", Melody–Harmony
"chords", Harmony–Counterpoint "voice-leading", Rhythm–Counterpoint "meter"), and
one **cross-domain** bridge Geometry–Harmony "ratio" (hints the domains connect;
purely visual). All seeded with fixed ids via `seed_plateau`/`seed_bridge` so two
tabs converge to one shared map (the SPEC-0005 non-doubling property).

**Impl requirement:** every seed plateau and bridge must carry a **deterministic,
caller-supplied id** (as `main.js` already does for the SPEC-0005 seed, e.g.
`…-0000000000a1`). This is load-bearing — two tabs seed independently, and with
random ids the seed would *double* on merge. Spell out the full fixed id set in
`main.js`.

Isometric projection (`project.js`, unchanged) sends Math to the upper-right
(high e1) and Music to the lower-left (high e3), so the two regions are also
**visually** separated, not only geometrically.

### 2.2 The persona mapping (`persona.js`, pure — AC1, AC2, AC6)

An **archetype** is a pure *orientation*: a name, a one-line blurb, and a list of
**per-domain grade-1 directions**. It is **not** a score. Every active direction
gets the **same fixed seed magnitude** `SEED = 0.16`; archetypes differ only in
*which domains/directions* they orient toward — never in magnitude. (Earned reach
comes from traversal, R-0005 AC5, never from the persona — CLAUDE.md §4.)

Reputation is stored as **one grade-1 vector per oriented domain**, because the
engine **maxes** the projection across `domain_reps` (it does not sum across
domains). This is what makes domain choice scoped: a persona with reputation only
in Music can never light Math, and vice-versa.

```js
// persona.js — pure. Archetype → local reputation JSON. No GA/graph/CRDT logic;
// just assembles the { domain_reps: { <uuid>: [8 floats] } } shape mp-wasm decodes.
// This is the visitor's LENS and is NEVER synced (R-0006 AC5).

export const MATH_DOMAIN  = "11111111-1111-1111-1111-111111111111";
export const MUSIC_DOMAIN = "22222222-2222-2222-2222-222222222222";

// grade-1 blade indices in [1, e1, e2, e12, e3, e13, e23, e123]
const E1 = 1, E2 = 2, E3 = 4;
// Fixed orientation nudge, identical for every archetype. 0.16 is chosen against
// mp-graph's 0.15 REACHABILITY_THRESHOLD: it clears the threshold on an on-axis
// entry plateau (proj 0.160 > 0.15) but not its neighbours, leaving room to
// traverse. Lowering SEED below ~0.15, or a plateau's on-axis coord below ~0.94,
// darkens the entry. (Comment this tie-in in the code.)
const SEED = 0.16;

// Each archetype orients toward one or more domains by a grade-1 direction.
// AC1: name + domain(s) + one-line description. Grade-1 only — a bivector flavor
// would not affect the grade-1 fog query, so we omit it this phase (OQ "grade
// signature"). Direction components are weights; a single-axis dir is its own unit.
export const ARCHETYPES = [
  { id: "geometer", name: "The Geometer", domainLabel: "Mathematics",
    blurb: "Wakes facing Mathematics — arithmetic in reach, all else in fog.",
    orient: [{ domain: MATH_DOMAIN, dir: { e1: 1, e2: 0, e3: 0 } }] },
  { id: "composer", name: "The Composer", domainLabel: "Music",
    blurb: "Wakes facing Music — rhythm in reach, all else in fog.",
    orient: [{ domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } }] },
  { id: "polymath", name: "The Polymath", domainLabel: "Mathematics × Music",
    blurb: "A foothold in each domain — arithmetic and rhythm lit, the depths fogged.",
    orient: [{ domain: MATH_DOMAIN,  dir: { e1: 1, e2: 0, e3: 0 } },
             { domain: MUSIC_DOMAIN, dir: { e1: 0, e2: 0, e3: 1 } }] },
];

// Pure: archetype → reputation JSON. Each oriented domain gets SEED · unit(dir)
// in its grade-1 components. Deterministic (AC6).
export function seedReputation(archetype) {
  const domain_reps = {};
  for (const { domain, dir } of archetype.orient) {
    const mag = Math.hypot(dir.e1, dir.e2, dir.e3) || 1;
    const v = [0, 0, 0, 0, 0, 0, 0, 0];
    v[E1] = (SEED * dir.e1) / mag;
    v[E2] = (SEED * dir.e2) / mag;
    v[E3] = (SEED * dir.e3) / mag;
    domain_reps[domain] = v;
  }
  return { domain_reps };
}
```

A **scalar-only / empty** archetype (`orient: []`, or a `dir` of all zeros) maps
to an empty / grade-1-zero reputation, which the engine sends to fog — the
Sybil/fog property (AC6). The engine side is already proved in
`mp-wasm/src/convert.rs::scalar_only_reputation_reaches_nothing`; the JS test
proves the mapping side (below).

**Resulting lit sets** (projection = dot product incl. e2; threshold 0.15; max
across domains). This table is the AC2/AC3 verification target:

| Plateau | Geometer (e1) | Composer (e3) | Polymath (e1 ⊕ e3, maxed) |
|---|---|---|---|
| Arithmetic (1.00,.05,.05) | **0.160 ✓** | 0.008 | **0.160 ✓** |
| Algebra (.80,.20,.10) | 0.128 | 0.016 | 0.128 |
| Geometry (.70,.10,.35) | 0.112 | 0.056 | 0.112 |
| Calculus (.60,.30,.30) | 0.096 | 0.048 | 0.096 |
| Rhythm (.05,.05,1.00) | 0.008 | **0.160 ✓** | **0.160 ✓** |
| Melody (.10,.20,.80) | 0.016 | 0.128 | 0.128 |
| Harmony (.35,.10,.70) | 0.056 | 0.112 | 0.112 |
| Counterpoint (.30,.30,.60) | 0.048 | 0.096 | 0.096 |
| **Lit set** | **{Arithmetic}** | **{Rhythm}** | **{Arithmetic, Rhythm}** |

Three **visibly different** initial lit sets (AC2): the Geometer lights the Math
entry only, the Composer the Music entry only (a *different region*, AC3), and the
Polymath one foothold in **each** domain — the max-over-domains semantics in
action. From each, traversal (R-0005 AC5) deepens reachability *within the
oriented domain(s)*; a pure Geometer never lights Music (zero e3 rep, and Math
plateaus carry near-zero e3 to add) — domain-scoping made tangible.

### 2.3 The creator overlay & wiring (`index.html` + `main.js` — AC1, AC4, AC5)

`index.html` gains a **persona-creator overlay**: a full-canvas `<div id="creator">`
(shown on load, high z-index, `pointer-events` capturing) holding one card per
`ARCHETYPES` entry — name, `domainLabel`, blurb, and a "Choose" affordance. A
`<button id="change-persona">` is added to the existing button bar; the HUD line
gains the active persona name.

`main.js` changes (all additive; the seed/sync/render/traverse plumbing is
otherwise SPEC-0005):

- Build `DOMAIN_OF: Map<plateauId, domain>` from the seed so traverse grows the
  **plateau's own** domain bucket (`accumulate(localRep, DOMAIN_OF.get(id) ?? active.orient[0].domain, position)`); unchanged `traverse.js`. Foreign synced
  plateaus fall back to the active persona's first domain. This fallback is a
  **best-effort heuristic, not domain-correct** attribution: a user-added/synced
  plateau sitting geometrically in Music space might grow a Math bucket. That is
  harmless to the fog math (reachability is positional, not bucket-gated) and
  traversal-growth is itself a Phase-8 demo stand-in — so the imprecision is
  acceptable and must not be mistaken for real domain attribution.
- `let activePersona = null; let localRep = { domain_reps: {} };` — the world is
  **not interactive** until chosen: the canvas click handler early-returns while
  `activePersona === null`, *and* the overlay sits on top capturing input (AC1).
- `function choosePersona(a) { activePersona = a; localRep = seedReputation(a);
  hide(creator); hud persona = a.name; draw(); }` — re-seeds and re-lights with
  **no reload** (AC4). Wired to each card and to render the overlay.
- `change-persona` button → show the overlay again; picking another archetype
  re-runs `choosePersona` (re-seed + re-light, AC4).
- `reset-fog` now resets to the **active persona's** starting orientation
  (`localRep = seedReputation(activePersona)`), not a hard-coded vector.
- The "Add a plateau" button seeds under the active persona's first domain.

The persona and its reputation live **only** in JS (`activePersona`, `localRep`).
Nothing about a persona is written to the `WasmCrdtDoc` or posted to the
`BroadcastChannel`; the existing `doc.root_keys()` assertion still holds
(`{bridges, plateaus, resources, votes}`) and is logged once (AC5). Adding the
Music plateaus enlarges the synced `plateaus` map — those are **graph state**
(legitimately synced), not reputation; root keys are unchanged.

### 2.4 Data flow (unchanged transport; persona is local only)

```
load ─▶ overlay (no interaction) ─▶ choosePersona(a) ─▶ localRep = seedReputation(a) ─▶ draw   [LOCAL only]
click lit plateau ─▶ traverse.js (grow localRep in plateau's domain) ─▶ draw                   [LOCAL only, never synced]
add/vote ─▶ WasmCrdtDoc edit ─▶ pump() ─▶ BroadcastChannel ─▶ other tab ─▶ render              [CRDT bytes only]
```

## 3. Code outline

```js
// apps/web/src/persona.test.mjs — node --test, no wasm (AC6: pure mapping)
import test from "node:test";
import assert from "node:assert/strict";
import { ARCHETYPES, seedReputation, MATH_DOMAIN, MUSIC_DOMAIN } from "./persona.js";

test("geometer seeds e1 in the Mathematics domain only", () => {
  const r = seedReputation(ARCHETYPES.find(a => a.id === "geometer"));
  assert.deepEqual(Object.keys(r.domain_reps), [MATH_DOMAIN]);
  assert.deepEqual(r.domain_reps[MATH_DOMAIN], [0, 0.16, 0, 0, 0, 0, 0, 0]);
});

test("composer seeds e3 in the Music domain only", () => {
  const r = seedReputation(ARCHETYPES.find(a => a.id === "composer"));
  assert.deepEqual(Object.keys(r.domain_reps), [MUSIC_DOMAIN]);
  assert.deepEqual(r.domain_reps[MUSIC_DOMAIN], [0, 0, 0, 0, 0.16, 0, 0, 0]);
});

test("polymath seeds one grade-1 vector per domain", () => {
  const r = seedReputation(ARCHETYPES.find(a => a.id === "polymath"));
  assert.deepEqual(r.domain_reps[MATH_DOMAIN],  [0, 0.16, 0, 0, 0,    0, 0, 0]);
  assert.deepEqual(r.domain_reps[MUSIC_DOMAIN], [0, 0,    0, 0, 0.16, 0, 0, 0]);
});

test("mapping is deterministic", () => {
  const a = ARCHETYPES.find(x => x.id === "geometer");
  assert.deepEqual(seedReputation(a), seedReputation(a));
});

test("an empty / scalar-only archetype reaches nothing (Sybil/fog)", () => {
  // No grade-1 orientation → empty reputation → engine sends it to fog
  // (engine side proved in convert.rs::scalar_only_reputation_reaches_nothing).
  const r = seedReputation({ orient: [] });
  assert.deepEqual(r.domain_reps, {});
});
```

(Verified at impl by running `node --test apps/web/src/*.test.mjs` — joins the
existing `project.test.mjs`.)

The `deepEqual` assertions are exact because every archetype direction is
**single-axis** (`Math.hypot` of a unit axis is exactly 1, so `0.16 * 1 / 1`
is float-exact). If a future archetype uses a **diagonal** direction (e.g.
`{e1:1, e3:1}`), `SEED * x / Math.hypot(...)` introduces float noise — such a test
must then assert with a tolerance, not `deepStrictEqual`. Archetypes stay
single-axis this phase, so exact assertions are correct here.

## 4. Non-goals

- **No Rust change.** No new `mp-wasm` bindings, no `mp-graph`/`mp-reputation`/
  `mp-crdt` edits. The second domain rides the existing
  `seed_plateau(id, name, domain, …)` signature.
- **No real identity / persistence** (Phase 8): no Nostr key, no signed events, no
  saved profile; a reload resets the persona.
- **No earned rank / magnitude dialing**: the creator picks orientation only; the
  seed magnitude is fixed in code, not exposed.
- **No multiplayer persona visibility** (Phase 5): a persona is never synced; other
  tabs do not see it.
- **No avatars / 3D / cosmetics** (Phase 6/9). 2D lens only. Per-domain lit
  **color-coding** of plateaus is optional presentation polish, not required by any
  AC; spatial separation already distinguishes the regions.
- **No bivector/synthesis flavor** this phase (see OQ resolution): it would not
  affect the grade-1 fog query.

## 5. Open questions

All three R-0006 open questions are settled here:

- **Archetype set & second domain — RESOLVED.** Mathematics (e1 axis) + Music
  (e3 axis); three archetypes: Geometer (Math), Composer (Music), Polymath (both).
  Chosen so the lit sets are provably distinct (§2.2 table) and the clusters sit
  in near-orthogonal GA regions (AC3).
- **Grade signature — RESOLVED: grade-1 only.** The fog query is a grade-1
  projection; a bivector flavor is inert to it, so we omit it (keeps the mapping
  legible and unit-testable). Revisit when Phase-8 synthesis lands.
- **Default / skip — RESOLVED: selection is mandatory.** No auto-default and no
  "just explore" skip — the overlay gates interactivity until an archetype is
  picked (choosing a lens *is* the first interaction). The empty/scalar archetype
  exists only as a unit-test fixture (proving the Sybil/fog property), not a card,
  to avoid a dead-end empty map.

## 6. Acceptance criteria

- [ ] **AC1 (R-0006 AC1)** → page loads showing a persona creator with ≥3
  archetype cards, each with name + domain label + one-line blurb; the world is
  not interactive until one is chosen (overlay captures input + click handler
  early-returns).
- [ ] **AC2 (R-0006 AC2)** → choosing an archetype seeds `localRep` via
  `seedReputation` and re-renders; Geometer, Composer, Polymath light
  `{Arithmetic}`, `{Rhythm}`, `{Arithmetic, Rhythm}` respectively — visibly
  different sets (§2.2 table; browser-verified).
- [ ] **AC3 (R-0006 AC3)** → the seed spans two domains (Math on e1, Music on e3)
  in different GA regions; a persona oriented to one lights that cluster and leaves
  the other fogged (table rows for the off-domain plateaus all < 0.15).
- [ ] **AC4 (R-0006 AC4)** → active persona shown in the HUD; "Change persona"
  re-opens the overlay and picking another archetype re-seeds + re-lights with no
  page reload.
- [ ] **AC5 (R-0006 AC5)** → no persona/reputation field is added to the CRDT; the
  `BroadcastChannel` carries only `doc` bytes; `doc.root_keys()` stays
  `{bridges, plateaus, resources, votes}` (logged assertion). Traverse still grows
  the local reputation (R-0005 AC5) — in the plateau's domain bucket.
- [ ] **AC6 (R-0006 AC6)** → `persona.js` mapping is pure & unit-tested
  (`persona.test.mjs`, node, no wasm): each archetype deterministically yields its
  reputation seed, and an empty/scalar archetype yields nothing (Sybil/fog).
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt` stay green (unaffected — no Rust change); the page
  loads with no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Client-only; reuse the SPEC-0005 wasm surface; **no Rust change** | `seed_plateau(id, name, domain, …)` already takes a domain, so a second domain and a new local-reputation lens need only JS. Honors R-0006's "ideally no change to the Rust core" |
| 2026-05-31 | Encode a persona's "domain" as a **grade-1 direction at that domain's cluster**, with clusters on near-orthogonal axes (Math=e1, Music=e3) | The engine reaches geometrically (`max over domain_reps of project`), never by `DomainId`; only different GA regions make domain choice change the lit set (R-0006 AC3) |
| 2026-05-31 | **One grade-1 vector per oriented domain** (not one summed vector) | The engine **maxes** across `domain_reps`; per-domain vectors make scoping real — a Polymath lights each domain's entry, a single-domain persona is locked to its region |
| 2026-05-31 | **Fixed** seed magnitude `SEED=0.16`, identical for all archetypes; archetypes differ only in direction/which domains | A persona chooses orientation, never a score/magnitude (CLAUDE.md §4); 0.16 lights just the on-axis **entry** plateau (proj 0.160 > 0.15), leaving room for traversal |
| 2026-05-31 | Grade-1 only — no bivector/synthesis flavor (OQ "grade signature") | The fog query is a grade-1 projection; a bivector would be inert to it. Keeps the mapping legible & unit-testable; revisit in Phase 8 |
| 2026-05-31 | Selection mandatory; empty/scalar archetype is a **test fixture**, not a card (OQ "default/skip") | Choosing a lens is the first interaction (the whole point); an empty persona would render a dead-end fogged map. The fixture still proves the Sybil/fog property (AC6) |
| 2026-05-31 | Bridges (incl. one cross-domain Geometry–Harmony "ratio") are decorative | Reachability is positional, not adjacency-based; bridges only draw labelled lines, so a cross-domain bridge hints connection without affecting fog |
| 2026-05-31 | Traverse grows the **plateau's** domain bucket (via a page-built `id→domain` map), fallback to the active persona's domain | Keeps "reputation scoped by domain" honest as you explore; needs no `mp-wasm` change (the page knows its own seed's domains) |

## Changelog

- 2026-05-31 created (Draft) — pending architect design review, then status → Accepted
- 2026-05-31 architect design review → APPROVE WITH CHANGES. Engine facts
  independently verified against source: reachability is `max over domain_reps of
  project(rep, position) > 0.15`, **not** DomainId-gated (`graph.rs`); threshold
  0.15 (`types.rs`); projection is the grade-1 dot incl. e2 (`ga.rs`);
  `seed_plateau`/`seed_bridge` take domain/id args (`lib.rs`); the Sybil/scalar
  fixture is backed by `convert.rs::scalar_only_reputation_reaches_nothing`. The
  §2.2 lit-set table recomputes correctly (Geometer {Arithmetic}, Composer
  {Rhythm}, Polymath {Arithmetic, Rhythm}) with safe f32 margins; §7/AC5, §4
  (orientation-only), and the "no Rust change" claim all hold. Folded in: (1) made
  the §2 file tree unambiguous that all JS incl. `main.js` lives under
  `apps/web/src/`; (2) stated the seed **supersedes** the SPEC-0005 coordinates and
  drops Topology, and called out deterministic seed ids as a load-bearing impl
  requirement; (3) flagged the `DOMAIN_OF` fallback as a best-effort heuristic, not
  domain-correct attribution; (4) noted single-axis directions make the `deepEqual`
  tests float-exact (diagonal dirs would need tolerance); (5) tied the `SEED=0.16`
  constant to the 0.15 threshold in a code comment. Status Draft → Accepted
- 2026-05-31 implemented — `apps/web` only, **no Rust change**: new pure
  `persona.js` (3 archetypes over a Math-e1 + Music-e3 two-domain seed) + node test
  `persona.test.mjs`; `main.js` rebuilt with the two-cluster seed (4+4 plateaus, 9
  bridges incl. one cross-domain), a persona-creator overlay, `DOMAIN_OF` traverse
  routing, and change/reset wiring; `index.html` overlay markup/styles +
  "Change persona" button + persona in the HUD. Gates green: `node --test` (10,
  incl. 6 persona), `cargo test --workspace`, `wasm-pack test --node` (4), clippy
  `-D warnings` host **and** `wasm32` (mp-wasm + mp-crdt `--no-default-features`),
  fmt. Browser-verified against the real wasm engine: lit sets Geometer
  {Arithmetic} / Composer {Rhythm} / Polymath {Arithmetic, Rhythm} (AC2/AC3),
  change-persona re-lights with no reload (AC4), traverse lifts fog locally
  (1→6→7) without syncing, `root_keys` stays {bridges, plateaus, resources, votes}
  (AC5), no console errors. Architect APPROVE-WITH-CHANGES (folded) + qa PASS on
  AC1–AC6. Status Accepted → Implemented
