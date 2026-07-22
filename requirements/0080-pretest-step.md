# R-0080 — pretest step: try before you're taught

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0060 (the guided lesson), R-0063 (lesson progress), R-0073/74 (deliverable).
- **Source:** the owner's approved pedagogy trio (spaced review → **pretest** → faded derivations);
  part (b).

## 1. Statement

The guided Teach-me lesson (R-0060) now opens with a **Pretest** step, before any teaching.
Attempting to retrieve an answer you don't have yet — and getting it wrong — primes the brain to
encode the correct answer far better than reading it cold (the *pretesting* / errorful-generation
effect, one of the owner-requested evidence-based methods). The step shows **2–3 retrieval
questions** built purely from the topic's graph context (no model): a prior-knowledge guess
always, the topic's own **Deliverable** as a "attempt the goal first" question when it has one,
and a **neighbour-connection** guess when the topic has bridges. You answer from memory in a
persisted attempt box; **Next →** starts the lesson (Summary). Nothing is graded — the answer is
the lesson that follows.

The lesson arc becomes **pretest → summary → ground → analogy → example → check → teach → recall**
(8 steps). The pretest attempt persists per topic in `mp.pretest` localStorage (this browser only,
never synced, never in the CRDT — like the notepad and lesson progress), so it survives
navigation and reload.

## 2. Acceptance criteria

- **AC1** — pure `pretestQuestions({ name, deliverable, neighbors })`: always a prior-knowledge
  question naming the topic; adds the deliverable-attempt question when a deliverable is present;
  adds a connection question naming ≤2 neighbours (strings or `{name}`) when neighbours exist.
  2–3 short strings, safe with no args. Unit-tested. `LESSON_STEPS` gains a `pretest` step at
  index 0 (kind `pretest`).
- **AC2** — the lesson opens on **Step 1 of 8 · Pretest**: the questions render (the deliverable
  question's TeX typeset), a persisted attempt textarea (pre-filled from `mp.pretest`), Back
  disabled, Next → advances to Summary. The coach names the pretesting effect and says nothing is
  graded.
- **AC3** — the attempt persists across Back/Next and a full reload (per-topic `mp.pretest`),
  local-only.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 554/554 (updated the lesson-arc test + a new
  pretestQuestions test). Live-verified: The Geometric Product lesson opened on Step 1 of 8 with
  three questions (prior-knowledge, the ½(ab±ba) deliverable KaTeX-typeset, a Bivectors/Vector-
  Derivative connection guess); the attempt saved to `mp.pretest`, survived Back and a full
  reload (attempt box repopulated), and Next → advanced to Summary (Step 2 of 8).
