# R-0097 — ⇄ Parallel view: the degree at the front door, both formalisms side by side

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-24
- **Depends on:** R-0096 (the degree lens + its GA/SIA twins), R-0051 (the split layout), R-0065 (paths).
- **Source:** the owner: "ok so maybe do the lens now and create a way to do parallel lenses so it
  opens full screen two side view and jump across paths."

## 1. Statement

R-0096 seeded the degree and wrote a GA or SIA **twin** for each cuatrimestre-1–3 course, but two
things stopped it becoming a daily study loop: the lens had no card at the front door (you had to
reach it through Build-your-own), and the twin was only findable by searching its name — the
ordered parallel route was stored but had no entry point at all.

This adds the front door and the **parallel view**: a full-screen two-pane reading where the course
you must pass sits on the left and your own view of it — the same syllabus in the other formalism —
sits on the right, each scrolling independently. One pair of controls moves **both**: `Next ›` steps
the syllabus to the next topic that *has* a twin and re-points the right pane to it, so the parallel
route is continuous instead of hitting the 39 untwinned asignaturas among the 49. The right pane
follows whichever lens that topic's twin belongs to, so the alternative formalism switches GA → SIA
→ GA as the material demands rather than locking you to one.

## 2. Acceptance criteria

- **AC1** — a career-lens card, **The Undergraduate**, faces the degree lens and begins at
  Introducción al cálculo. The degree is now pickable at boot, not only via Build-your-own.
- **AC2** — pure `parallel.js`: `twinMap`/`twinOf` resolve the `alternative formulation of` bridge in
  **both** directions (you may arrive from either lens); `pairPath` pairs every step of a route with
  its twin and **marks the gaps rather than hiding them**; `indexOfPair` locates a topic from either
  side; `stepPair` walks the pairs with an `onlyTwinned` option and **stops at both ends instead of
  wrapping**; `pairPosition` reports both positions. Nothing degree-specific — any two lenses joined
  by that concept pair up, including an adopted lens (R-0093). Unit-tested, including against the
  real 49-step degree.
- **AC3** — a **⇄** control appears in the topic header **only** when that topic has a twin, and
  toggles the parallel view.
- **AC4** — the parallel view reuses the existing `data-layout="split"` geometry, so it inherits the
  portrait rule: on a Boox held upright (or a phone) the panes **stack** — course on top, twin below,
  each full width — instead of two unreadable slivers. The right pane's two possible occupants (the
  R-0051 reader iframe and the twin) are mutually exclusive, and leaving split closes both.
- **AC5** — `‹ Prev` / `Next ›` move **both** routes at once, skipping untwinned steps, disabled at
  the ends; the footer reads the position on both routes ("Parallel 7 of 10 · step 9 of 49").
- **AC6** — the twin renders with the same Markdown+KaTeX pipeline as the main pane, minus the study
  machinery (mastery, proofs, notepad stay on the course side — this pane is for reading the other
  formalism).
- **AC7** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-24 created (Accepted) + implemented. Suite 616/616 (8 new parallel.js tests). Live-verified
  at 1280×820 and at 768×1024 portrait: opening *Geometría Analítica* showed ⇄, which opened the
  split with its **Geometric Algebra** twin and rendered rotor math; `Next ›` walked
  Geometría Analítica → Cálculo II → Álgebra Lineal I, the right pane switching **GA → SIA → GA** and
  skipping untwinned steps (9 → 11 → 12), `‹ Prev` retraced, and the walk ended at Física I
  ("Parallel 10 of 10 · step 15 of 49") with `Next ›` correctly disabled. In portrait the panes
  stacked 0–512 / 512–1024 at full width.
- 2026-07-24 — a content defect in R-0096 found while looking at the rendered split and fixed here:
  two bullet lists in the GA twins had lost the blank line before their first item, so the whole list
  collapsed into its lead-in paragraph and rendered its `- ` markers as body text. Restored, and the
  R-0096 rendering guard now also asserts that no paragraph contains a stray list marker.
