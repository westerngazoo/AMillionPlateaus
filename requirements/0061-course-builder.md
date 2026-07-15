# R-0061 — Build a whole course from a reference

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-15
- **Depends on:** R-0011 (plateau authoring — `add_plateau`), R-0013 (bridge authoring —
  `add_bridge`), R-0053 (paths — `buildPath` / `savePaths`), R-0056 (NotebookLM/Gemini hand-off +
  search deep-links), R-0060 (the per-topic "Teach me" lesson each course topic inherits), R-0059
  (the ☰ menu the entry button lives in).
- **Realized by:** direct implementation — a pure `course-builder.js` (syllabus-prompt builder +
  outline parser + prerequisite linker) + a "Build a course" panel in `index.html`, driven by
  main.js which authors the plateaus/bridges/path.
- **Source:** the owner: "create some sort of course, get a reference on the topic, maybe a book or
  topic course from university and design the course step by step … as if I was going to use the
  Feynman method to create a course and teach it." Confirmed scope: a guided **Teach-me course**
  built from a **reference given by search / the web / the learner's choice**, with richer content
  via **hand-off to NotebookLM/Gemini**.

## 1. Statement

**🎓 Build a course** — name what you want to learn and (optionally) a reference (a book, a
university course, a link), and the app turns it into a whole **course laid out on the map**: one
plateau per topic, prerequisite bridges between them, and a followable path — each topic then
carrying the R-0060 **▶ Teach me this topic** lesson for free.

The flow is three steps, mirroring the R-0056 hand-off the owner chose over the flaky in-app API:

1. **Get the syllabus** — copy a graph-agnostic prompt that asks NotebookLM / Gemini / AI Studio for
   a **dependency-ordered syllabus in a strict, parseable line format**, and open that tool in a new
   tab (or find a reference first via the Google/Gemini/Wikipedia/Scholar deep-links).
2. **Paste the syllabus** you got back.
3. **Build the course** — the app parses the outline and authors it into the world.

Where R-0060 teaches ONE topic, R-0061 designs the **whole syllabus** and drops it into the graph as
real, connected, teachable geometry.

## 2. Rationale

The map is a world you explore, but a learner arriving at a new subject wants a **route through it**,
not a blank region to populate by hand. Everything to place a course already existed — `add_plateau`
positions a topic in a domain's GA axis, `add_bridge` links prerequisites, `buildPath` makes a
followable trail, and R-0060 teaches each topic — but composing them into a coherent syllabus was
manual, one plateau at a time. R-0061 automates the composition: a reference becomes a stepped course
in one paste. The generation (the actual pedagogy of "what are the topics, in what order") rides the
hand-off, so a 404/503 from a hosted model never blocks course-building, matching the owner's
standing preference to deep-link out rather than depend on the in-app model API.

## 3. Acceptance criteria

- **AC1 — Entry.** The ☰ menu's *Create* group shows **🎓 Build a course**; clicking it opens the
  course panel (and it starts hidden — a `.course-builder` `display:flex` must not defeat `[hidden]`).
- **AC2 — Get the syllabus (hand-off).** Given a title (+ optional reference), the panel offers
  **NotebookLM / Gemini / AI Studio** buttons; each copies a **parseable-syllabus prompt** built from
  the title + reference and opens the tool in a new tab (nothing sent automatically). A
  Google/Gemini/Wikipedia/Scholar **"find a reference"** deep-link row is prefilled from the title.
- **AC3 — Parse tolerantly.** Pasting the strict `N. Name :: description :: prereq: <name|none>`
  format yields ordered topics; looser lines (`N. Name — desc`, `- Name: desc`, bare `Name`) are
  also read, and prose/preamble/blank lines are skipped (never become a plateau). Duplicate names
  collapse; names/descriptions are length-capped.
- **AC4 — Author the course.** Building creates **one plateau per topic** in the active lens' domain
  (stepped along that domain's canonical GA axis, foundations outward), a **prerequisite bridge** per
  dependency (resolved to an earlier topic; missing/forward refs fall back to the previous topic so
  the course is always a connected chain), and a **followable path** (`Course: <title>`). The header
  topic/bridge counts rise accordingly.
- **AC5 — Teachable + opens.** Each authored topic carries a body naming its step (`Step k/n of the
  "<title>" course …`) and the R-0060 **▶ Teach me this topic** lesson; on build the panel closes and
  the **first topic opens**.
- **AC6 — Reference by the learner.** The reference is the learner's own (typed, or found via the
  search deep-links) — never auto-selected.
- **AC7 — Pure + additive + tested + model-free.** `course-builder.js` (prompt builder + parser +
  prereq linker) is pure/deterministic with `node --test`; `apps/web` only; no core/Rust/wasm change;
  no new dependency; the generation is the R-0056 hand-off (no in-app model dependency — verified by
  building a full course offline with no model configured).

## 4. Constraints & non-goals

- **No in-app model dependency for content** — the syllabus comes from the hand-off, per the owner's
  choice; a connected model is never required to build a course.
- **The parser trusts structure, not truth** — it faithfully lays out whatever syllabus is pasted; it
  does not fact-check topic ordering or invent missing topics. Garbage in, garbage laid out (but
  always as a connected chain).
- **Non-goals (follow-ups):** persisting per-topic lesson progress; auto-generating each topic's
  body/notes at build time (today the body is a stub + the Teach-me hand-off); merging a new course
  into an existing overlapping region (topics are always added, never deduplicated against the
  existing graph); a full RFC/SPEC ceremony (this shipped as direct implementation like R-0056/0060).

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-15 | Generate the syllabus via the R-0056 hand-off, parse it locally | Owner's explicit "hand-off to NotebookLM/Gemini" choice; $0, no key, and a hosted-model outage never stalls course-building. The parsing/authoring is pure local code. |
| 2026-07-15 | A strict `Name :: desc :: prereq` line format, tolerantly parsed | A machine-parseable contract makes the paste reliable; the looser fallbacks + prose-skipping absorb the formatting drift real models produce. |
| 2026-07-15 | Place topics in the active lens' domain, stepped along its canonical axis | Reuses the GA geometry the world is built on — a course reads as a route from foundations outward, in the region the learner is already facing. |
| 2026-07-15 | Always a connected chain (unmatched/forward prereqs → previous topic) | A course you can follow beats a faithful-but-broken dependency graph; `linkPrereqs` guarantees connectivity. |
| 2026-07-15 | Each topic inherits the R-0060 lesson; body is a stub + hand-off | Don't duplicate teaching; the course designs the syllabus, R-0060 teaches each stop. Auto-authoring bodies is a follow-up. |

## Changelog

- 2026-07-15 created (Accepted) + implemented — 🎓 Build a course: name a subject + reference →
  hand-off for a parseable syllabus → paste → authored as one plateau per topic (in the active lens'
  domain, stepped along its axis) + prerequisite bridges + a followable path, each topic carrying the
  R-0060 lesson. Pure `course-builder.js` with 6 `node --test` cases. Live-verified end to end: a
  6-topic "Classical Mechanics" course (offline, no model) added 6 topics + 5 bridges, saved a
  6-step path, opened the first topic with its Teach-me lesson; no console errors.
