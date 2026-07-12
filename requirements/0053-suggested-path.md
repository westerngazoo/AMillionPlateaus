# R-0053 — Suggested path: the app proposes your next route

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-11
- **Depends on:** R-0039 (learning paths — the follow/author/publish machinery this feeds),
  R-0030 (mastery — the signed data the suggestion reads), R-0013 (bridges — the graph's own
  "learn these together" signal the generator walks), R-0019 (wayfinding — centerOn for "go").
- **Realized by:** direct implementation (`suggest-path.js` pure rankers + one card in the
  Paths panel; no new storage, no new architecture)
- **Source:** the owner: "sabes que falta un suggested path".

## 1. Statement

The Paths panel opens with a **Suggested** card — the app's own proposal instead of a blank
picker, decided by three grounded levels:

1. **Continue** — if the learner is following an unfinished path: its title, real progress
   (mastered/total) and the next step, with a one-click "Go to next step" (centres the map and
   opens the topic).
2. **Best existing path** — otherwise, rank every saved path: started-but-unfinished first
   (momentum beats novelty), then paths covering the learner's current domain, then the one
   closest to completion; ties broken by title. One-click **Follow**.
3. **Generated route** — when no authored path has work left: breadth-first from where the
   learner stands, across the graph's bridges, collecting the UNMASTERED topics of their domain
   nearest-first (out-of-domain neighbours traverse as connectors but never enter the route),
   capped at 7 steps. One-click **Save & follow** stores it as a normal local path
   ("Suggested: <domain>") — publishing stays a separate, explicit act (R-0039).

All three levels are deterministic and read only signed/local data: real mastery, real bridges,
real position. No model call, $0, works offline.

## 2. Rationale

The map had paths one could author and follow, but nothing ever *proposed* one: a new learner
(or a learner in a domain no path covers) faced fifty islands and a blank "— new path —" form.
Suggestion is the missing default. Grounding it in the graph rather than a model keeps it free,
offline, and honest — the same data that colours the progress map decides the recommendation.

## 3. Acceptance criteria

- **AC1 — A proposal on open.** Opening the Paths panel renders the Suggested card (continue /
  best-existing / generated / honest "nothing left"), never a blank.
- **AC2 — Momentum first.** A started-but-unfinished path outranks a fresh one; a fresh path
  covering the learner's domain outranks one that doesn't; finished paths are never suggested.
- **AC3 — Grounded generation.** The generated route contains only unmastered topics of the
  learner's domain, in bridge-BFS order from their position, capped; when everything in reach is
  mastered the card says so honestly.
- **AC4 — One click to walk.** Follow / Save & follow reuse the existing R-0039 follow path
  (same followPathId, same camera move); the saved suggestion is an ordinary local path the
  learner can edit or publish deliberately later.
- **AC5 — Deterministic + pure.** Ranking and generation live in `suggest-path.js` (no DOM, no
  storage), with unit tests covering momentum, domain preference, tie-breaks, BFS order,
  mastered-skipping, the cap, and the everything-mastered case.

## 4. Constraints & non-goals

Non-goals: model-written route rationales; suggesting PUBLISHED peers' paths ahead of local
ones (published paths surface in their own list); cross-domain routes (the suggestion stays
inside the learner's lens); full meet-based intersection routing (stays with RFC-0002/R-0039 —
v2's lens-weighted metric is the per-learner half of that story, not the domain-meet half).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-11 | Graph-grounded, not model-generated | Deterministic, $0, offline; mastery + bridges already encode "what's next" |
| 2026-07-11 | Momentum outranks domain match | An abandoned half-path is the highest-value nudge the app can give |
| 2026-07-11 | Generated route capped at 7 | A suggestion is a walk, not a syllabus; the full curriculum lives in authored paths |
| 2026-07-11 | Save & follow creates a NORMAL local path | One path machinery; publishing stays explicit (R-0039's trust posture) |
| 2026-07-12 | v2: proximity is LENS-WEIGHTED (owner: "según el lens, dependerá del enfoque") | "Related" depends on the looker: the orientation's axes re-weight the Grade-1 metric, so a Formal-facing lens and a Creative-facing lens get DIFFERENT orders over the same graph. Bridges still gate reachability; the lens orders it |
| 2026-07-12 | v2: greedy chain from the LAST step, not rings from the start | A route should read as a walk — each hop to the lens-nearest related topic ("ligados más cerca") |
| 2026-07-12 | v2: clicking a suggestion FLIES the camera (eased pan) | The map is a world; travel should read as travel, not teleport (owner: "que lo cliquees y te vuele al plateau") |

## Changelog

- 2026-07-11 created (Accepted) + implemented — Suggested card in the Paths panel with the three
  levels (continue / best existing / bridge-BFS generated), pure rankers + 7 tests.
- 2026-07-12 v2 — lens-weighted proximity (lensWeights/lensDistance; the generated route is a
  greedy lens-nearest chain; no lens → v1 order unchanged), every route step is a clickable chip,
  and Follow / Go-to-next-step FLY the camera to the plateau (eased pan, superseding flights).
