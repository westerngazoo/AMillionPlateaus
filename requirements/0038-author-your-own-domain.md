# R-0038 — Author your own domain (more lenses than Math/Physics/Music)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-22
- **Depends on:** R-0006 (the persona/lens creator), R-0009 (visitor-authored personas — the `authorPersona` factory + persistence pattern this mirrors), R-0012 (browser-durable local persistence), R-0002/R-0008 (a domain is a grade-1 direction in the GA space; the fog/reputation engine projects onto any direction, not only the basis axes)

- **Realized by:** SPEC-0038 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

When a visitor builds their own lens, only **three** domains are offered — Mathematics
(e1), Physics (e2), Music (e3) — because the seeded `DOMAINS` list happens to sit on the
three pure GA axes. But a domain is just a **named grade-1 direction** `{ label,
canonical: {e1,e2,e3} }`, and the engine projects reputation/fog onto **any** direction.
This requirement lets a visitor **author their own domains** — name a lens (e.g. "AI",
"Electromagnetism", "FPGA", "Computation") and place it with the existing
Formal/Empirical/Creative sliders — so it becomes a faceable lens and labels that region
of the map. The owner's fields (AI, hardware, electronics, FPGA) are **grounded blends**
of Formal+Empirical(+Creative), not new fundamental axes, so they live as **regions in
the existing 3-axis space** — **no `garust`/core change**. A few useful **preset
blend-domains** ship too so the picker is immediately richer.

## 2. Rationale

The owner is studying AI + Physics, grounding everything in Geometric Algebra and
rebuilding computation/hardware from that base — so they need lenses like AI,
Computation, Electronics, FPGA. These are not new orthogonal dimensions (that would be a
`Cl(3)→Cl(n)` core change and would *contradict* "grounded in the three axes"); they are
directions/regions within Formal/Empirical/Creative. The model already supports this — a
domain carries an arbitrary canonical grade-1 vector — so this is a **JS authoring +
persistence** feature over the existing creator, mirroring R-0009's authored personas:
author the *direction only* (never a magnitude), persist locally, and surface the domain
wherever the built-in three appear.

## 3. Acceptance criteria

- **AC1 — Author a domain.** In "Build your own", the visitor can **name a domain** and
  set its **Formal/Empirical/Creative** direction (the existing sliders), and add it. It
  then appears as a faceable lens alongside the built-ins, can be oriented toward, and is
  used as that orientation's label on the map.

- **AC2 — Direction only, grounded.** Authoring sets a **grade-1 direction**, never a
  magnitude/score/rank (CLAUDE.md §4). The domain is a region in the existing 3-axis GA
  space — **no new axis, no `garust`/core change**. Facing it orients via the same
  projection the built-ins use (it may light the existing plateaus its direction
  projects onto — a blend lens lights its contributing topics).

- **AC3 — Durable + identified.** An authored domain **survives a reload** (browser-local
  persistence, R-0012-style) and carries a **stable id derived from its name**, so
  re-authoring the same name reuses the same domain (no duplicates) and a signed
  **traversal** in that domain validates (the id is a parseable UUID — the signing path
  requires it).

- **AC4 — Surfaced everywhere a domain is.** The authored domain appears in the persona
  creator's orient list, resolves to its **label** (never "Uncharted") in the HUD /
  discovery / map, is selectable when **drafting a plateau**, and is scored for
  **traversal/discovery** like a built-in (its canonical direction drives the projection).

- **AC5 — Presets.** A few **blend-domain presets** ship in the built-in set (e.g.
  Computation, Engineering/Hardware, AI) so the picker is richer out of the box; facing
  one is meaningful (it lights the existing plateaus it projects onto). Presets carry
  fixed shared ids.

- **AC6 — Pure + tested, additive.** The `authorDomain(name, direction) → { id, label,
  canonical }` factory is **pure + unit-tested** (stable id from name, direction-only,
  blank name rejected, deterministic). **JS + CSS only** — no Rust/wasm/CRDT/core change;
  reuses `authorPersona`/`seedReputation`/the existing creator + `DOMAIN_OF`/projection.
  Existing suites stay green.

- **AC7 — Green + browser-verified.** All suites green; in the browser: author a domain
  ("AI", a Formal+Empirical lean), it appears + is faceable; build a persona facing it;
  reload → the domain persists and is still faceable; it's selectable when drafting a
  plateau; no uncaught console errors.

## 4. Constraints & non-goals

- **Region, not a new axis.** Domains are directions in `Cl(3,0,0)`; no higher-dimensional
  algebra, no projection/fog-math change.
- **Direction only.** Authoring never sets a magnitude/rank (the orientation lens
  invariant).
- **Local this phase.** Authored domains are browser-local; **cross-user domain
  alignment/sharing** (so two people's "AI" reconcile) rides the later paths/publish work
  (a domain published as a signed artifact) — a non-goal here, though the name-derived id
  is chosen to make that future alignment natural.
- **Non-goals:** authoring plateaus/trailheads for a new domain (use the existing
  Draft-a-plateau form), editing/deleting a domain's geometry after creation (re-author),
  per-domain colors/archetypes, and any garust/core change.

## 5. Open questions

- **Domain id scheme.** A deterministic UUID derived from the normalized name (stable,
  dedup, future-alignable) vs. a random per-author UUID. Lean: name-derived. Spec fixes
  the derivation.
- **Add-domain UX.** A dedicated "Add a domain" sub-form in the creator vs. an inline
  "+ new lens" row. Lean: a small sub-form reusing the axis sliders. Spec fixes.
- **Which presets.** Computation, Engineering/Hardware, AI (+ maybe Biology). Spec fixes
  the shipped set + their canonical blends.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-22 | More lenses = **author-your-own domains** (+ a few presets), not a new GA axis | Owner choice; the owner's fields are grounded blends of the 3 axes, so they're regions in the existing space — no core change, and a new axis would contradict "grounded in GA" |
| 2026-06-22 | A domain is a named grade-1 direction; reuse the existing projection | The engine already projects onto any canonical vector; authoring just adds `{label, canonical}` entries |
| 2026-06-22 | Name-derived stable UUID id | Dedups re-authoring, makes a signed traversal in the domain valid, and sets up future cross-user alignment by name |

## Changelog

- 2026-06-22 created (Accepted) — author custom domains (name + Formal/Empirical/Creative
  direction) as faceable lenses, durable + name-identified, surfaced everywhere the
  built-in three are; + a few blend-domain presets. JS/CSS only, no core change. Pending
  SPEC-0038 + architect review.
