# R-0063 — Resume your Teach-me lesson (persist lesson progress)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0060 (the guided "Teach me" lesson whose step it now remembers), R-0061 (the
  course whose overall progress it rolls up), R-0053 (`buildPath`/`loadPaths` — how a course path
  is looked up), R-0030 (topic mastery — the orthogonal "did I master it" signal).
- **Realized by:** direct implementation — a pure `lesson-progress.js` (progress-map operations) +
  a localStorage read/write edge and a Teach-me-button/course-line refresh in main.js.
- **Source:** the follow-up parked in the non-goals of BOTH R-0060 ("persisting lesson progress")
  and R-0061 ("persist per-topic lesson progress") — the piece that turns the course arc
  (declutter → teach a topic → build a course) into a journey you can leave and come back to.

## 1. Statement

The R-0060 lesson tracked the current step in a plain in-memory variable, so leaving a topic — or
reloading the app — always restarted the 7-step Feynman arc from step 1. This **remembers your
place**:

- Each topic's lesson **step** and a **done** flag are saved (localStorage, this browser only — like
  the notepad and private shelf; never synced, never in the CRDT).
- Reopening a topic's lesson **resumes at the saved step**; the **▶ Teach me** button reflects the
  state — `▶ Teach me this topic` (fresh) → `▶ Resume — step k/n` (mid-arc) → `✓ Reviewed — teach
  again` (finished, restarts fresh when reopened).
- When the topic is a step in a **built course** (R-0061), a line under the button shows how far
  through that course you are: `Course: <title> · d/n studied · you're on topic i`.

## 2. Rationale

R-0061 makes a course a real structure on the map and R-0060 teaches each stop, but without a saved
place the "course" had no sense of a journey: every visit restarted the lesson at step 1, and a
6-topic course gave no "2 of 6 done, you're on topic 3." Mastery (R-0030) already tracks the binary
"did I close this topic," but not "where am I inside teaching it." Persisting the lesson step — the
thing R-0060 and R-0061 both explicitly deferred — is the small missing piece that lets the learner
put the course down and pick it back up, which is what a course is for.

## 3. Acceptance criteria

- **AC1 — Resume the step.** Reopening a topic's Teach-me lesson resumes at the last step you were on
  (a finished topic restarts fresh — you're re-studying). Stepping Back/Next persists immediately.
- **AC2 — Button reflects state.** The ▶ Teach me button reads `▶ Teach me this topic` when fresh,
  `▶ Resume — step k/n` mid-arc, and `✓ Reviewed — teach again` once finished — set from saved
  progress every time a topic opens.
- **AC3 — Finish marks done.** Reaching the last step and pressing Finish marks the topic done and
  refreshes the button + course line; the panel closes.
- **AC4 — Course rollup.** When the open topic is a step in a saved course path (R-0061), a line
  shows `Course: <title> · d/n studied · you're on topic i` (and `· course complete ✓` when all
  done); it is hidden for topics not in any course, and never leaks into the bridge/connection view.
- **AC5 — Survives reload.** Progress persists across a full page reload and a fresh boot re-reads it
  (localStorage, this browser only — never synced, never in the CRDT).
- **AC6 — Pure + additive + tested.** `lesson-progress.js` (entryOf / withStep / withDone /
  lessonButtonLabel / courseSummary) is pure/deterministic with `node --test`; `apps/web` only; no
  core/Rust/wasm change; no new dependency; degrades safely if storage is blocked (the lesson still
  works, it just won't resume).

## 4. Constraints & non-goals

- **Local-only, like the notepad** — lesson progress is a private convenience, not shared graph
  state; it never enters the CRDT and never syncs to peers (a different device is a fresh journey).
- **Orthogonal to mastery** — "reviewed the lesson" (this) and "mastered the topic" (R-0030, a signed
  event) are separate signals; finishing the lesson does not auto-master, and mastering does not
  auto-mark the lesson reviewed.
- **Non-goals (follow-ups):** a "continue where you left off" jump straight to the course's next
  unfinished topic (courseSummary already computes `nextIndex`; wiring the click is deferred);
  syncing progress across devices; per-step (not just per-topic) resume within a hand-off.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Persist to localStorage (this browser), not the CRDT | Progress is a private convenience like the notepad/private shelf; putting it in the synced graph would leak a personal signal and bloat the doc. |
| 2026-07-16 | A finished topic reopens at step 1 ("teach again"), not the last step | Revisiting a reviewed topic means re-studying it; dropping you on the recall step would be useless. `done` is preserved so the button still reads "✓ Reviewed". |
| 2026-07-16 | Reaching the last step is not "done" — Finish is | You can page to the end to peek; completion is the deliberate Finish, matching R-0060's "Finish ✓". |
| 2026-07-16 | Pure module + main.js holds the storage edge | Same split as loadPaths/savePaths + paths.js — keeps the map logic unit-testable and the impure I/O thin. |

## Changelog

- 2026-07-16 created (Accepted) + implemented — the Teach-me lesson now remembers your step + a done
  flag per topic (localStorage), resumes where you left off, reflects state on the button
  (`Teach me` / `Resume — step k/n` / `✓ Reviewed`), and rolls a built course up to `d/n studied`.
  Pure `lesson-progress.js` with 5 `node --test` cases. Live-verified end to end (course line on
  open, step persistence, resume-at-saved-step, Finish → done + "✓ Reviewed" + course count bump,
  survives a full reload, clean boot, no console errors).
