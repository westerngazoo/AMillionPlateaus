# R-0100 — add a prerequisite the plan missed

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-24
- **Depends on:** R-0070 ("Before this, study…"), R-0072 (topic search).
- **Source:** the owner, on Óptica: "for optics I may also need analytical geometry — not listed as
  prerequisite. add a way to add it."

## 1. Statement

Prerequisites (R-0070) are derived from **path order**: the earlier steps of a topic's curriculum you
haven't studied. So a real dependency the plan doesn't *sequence* never appears — Geometría Analítica
underpins Óptica, but the plan (FÍSICA-2019) lists both in cuatrimestre 2 with Óptica *before*
geometry, so geometry is never surfaced as a prereq.

A reader can now add one. On any topic, **➕ Add a prerequisite** opens a type-to-find picker over
every topic; picking one adds it to the "Before this, study…" list, marked as yours and removable
with a ✕. It joins the hand-off "Guide me through them" prompt like any other prereq.

These additions are **personal, this-browser-only** — stored in `localStorage` (`mp.prereqs`), the
same as R-0071 confusions and the private notepad — not seeded into the shared graph. (A synced
version would want a `remove_bridge` in the wasm, which does not exist yet; noted as a follow-up.)

## 2. Acceptance criteria

- **AC1** — pure helpers in `prereqs.js`: `combinePrereqs` merges path-derived prereqs (first,
  numbered) with user-added ones (after, marked `user:true`), deduped by id (a user prereq that is
  also a path step keeps the numbered row) and dropping already-studied user prereqs;
  `prereqCandidates` returns name-substring matches, **diacritic-insensitive** ("optica" → Óptica),
  excluding the topic itself and anything already listed, ranked prefix-first. Unit-tested.
- **AC2** — the prereq box always offers **➕ Add a prerequisite** (a type-to-find picker); picking a
  topic adds it, re-renders, and persists to `mp.prereqs`.
- **AC3** — a user-added prereq shows with a dashed chip + ✕ that removes it; a path-derived prereq
  has no ✕.
- **AC4** — the hand-off study-plan prompt includes user-added prereqs alongside the path ones.
- **AC5** — additive, no new dependency, `apps/web` only, no wasm change; suite stays green.

## Changelog

- 2026-07-24 created (Accepted) + implemented. Suite 620/620 (5 new prereqs tests). Live-verified on
  the owner's exact case: opened **Óptica** (FIS-1908), typed "geometr" → **Geometría Analítica** was
  the top diacritic-insensitive match, added it → the box read "Before this, study 8 prerequisites"
  (the 7 path steps numbered 1–7 plus "＋ Geometría Analítica" with a ✕), persisted to
  `mp.prereqs`, and the ✕ removed it. Browser module-import verified before shipping (R-0099 lesson:
  node --check alone is insufficient).
