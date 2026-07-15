# R-0060 — Guided "Teach me this topic" lesson

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-15
- **Depends on:** R-0020 (plateau body + KaTeX), R-0048 (deep-study prompts), R-0050 (audio
  overview), R-0056 (NotebookLM/Gemini hand-off + private notepad), R-0045 (search deep-links),
  R-0030 (mastery gate).
- **Realized by:** direct implementation — a pure `lesson.js` (step model + prompt builders) + a
  lesson panel in the study drawer, driven by main.js.
- **Source:** the owner: "pick [a topic] and start from summary next, maybe an audio in the first
  topic, analogies, interactive examples … as if I was going to use the Feynman method to create a
  course and teach it." Content source = the NotebookLM/Gemini hand-off; reference = the learner's
  own search/choice.

## 1. Statement

A per-topic **guided lesson** — **▶ Teach me this topic** — that walks the learner through a
Feynman-style course one step at a time (progress + Back/Next), instead of a grid of buttons:

1. **Summary** — the topic's notes, rendered; a 🎧 **Listen** option (the audio overview).
2. **Ground it** — search deep-links (Google/Gemini/Wikipedia/Scholar) to anchor it in a source.
3. **Make it click** — an **analogy** hand-off.
4. **See it work** — a **worked-example** hand-off.
5. **Check yourself** — the deep-quiz hand-off.
6. **Teach it back** — the Feynman "explain it simply" hand-off (write, then grade).
7. **Lock it in** — a **flashcards** hand-off + the nudge to Mark as mastered.

The heavy generation rides the **hand-off** (copy a graph-grounded prompt → open NotebookLM/Gemini/
AI Studio → paste), so a flaky model API never blocks the lesson. Each step reuses what the app
already has; the lesson just **sequences** it.

## 2. Rationale

The map tells you WHERE a topic sits; it never taught the topic. The pieces to teach it were all
present (notes, audio, deep-study prompts, the hand-off, the notepad, the mastery gate) but scattered
across a wall of buttons — the learner had to know the pedagogy. Sequencing them into a named,
stepped lesson turns the study drawer into an actual course, and the Feynman arc (see it → ground it
→ analogy → example → self-test → teach it back → recall) is the pedagogy the owner asked for, made
one-tap.

## 3. Acceptance criteria

- **AC1 — Entry.** An open plateau shows **▶ Teach me this topic**; clicking it opens the lesson at
  step 1 and hides it again on Close / Finish. (Hidden in bridge/connection view.)
- **AC2 — The Feynman arc.** The lesson steps in order: summary → ground → analogy → example → check
  → teach-back → recall, with a progress indicator and Back/Next (Back disabled on step 1; the last
  step's button reads "Finish ✓" and closes the panel).
- **AC3 — Per-step actions.** Summary renders the topic body (Markdown + KaTeX) + a 🎧 Listen button
  (R-0050); Ground shows the search deep-links; the analogy/example/check/teach/recall steps offer
  the NotebookLM/Gemini/AI Studio hand-off, each copying a **graph-grounded prompt** built from THIS
  topic's name/notes/neighbours, opening the tool, nothing sent automatically.
- **AC4 — Reference by the learner.** The "Ground it" step lets the learner pick a source (search /
  web / their choice) — no auto-selected reference.
- **AC5 — Resets per topic.** Opening another plateau collapses any open lesson (no stale step/topic
  carries over).
- **AC6 — Pure + additive + tested.** `lesson.js` (the step model + prompt builders + `clampStep`)
  is pure/deterministic with `node --test`; `apps/web` only; no core/Rust/wasm change; no new
  dependency; the heavy generation is the R-0056 hand-off (no in-app model dependency).

## 4. Constraints & non-goals

- **No in-app model dependency for content** — the analogy/example/etc. ride the hand-off, per the
  owner's "hand-off to NotebookLM/Gemini" choice (the in-app API has been unreliable). A connected
  model can still be used via the existing companion; the lesson doesn't require it.
- **Non-goals (follow-ups):** generating a whole multi-topic course from a book/university syllabus
  (R-0061); persisting lesson progress; embedding the generated analogies/examples back into the
  plateau automatically; interactive widgets beyond the notepad.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Sequence existing pieces into a stepped panel, don't build new generators | Everything to teach a topic already existed (notes/audio/prompts/hand-off/notepad/mastery); the gap was orchestration + pedagogy, not capability. |
| 2026-07-15 | Content via the R-0056 hand-off, not the in-app API | Owner's explicit choice; $0, no key, and a 404/503 from a hosted endpoint never stalls a lesson. |
| 2026-07-15 | The reference is the learner's own choice (search step), not auto-picked | Owner: "the reference shall be given maybe from a search or … let the ppl choose." |
| 2026-07-15 | Seven short steps, Back/Next, last = "Finish" | A lesson you finish beats one you abandon; the arc is the Feynman method made concrete. |

## Changelog

- 2026-07-15 created (Accepted) + implemented — ▶ Teach me this topic: a 7-step Feynman lesson
  (summary → ground → analogy → example → check → teach-back → recall) reusing the audio, hand-off,
  notepad, and mastery gate. Live-verified end to end (all steps, correct per-step actions, KaTeX
  body, Finish closes, resets per topic, hidden in bridge view, no console errors).
