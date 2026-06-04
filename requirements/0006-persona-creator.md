# R-0006 — Persona creator: choose a starting orientation in the knowledge geometry

- **Status:** Met
- **Milestone:** POC — Web fog-world (persona extension)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-05-31
- **Depends on:** R-0005
- **Realized by:** SPEC-0006
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Before entering the fog-world, a visitor must be able to **choose a persona** —
a named archetype that places them somewhere in the knowledge geometry and
orients them toward a domain of study. The persona is the visitor's *lens*: it
seeds their (local, demo) reputation so that, on entry, a **different starting
map is lit** for different personas. A "Geometer" wakes up with the geometry
plateaus reachable and the rest in fog; a persona oriented toward a different
domain wakes up facing that domain's cluster instead.

A persona is **not** a stat sheet. In this world rank is earned geometry, not
dialed-in numbers (CLAUDE.md §4), so the creator lets the visitor pick only what
is legitimately theirs to choose: a **name**, an **archetype** (a direction in
GA space), and the **domain** they begin oriented toward. The chosen persona is
shown in the UI and can be changed, re-lighting the world from the new
orientation. It is a per-visitor lens and is **never synced** between tabs.

## 2. Rationale

The fog-world POC (R-0005) proves the map is the geometry and that two tabs
converge — but every visitor currently starts from the *same* hard-coded
orientation, so the central thesis that **reputation is a direction in
domain-scoped space** stays implicit. A persona creator makes that thesis the
first thing a visitor touches: choosing "who you are" visibly changes "what you
can see," which is the entire fog mechanic in one interaction. It also turns an
abstract demo into something a person *role-plays*, which is how the eventual
world will be entered (a precursor to the Phase-8 wizard identity, minus the
cryptography). Adding a second domain to the seed — required for domain choice to
mean anything — is the first time the POC shows reputation as **scoped by
domain**, a core claim that a single-domain map cannot demonstrate.

## 3. Acceptance criteria

- **AC1.** On load the page presents a **persona creator** (an overlay/screen)
  offering at least three distinct archetypes, each with a name, the domain it is
  oriented toward, and a one-line description. The world is not interactive until
  a persona is chosen (or a default is explicitly entered).
- **AC2.** Choosing a persona seeds the visitor's **local** reputation with that
  archetype's domain + GA direction, and the world renders with that persona's
  reachable set lit and the remainder fogged. Two different archetypes produce
  **visibly different** initial lit sets.
- **AC3.** The seed graph spans **at least two domains** whose plateau clusters
  occupy different regions of GA space, so that a persona oriented toward one
  domain lights that cluster while the other domain's cluster begins fogged.
- **AC4.** The active persona is shown in the UI, and the visitor can **change
  persona**; doing so re-seeds the local reputation and re-lights the world from
  the new orientation without reloading the page.
- **AC5.** The persona and its reputation remain **local to the tab and are never
  synced** (CLAUDE.md §7, R-0005 AC7): the `BroadcastChannel` still carries only
  graph CRDT bytes, the synced document's root keys stay exactly
  `{bridges, plateaus, resources, votes}`, and no persona/reputation field is
  added to the CRDT. Traversal (clicking lit plateaus) continues to grow the
  chosen persona's local reputation as in R-0005 AC5.
- **AC6.** The persona→reputation mapping is **pure and unit-tested** (host/node,
  no wasm): a given archetype deterministically produces a given reputation seed,
  and a scalar-only / empty archetype reaches nothing (the Sybil/fog property is
  preserved). `cargo test --workspace`, `wasm-pack test --node`, clippy
  `-D warnings` (host + `wasm32`), and `cargo fmt` stay green; the page loads with
  no uncaught console errors.

## 4. Constraints & non-goals

- **Client-only, reuses the existing core.** The persona is a front-end lens over
  the already-audited `mp-graph`/`mp-crdt` logic via `mp-wasm`. Persona selection
  seeds the same local reputation JSON shape R-0005 already feeds to
  `reachable_plateaus`. No new graph/GA/CRDT logic in JavaScript; no new math
  library; ideally **no change to the Rust core** (additive marshalling only if
  strictly needed).
- **`mp-crdt` stays reputation-free** (CLAUDE.md §7). Nothing about a persona may
  enter the synced document.
- **Non-goals:**
  - *Real identity.* No Nostr keypair, no signed events, no persisted profile —
    that is Phase 8. The persona is an ephemeral local lens; a reload may reset it.
  - *Earned rank / stat allocation.* The creator never lets a visitor set a
    reputation *magnitude* as a score; it only chooses a starting **orientation**.
    Real rank is computed from signed events (Phase 8).
  - *Avatars / 3D / cosmetics.* Visual character models are Phase 6/9. This is the
    2D fog-world lens only.
  - *Multiplayer persona visibility.* Other tabs do not see your persona (it is
    not synced); shared presence is Phase 5.

## 5. Open questions

- **Archetype set & second domain theme.** Which archetypes, and what is the
  second domain (e.g., Mathematics + a humanities domain)? **To settle in
  SPEC-0006.**
- **Grade signature.** Whether an archetype emphasizes only grade-1 direction or
  also carries a flavor bivector/synthesis component (which would *not* affect the
  grade-1 fog query). **To settle in SPEC-0006.**
- **Default/skip.** Whether there is a "just explore" default persona or selection
  is mandatory. **To settle in SPEC-0006.**

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-31 | Build a persona creator as a client-only extension of the R-0005 POC, seeding the existing local (un-synced) reputation | Makes the "reputation = direction in domain-scoped space" thesis the first interaction; reuses the audited core with no CRDT change and no §7 risk |
| 2026-05-31 | A persona chooses orientation (domain + GA direction), never a stat/score | Rank is earned geometry, not dialed-in numbers (CLAUDE.md §4); the creator may only pick what is legitimately the visitor's to choose |
| 2026-05-31 | Add a second domain cluster to the seed | Domain choice is meaningless on a single-domain map; two clusters in different GA regions let a persona light one and leave the other fogged, demonstrating domain-scoped reputation |

## Changelog

- 2026-05-31 created (Draft) — pending architect design review of SPEC-0006, then acceptance
- 2026-05-31 SPEC-0006 drafted and architect-reviewed (APPROVE WITH CHANGES, folded
  in); all three open questions settled there (archetypes Geometer/Composer/Polymath
  over a Mathematics-e1 + Music-e3 seed; grade-1-only signature; mandatory
  selection). Acceptance criteria unambiguous. Status Draft → Accepted
- 2026-05-31 SPEC-0006 implemented (client-only, no Rust change) and verified. All
  gates green (node 10, `cargo test --workspace`, `wasm-pack test --node` 4, clippy
  `-D warnings` host + wasm32, fmt); browser-verified AC1–AC5 against the real wasm
  engine (lit sets Geometer {Arithmetic} / Composer {Rhythm} / Polymath
  {Arithmetic, Rhythm}; change-persona re-lights without reload; traverse lifts fog
  locally without syncing; `root_keys` unchanged). qa agent PASS on AC1–AC6.
  Status Accepted → Met
