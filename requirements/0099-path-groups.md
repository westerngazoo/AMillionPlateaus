# R-0099 — the whole career fits: fold a long path into cuatrimestre sections

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-24
- **Depends on:** R-0065 (numbered lens path), R-0096 (the 49-step degree).
- **Source:** the owner: "the whole career does not fit."

## 1. Statement

The degree path is 49 steps. On a phone or the Boox the path panel showed ~18 of them crammed into
a 46vh nested scroll *inside* an already-scrolling page — you could not see the whole career, and a
flat 49-item wall is hard to navigate even where it fits.

A long path now folds into **collapsible sections** by its natural structure. The degree groups by
cuatrimestre: ten headers you can scan at a glance, each showing its own progress (e.g. `0/5`), with
the cuatrimestre you're currently on **auto-expanded**. Step numbering stays **continuous** across
the groups (Cuatrimestre 2 opens at step 6, not 1). Collapsed sections are compact, so the nested
scroll is dropped and the page scrolls once.

Grouping is generic and derived from content: a step's section label is read from its plateau body
(`Cuatrimestre N`). Any lens without such a marker — every other lens — renders exactly as before,
flat, so this is purely additive for them.

## 2. Acceptance criteria

- **AC1** — pure helpers in `paths.js`: `pathGroupLabel` reads the cuatrimestre marker (null
  otherwise); `groupPathRows` folds numbered rows into CONSECUTIVE labelled sections, never
  reordering, preserving the global step number; `worthGrouping` requires ≥2 distinct labels so a
  path with one stray label stays flat; `sectionProgress` counts done-per-section. Unit-tested,
  including the real degree → exactly 10 sections covering all 49 steps.
- **AC2** — the path panel renders grouped when worthwhile: a `<details>` per section, the current
  step's section open, a per-section progress badge, continuous numbering via `<li value>`.
- **AC3** — when grouped, the 46vh nested-scroll cap is dropped (collapsed sections are short, so
  the page scrolls once instead of a scroller-inside-a-scroller); a non-grouped path keeps the cap.
- **AC4** — no regression for other lenses: without a cuatrimestre marker the list is flat, exactly
  as before.
- **AC5** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-24 created (Accepted) + implemented. Suite 622/622 (7 new path-grouping tests).
  Live-verified: the degree path renders as **10 collapsible cuatrimestre sections**, Cuatrimestre 1
  auto-open, per-section progress badges, `max-height:none` (nested scroll gone), Cuatrimestre 2
  numbered from step 6; the Physics Core path stays **flat** (20 rows, no groups, 46vh cap intact).
- 2026-07-24 — a duplicate `const nextId` in the same function scope (my grouping block plus the
  existing startBtn code) was a SyntaxError that broke boot. `node --check`'s lazy parse did NOT
  catch it — only the browser's full parse did (nothing loaded past main.js, wasm never fetched).
  Found by dynamically `import()`-ing the module in-page. The redundant later declaration was
  removed. Lesson: `node --check` is not sufficient to catch redeclaration errors; verify a browser
  module import (or run the app) before shipping a large main.js edit.
