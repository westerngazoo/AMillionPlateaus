# R-0009 — Visitor-authored personas: craft your own lens, not just pick a card

- **Status:** Met
- **Milestone:** POC — Web fog-world (persona extension)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0006 (persona creator), R-0007 (companion embodies the persona)
- **Realized by:** SPEC-0009
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today (R-0006) a visitor picks one of three fixed archetypes — Geometer,
Composer, Polymath. This requirement lets a visitor **author their own persona**:
give it a **name**, choose its **orientation** in the knowledge geometry (which
domain(s) it faces and the direction within them), and carry that authored lens
into the world exactly as a preset archetype — it seeds the local reputation,
lights a starting map, and **embodies the companion** (R-0007).

The authored persona is still a **lens, not a stat sheet** (CLAUDE.md §4). The
visitor chooses only what is legitimately theirs to choose — a name and a starting
**orientation** (a grade-1 direction per domain) — and **never** a reputation
*magnitude*, score, or rank. The seed magnitude stays fixed in code, identical to
the presets; authoring changes only *which way the lens faces*, not how strong it
is. Earned reach still comes only from traversal (R-0005 AC5).

Like every persona artifact, an authored persona and its reputation are a
**per-visitor local lens**: they live in the tab/browser, are **never synced**,
and **never enter the CRDT** (CLAUDE.md §7, R-0006 AC5).

## 2. Rationale

R-0006 proved "who you are changes what you can see," but from a fixed menu. The
deeper thesis — that a persona is *a direction in domain-scoped GA space* — lands
hardest when the visitor sets that direction themselves: authoring a persona that
faces, say, mostly Music with a touch of Mathematics, and watching a *different*
cluster light, makes the geometry tangible in a way three preset cards cannot.
It is also the natural precursor to the eventual wizard identity (Phase 8): the
visitor begins to express *who they are* in the world, minus the cryptography.
Because the pure `seedReputation` mapping (R-0006) already accepts any
`{ name, orient }` shape and the companion's voice resolver already has a graceful
fallback (R-0007), this is a thin, client-only extension of audited code.

## 3. Acceptance criteria

- **AC1 — Author a persona.** Alongside the preset archetypes, the creator offers
  a **"create your own"** path where the visitor sets a **name** and an
  **orientation**: for each available domain, a grade-1 **direction** chosen
  through visitor-friendly controls (the internal `e1/e2/e3` axes presented under
  human labels, not raw blade indices). The controls expose **only direction**,
  never a magnitude/score/rank field.
- **AC2 — Authored personas light the world.** Confirming an authored persona
  seeds the visitor's **local** reputation through the **same pure mapping** the
  presets use, and the world renders with that orientation's reachable set lit and
  the rest fogged. Two **different** authored orientations produce **visibly
  different** lit sets, and an orientation toward a domain lights that domain's
  cluster (domain-scoped, exactly as R-0006 AC2/AC3).
- **AC3 — Authored personas embody the companion.** An authored persona drives the
  always-present companion (R-0007 AC2): its **name** and orientation appear, and
  its **voice** resolves gracefully — either from a visitor-supplied tone or a
  sensible default — with **no crash** when no built-in archetype voice matches.
  Its grounding context (R-0007 AC3) reflects the authored orientation.
- **AC4 — Editable and changeable.** The active persona (preset or authored) is
  shown in the UI; the visitor can **change** to another persona — preset or a new
  authored one — re-seeding the local reputation and re-lighting the world
  **without reloading the page** (consistent with R-0006 AC4). Whether an authored
  persona persists across reloads (e.g. `localStorage`, like the model config) is a
  spec decision, but if persisted it stays **local-only**.
- **AC5 — Local-only, never synced (CLAUDE.md §7, R-0006 AC5).** The authored
  persona, its name, and its reputation are **never** synced and **never** enter
  the CRDT: the `BroadcastChannel` still carries only graph CRDT bytes, the synced
  document's root keys stay exactly `{bridges, plateaus, resources, votes}`, and no
  persona/reputation/voice field is added to the CRDT. Authoring sets an
  **orientation only**, never a magnitude (CLAUDE.md §4).
