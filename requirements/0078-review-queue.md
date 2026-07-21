# R-0078 — 📅 spaced review queue: SM-2 retrieval practice, interleaved across lenses

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-21
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0030 (mastery), R-0056 (notes), R-0063 (lesson progress), R-0073/74
  (deliverables + derivations as review material).
- **Source:** the owner: "what other proved pedagogic forms can you suggest that are proven ways
  of learning faster?" → approved trio (spaced queue → pretest → faded derivations), this is (a).

## 1. Statement

The two best-evidenced accelerants in the learning literature are the **testing effect**
(retrieving beats re-reading) and the **spacing effect** (growing intervals beat massing); mixing
lenses in one session (**interleaving**) beats blocking. The app now practices all three: a
**📅 Review** menu entry (with a live "— N due" count) opens a card session over the topics
you've actually engaged with — **mastered, lesson-touched, or noted**. Each card shows only a
retrieval prompt (the topic's **Deliverable**, else a recall-the-key-idea prompt); **Show answer**
reveals the full teaching body (derivation collapsible, challenges stripped) plus **your own
note** (images included); you grade yourself **Again / Hard / Good / Easy** and SM-2 schedules
the next appearance (lapse → ~10 min; ladder 1 d → 3 d → interval × ease, ease floored at 1.3).
New topics enter at most **5 per day** so a big backlog never floods; due cards are round-robined
across lenses. Scheduling math is the pure `review-queue.js` module; state is `mp.reviewQueue`
in localStorage — this browser only, never synced, never in the CRDT. Fully offline.

## 2. Acceptance criteria

- **AC1** — pure module: SM-2 `graded` (Good ladder 1→3→×ease; Again resets reps, −0.2 ease
  floored at 1.3, ~10 min retry; Easy/Hard nudge ease up/down), `dueEntries` (enrolled + due,
  most overdue first, scoped to live plateau ids), `freshIds` (unenrolled, ≤5/day counting
  today's introductions), `interleave` (round-robin by lens, stable within lens), `nextDue`.
  No `Date.now()` — `now` is always a parameter. Unit-tested.
- **AC2** — the 📅 Review menu entry shows "— N due" (due + today's new) from boot and refreshes
  when the menu opens; the panel shows "N due · M new today", the card (topic · lens, prompt),
  Show answer → body + derivation collapsible + your note → grade buttons; grading persists and
  advances; an empty queue explains how topics enroll or when the next review is.
- **AC3** — enrolment is derived, not manual: mastered ∪ noted ∪ lesson-progress topics that
  still exist in the graph; **Open topic →** flies to and opens the plateau.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-21 created (Accepted) + implemented. Suite 543/543 (9 new review-queue tests).
  Live-verified: noted topic enrolled as "1 due" new card with its real Deliverable as the
  KaTeX-typeset prompt; reveal showed body + collapsible derivation + the note; Good scheduled
  reps 1 / 1 day; state survived reload (boot label "📅 Review — 1 due"); Again lapsed to
  reps 0, ease 2.5→2.3, due in 10 min.
