# R-0050 — Audio overview & study pack: NotebookLM's remaining outputs, graph-grounded, $0

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-09
- **Depends on:** R-0048 (the deep-study verb row + prompt-pack pattern this extends), R-0007
  (bring-your-own model — writes the episode), R-0026 (offline digest — the plateau-scope verbs'
  no-model fallback), R-0030 (mastery — what flashcards feed into next).
- **Realized by:** direct implementation (`podcast.js` + `study-prompts.js` additions + player
  glue; same seams as R-0048 — no new architecture)
- **Source:** the owner: "notebookLM has a lot of new features can we integrate?" → the answer:
  no consumer API exists, so we adopt the FEATURES, grounded in the graph instead of a notebook.

## 1. Statement

Two additions to the Deep study row:

1. **🎧 Audio overview** — the connected model writes a short two-host podcast episode about the
   open topic (HOST A the curious learner, HOST B the expert), grounded in the whole domain's
   capped topic notes; the browser's built-in `speechSynthesis` reads it aloud with two voices.
   No TTS service, no key, $0 — and the transcript renders alongside, honestly readable when a
   browser has no speech synthesis at all.
2. **The study pack** — five more one-click verbs in the R-0048 mold: **Study guide**, **FAQ**,
   **Flashcards** (plateau-scoped: ride the standard grounding, fall back to the honest R-0026
   digest offline) and **Briefing doc**, **Timeline** (domain-scoped: embed the domain's capped
   topic notes, like Mental models).

## 2. Rationale

NotebookLM's 2026 lineup was reviewed for integration; there is no consumer API (Enterprise-only,
GCP-bound) and UI scraping breaks the app's trust boundary. But its features are just
"bounded sources + output-shaped prompts", and the graph is a better bound: signed mastery,
real bridges, domains as notebooks. Audio Overview is its most-loved output and costs us
nothing — the model writes, the browser speaks. (Its other two 2026 flagships we already have:
the mind map IS the app; code execution is R-0046.)

## 3. Acceptance criteria

- **AC1 — Episode from the graph.** With a model connected, 🎧 Audio overview produces a script
  grounded in the open plateau + its domain's topics (bodies capped per topic), parsed into
  alternating HOST A / HOST B turns.
- **AC2 — Browser-native playback.** Play/Pause/Stop via `speechSynthesis`; two distinct voices
  when the browser offers them, one voice pitched apart otherwise; the transcript renders with
  per-host colouring and the playing line highlighted. No new dependency, no audio service.
- **AC3 — Honest degradation.** No model → an honest "connect a model" note (a dialogue can't be
  extracted from notes); no `speechSynthesis` → the transcript still renders, marked read-along;
  an unparseable reply → an honest retry note, never a silent empty player.
- **AC4 — Robust parsing.** The script parser tolerates real model drift (bold markers, case,
  dashes, bare "A:", "HOST 1/2", continuation lines) and falls back to alternating paragraphs
  when a reply carries no markers at all. Pure, unit-tested.
- **AC5 — Study pack verbs.** Study guide / FAQ / Flashcards / Briefing doc / Timeline appear in
  the Deep study row; plateau-scope verbs ride the standard grounding + offline digest fallback;
  domain-scope verbs embed capped domain notes. Each prompt's defining instruction is unit-tested.
- **AC6 — Same trust boundary, no history pollution.** Everything rides the existing companion
  path (visitor's own endpoint/key). The full episode script is deliberately NOT pushed into the
  chat history (it would dominate the companion's context); the player owns it. Speech stops when
  the drawer closes or another topic opens.

## 4. Constraints & non-goals

Non-goals (follow-ups): saving an episode as an audio file (speechSynthesis has no capture
surface — would need a TTS service, breaking $0); the slides/report NotebookLM formats (the
briefing doc covers the report's role in text); auto-grading flashcard sessions into R-0030
mastery (the learner still self-attests); voice pickers/speed controls.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-09 | Browser `speechSynthesis`, not a TTS API | $0, offline, zero deps — the prototype's posture; quality is "good enough to study to" |
| 2026-07-09 | Script format contract "HOST A:/HOST B:" + tolerant parser | Models drift from format contracts; a strict parser would turn drift into user-facing errors |
| 2026-07-09 | Episode kept OUT of chat history | A 14-turn script would dominate assembleMessages context for every later turn |
| 2026-07-09 | Two hosts distinguished by pitch when one voice exists | Boox/e-ink browsers often ship a single voice; the dialogue must still be followable |

## Changelog

- 2026-07-09 created (Accepted) + implemented — 🎧 Audio overview (podcast.js: prompt/parser/
  voices, pure + tested; player glue in main.js) and the five-verb study pack (study-prompts.js).
  Also closed an R-0048 gap: the Deep study row now hides in bridge mode like its siblings.