- **AC6 — Pure, tested, lint-clean.** The authored-orientation → reputation mapping
  is **pure and unit-tested** (host/node, no wasm): a given authored orientation
  deterministically produces a given reputation seed, and an **empty / all-zero**
  authored orientation reaches nothing (the Sybil/fog property is preserved).
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt` stay green; the page loads and authors a persona with
  **no uncaught console errors**.

## 4. Constraints & non-goals

- **Client-only, reuses the audited core.** Authoring is a front-end extension over
  the existing `persona.js` / companion modules and the already-audited
  `mp-graph`/`mp-crdt` via `mp-wasm`. It assembles the same local reputation JSON
  shape (`{ domain_reps: { <uuid>: [8 floats] } }`) the engine already consumes. No
  new graph/GA/CRDT logic in JavaScript, no new math library, and **no change to
  the Rust core** (additive marshalling only if strictly necessary).
- **Orientation, never magnitude.** The authoring UI may not let a visitor set a
  reputation magnitude/score; the fixed `SEED` magnitude is shared with the presets
  (CLAUDE.md §4). Real rank is earned (Phase 8).
- **`mp-crdt` stays reputation-free** (CLAUDE.md §7). Nothing about an authored
  persona may enter the synced document.
- **Non-goals:**
  - *Real identity / persisted profile / signed events.* Phase 8. An authored
    persona is an ephemeral (or at most `localStorage`-local) lens.
  - *Authoring new domains or new plateau clusters.* This phase, an authored
    persona orients within the **existing** seed domains (Mathematics / Music);
    inventing domains or adding plateaus is out of scope (a later content task).
  - *Avatars / 3D / cosmetics.* Phase 6/9.
  - *Multiplayer persona visibility.* Phase 5 (personas are not synced).

## 5. Open questions (to settle in SPEC-0009 / architect review)

- **Authoring controls.** Per-axis sliders/weights for the three GA axes
  (presented under human labels — e.g. "Formal / Physical / Creative") vs.
  pick-domains-with-emphasis. How to label the axes to a visitor without leaking
  internal `e1/e2/e3` semantics.
- **Authored voice.** Whether the companion voice for an authored persona is a
  short visitor-supplied tone string, derived from the dominant axis/domain, or
  just the existing generic fallback.
- **Persistence.** Ephemeral per-session vs. saved to `localStorage` like the
  model config (and, if saved, how it coexists with the preset list).
- **Validation/normalization.** How an all-zero or degenerate authored orientation
  is handled in the UI (it must still be safe — reaching nothing, never crashing).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Let visitors author a persona (name + orientation), reusing the pure `seedReputation` mapping and the companion voice fallback | Makes "a persona is a direction you choose in domain-scoped GA space" tangible; thin client-only extension of audited R-0006/R-0007 code with no CRDT change |
| 2026-05-31 | Authoring chooses orientation only, never a magnitude; `SEED` stays fixed and shared with presets | Rank is earned geometry, not dialed-in numbers (CLAUDE.md §4) |
| 2026-05-31 | Authored personas orient within the existing seed domains only this phase | Lit clusters exist only for Mathematics/Music; inventing domains/plateaus is a separate content task |

## Changelog

- 2026-05-31 created (Draft) — pending SPEC-0009 + architect design review, then acceptance.
- 2026-06-01 SPEC-0009 drafted and architect-reviewed (APPROVE-WITH-NITS; findings folded in). **Status → Accepted**; ready for implementation.
- 2026-06-01 implemented (apps/web) and QA sign-off → **PASS**. **Status → Met.** AC-by-AC verdict:
  - **AC1** — authoring form: name + per-domain enable toggle + three human-labeled axis sliders
    (Formal/Empirical/Creative, no raw `e1/e2/e3`) + optional tone; direction-only (no
    magnitude/score/rank control). Covered by `authored.test.mjs` + browser smoke. ✓
  - **AC2** — authored personas seed via the unchanged `seedReputation`; Math-authored lights
    Arithmetic, Music-authored lights Rhythm (visibly different lit sets). ✓
  - **AC3** — companion shows the authored name; voice resolves from the visitor tone or falls back
    to the generic line with no crash (`companion-voice.test.mjs`). ✓
  - **AC4** — change persona without reload (reuses `choosePersona`); most-recent authored persona
    persisted to `localStorage` (`mp.authoredPersona`) and surfaced as a card, rebuilt through the
    same `authorPersona` path (one seeding path). ✓
  - **AC5** — authored persona/name/reputation are local-only; synced doc root keys stay
    `{bridges, plateaus, resources, votes}` (HUD assertion + `mp-crdt` unchanged); orientation only,
    never magnitude. ✓
  - **AC6** — pure mapping unit-tested + deterministic; empty/all-zero orientation reaches nothing
    and the world stays interactive with no thrown error (empty-orientation guards in `main.js`);
    JS `node --test` 43 pass, `cargo test --workspace` 79 pass, clippy host+`wasm32` `-D warnings`
    clean, `cargo fmt --all --check` clean, no uncaught console errors. ✓
