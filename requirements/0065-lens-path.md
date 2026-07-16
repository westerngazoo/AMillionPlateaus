# R-0065 — "Your path": pick a lens → a numbered curriculum path

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0006/R-0009 (lenses/personas + the picker), R-0053 (seeded paths + `pathProgress`/
  `nextPathStep`), R-0057 (the physics-core plateaus this path orders), R-0063 (lesson-done, one of
  the "studied" signals), R-0030 (mastery, the other), R-0024 (`flyTo` — the pan-and-open).
- **Realized by:** direct implementation — a numbered `#lens-path` panel + `renderLensPath()` in
  main.js, a `DOMAIN_PATH_OF` lens→path map, a seeded `PHYS_CORE_PATH`, and a pure `pathRows` helper.
- **Source:** the owner: "whenever i choose lens i want to have the init step and also the path
  structure … i already told you i want a path structure maybe with topic numbers." (Confirmed:
  **seed** the curricula in-app, for **all core lenses**.) This is **slice 1 of 3** — the mechanism.

## 1. Statement

Picking a career lens now opens **"Your path"**: the lens' domain curriculum as a **numbered,
ordered list** (1, 2, 3 …) with an explicit **Start** step, a progress line, and a one-tap
Start/Continue. Every listed topic is a real plateau, so opening one plugs straight into the shipped
arc — ▶ Teach me (R-0060), Resume — step k/n (R-0063), Continue → next (R-0064).

- The panel appears the moment you pick a lens (the "init step"), and is re-openable via **🧭 Your
  path** in the menu.
- **Start here** (fresh) / **Continue — <next topic>** (in progress) flies the camera to and opens
  the next unstudied topic. Any numbered row is clickable to jump straight there.
- A topic reads **✓ done** when you've mastered it (R-0030) OR finished its lesson (R-0063); the
  progress line counts "d of n studied".

This slice ships the **mechanism** over the curricula that already exist (Classical, Computation, GA,
SIA) plus a new **numbered physics-core path** (the owner's licenciatura focus). Deepening the
content — granular Khan/degree-level topics, and Math/Music curricula (today bare) — is slices 2–3.

## 2. Rationale

The lenses oriented you and dropped you at a trailhead, but the curriculum was implicit — scattered
plateaus on the map with the order hidden in bridges, and (for Physics) no path at all. The owner
wanted the **structure made explicit and numbered**: a course you can see and follow, from a start
step. All the pieces existed (seeded paths, `pathProgress`, `nextPathStep`, `flyTo`, mastery, lesson
progress) but nothing turned "the lens you picked" into "here is your numbered path, start here." This
adds exactly that seam and reuses everything below it.

## 3. Acceptance criteria

- **AC1 — Lens → numbered path.** Picking a lens whose faced domain has a curriculum path shows the
  `#lens-path` panel: title, goal, a numbered `<ol>` of its topics, and a progress line. (No path for
  the lens → the panel does not auto-open.)
- **AC2 — Start / Continue.** A primary button reads **▶ Start here** when nothing is done, **▶
  Continue — <next topic>** mid-way, and **✓ Course complete — revisit** when all done; clicking it
  flies to and opens the next unstudied topic (or the first). Each numbered row opens its topic.
- **AC3 — Progress.** A topic is done when mastered (R-0030) OR its lesson is finished (R-0063); the
  row shows ✓ and the count updates ("d of n studied") when the panel is re-opened.
- **AC4 — Re-openable + graceful empty.** **🧭 Your path** in the menu toggles the panel; for a lens
  with no curriculum path yet (Math/Music), it shows a short "no path yet — try these lenses / Build
  a course" note instead of an empty list.
- **AC5 — Physics core path.** The Physicist lens shows **The Physics Core** — Motion → Mathematical
  Methods → Classical Mechanics → Rotational → Thermodynamics → Waves & Optics → Electromagnetism →
  Special Relativity → Quantum Mechanics → Spin (reusing the R-0057 plateau ids, so the GA/SIA
  cross-lens bridges stay intact).
- **AC6 — Pure + additive + tested.** `pathRows` is pure/`node --test`; the physics path + lens→path
  map are additive data + wiring; `apps/web` only; no core/Rust/wasm change; no new dependency;
  reuses `flyTo`/`openPlateau`/`nextPathStep`/`pathProgress`.

## 4. Constraints & non-goals

- **Slice boundary.** This is the vehicle. It surfaces the **existing** curricula as numbered paths
  and adds the physics-core ordering; it does **not** yet deepen the topic granularity or author the
  Math/Music curricula. Those are R-0066 (deepen Physics + source-grounded teaching) and R-0067
  (Math + Music), per the owner's "seed detailed curricula, all core lenses."
- **First faced domain wins.** A multi-domain lens (Polymath) resolves to its first `orient` domain;
  a per-lens choice of which curriculum is a later refinement.
- **Local progress.** "studied" reuses the local mastery + lesson-progress signals (this browser);
  nothing new is synced or added to the CRDT.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Reuse the seeded paths via a `DOMAIN_PATH_OF` lens→path map, don't build a new store | The paths (flagship, CS, physics-lens) are already seeded idempotently; the only missing seam was lens→path. |
| 2026-07-16 | Add a physics-core path over the EXISTING R-0057 plateau ids | The 9 physics plateaus are referenced by GA/SIA cross-lens bridges; reordering their ids would break those. The path is just their canonical reading order. |
| 2026-07-16 | done = mastered OR lesson-finished | Both are meaningful "I learned it" signals and both are already tracked locally; the union is the least surprising. |
| 2026-07-16 | Ship the mechanism first (slice 1), deepen content next | A reviewable vehicle that lights up 6 lenses now beats one giant content PR; the owner's "detailed/all lenses" lands across slices 2–3. |

## Changelog

- 2026-07-16 created (Accepted) + implemented (slice 1) — picking a lens opens **Your path**, a
  numbered curriculum with a Start step, progress, and one-tap Continue; **🧭 Your path** re-opens it.
  New `PHYS_CORE_PATH` (Motion → … → Spin) + a `DOMAIN_PATH_OF` map wiring Physics / Classical /
  Computation / GA / SIA to their seeded paths; pure `pathRows` with a `node --test` case (full suite
  483/483). Live-verified: Physicist → "The Physics Core" (10 numbered topics, Start), finishing a
  topic → "1 of 10 studied" + ✓ + "Continue — Mathematical Methods"; Programmer → the 20-topic CS
  path; Geometer → the graceful "no path yet" note; no console errors.
