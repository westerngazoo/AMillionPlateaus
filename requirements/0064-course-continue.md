# R-0064 — One-tap "Continue →" through a course

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0063 (lesson progress + `courseSummary`/`nextIndex` — the groundwork this wires
  up), R-0061 (the course path being walked), R-0060 (the per-topic lesson each stop opens), R-0024
  (`flyTo` — the camera pan reused for the jump).
- **Realized by:** direct implementation — a pure `continueIndex()` in `lesson-progress.js` + a
  `#lesson-continue` button wired in `renderLessonEntry` (main.js).
- **Source:** the follow-up named in R-0063's changelog/non-goals ("a 'continue where you left off'
  jump straight to the course's next unfinished topic; `courseSummary` already computes `nextIndex`,
  wiring the click is deferred") — the last tap that makes a built course followable end to end.

## 1. Statement

When you're on a topic that belongs to a course (R-0061), a **Continue → <next topic>** button under
the course line jumps you straight to the course's **first unfinished topic** — flying the camera
across the map and opening it. Finish a topic and the button appears pointing at the next one; one
tap walks you down the syllabus. The button is hidden when you're already on the first unfinished
topic (just study it) or the whole course is complete.

## 2. Rationale

R-0063 made a course a trackable journey ("2/3 studied · you're on topic 1"), but the learner still
had to find the next topic on the map by hand — the one manual step left in the arc. `courseSummary`
already knew which topic was next (`nextIndex`); this spends that to make the course **followable in
one tap**, closing the loop the owner set out: build a course → teach a topic → resume it →
**continue to the next one**.

## 3. Acceptance criteria

- **AC1 — Jump to the next unfinished topic.** On a course topic, a **Continue → <name>** button
  opens the course's first unfinished topic (`flyTo` its position, then open it). The target's lesson
  and course line update on arrival.
- **AC2 — Hidden when not useful.** The button is hidden when you're already on the first unfinished
  topic (you'd jump to yourself) and when the course is complete (`nextIndex === -1`); it never shows
  for a topic that isn't in any course.
- **AC3 — Appears on finish.** Finishing a topic's lesson (R-0063) refreshes the entry, so
  **Continue → <next>** appears immediately on the just-finished topic.
- **AC4 — No leak into bridge view.** Like the R-0063 course line, the button is hidden in the
  bridge/connection view.
- **AC5 — Pure + additive + tested.** `continueIndex()` is pure/deterministic with `node --test`;
  `apps/web` only; no core/Rust/wasm change; no new dependency; the jump reuses the existing
  `flyTo`/`openPlateau`.

## 4. Constraints & non-goals

- **First-unfinished semantics** — "Continue" resumes the course from its earliest gap (standard
  course-resume behavior), not "the topic spatially after this one." For a prereq-ordered R-0061
  course that's the natural next thing to study.
- **Non-goals (follow-ups):** a course overview/table-of-contents listing every topic with its
  done-state; a rule for which course wins when a topic belongs to several (today `.find` takes the
  first path by insertion order); auto-advancing without the tap.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | "Continue" targets the first unfinished topic, not `here + 1` | Standard resume semantics; respects prereq order and a skipped earlier topic, and reuses `courseSummary`'s `nextIndex` unchanged. |
| 2026-07-16 | Hide the button when you're on the first-unfinished topic | Jumping to yourself is a no-op; the ▶ Teach me button already covers "study this one". |
| 2026-07-16 | `flyTo` then `openPlateau`, not a bare open | A course topic can sit anywhere on the map; the pan gives the jump spatial continuity (you see where the next topic lives). |

## Changelog

- 2026-07-16 created (Accepted) + implemented — a **Continue → <next topic>** button on the course
  line that flies to and opens the course's first unfinished topic; hidden when you're on it or the
  course is done. Pure `continueIndex()` with a `node --test` case (6 total in lesson-progress).
  Live-verified: on a 3-topic "Optics" course, Continue was hidden on the fresh topic 1, appeared as
  "Continue → Refraction" after finishing it, and clicking it flew to + opened Refraction with the
  course line advancing to "you're on topic 2"; no console errors.
