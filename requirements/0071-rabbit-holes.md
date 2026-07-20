# R-0071 — Mark the sentence that lost you (rabbit holes + hidden prerequisites)

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-16
- **Depends on:** R-0020 (the rendered Markdown/KaTeX body being segmented), R-0056 (the
  NotebookLM/Gemini hand-off), R-0069 (`matchTopics` — the pasted answer resolves to real plateaus),
  R-0070 (the amber "gap" visual language it shares), R-0024 (`flyTo`).
- **Realized by:** direct implementation — a pure `rabbit-hole.js` (math-aware sentence splitter +
  two prompts) + body segmentation and a `#rh-actions` row driven by main.js.
- **Source:** the owner, on opening The Geometric Product: "it is throwing info and equations at me,
  not going slow… I shall be able to mark each one of the sentences if I do not understand and go
  into that rabbit hole — or if I don't have the prereqs, it's like opening a plateau previous that I
  did not know I needed. Throwing the product just like that does not make it pedagogic."

## 1. Statement

Every sentence of a topic's body is **tappable**. Tap the one that lost you and it's **marked** ("I
don't get this" — amber, persisted per topic, this browser only), and a rabbit-hole row opens with:

- **🐇 Explain this slowly ↗** — a hand-off scoped to THAT sentence: one idea per paragraph, every
  symbol defined at first use, a concrete analogy before the formal statement, equations read aloud
  term by term, and a plain-language restatement at the end.
- **🧩 What am I missing? ↗** — a hand-off asking which prerequisite concepts the sentence silently
  assumes, constrained to EXACT topic names from the learner's map; pasting the answer back turns the
  names into **tappable doors** (via `matchTopics`) onto the plateaus they didn't know they needed —
  concepts not on the map are reported plainly ("Not on the map: …").

Tap the marked sentence again when it clicks — the mark clears. Marks re-apply whenever the topic is
reopened, so your confusions are a persistent trail through the material.

## 2. Rationale

The curricula (R-0065–R-0068) fixed *structure* — order, numbering, prerequisites between topics —
but inside a single body the text still lectures at full speed, and confusion is *sentence-sized*,
not topic-sized. Marking the exact sentence (a) gives the hand-off surgical context — "explain THIS,
slowly" beats "explain the topic again"; (b) turns "I don't get it" into a queryable artifact — the
hidden-prereq hand-off + matchTopics paste-back is R-0069's routing loop pointed inward, discovering
the prerequisite *within* a sentence rather than between topics; and (c) the persisted marks make
re-reading honest: you can see exactly what still doesn't click.

## 3. Acceptance criteria

- **AC1 — Sentence segmentation that never breaks math.** Topic bodies are split into tappable
  sentence spans BEFORE KaTeX typesets; the splitter treats `$…$` as atomic (a delimiter pair can
  never straddle two spans), abbreviation-like "e.g. lowercase" doesn't split, and concatenating the
  chunks reproduces the text exactly. KaTeX renders normally inside the spans.
- **AC2 — Tap to mark, tap to clear, persisted.** Tapping a sentence marks it (amber) and opens the
  rabbit-hole row for it; tapping the active marked sentence again unmarks it. Marks are stored per
  topic (localStorage `mp.confusions`, this browser only — never synced, never in the CRDT) keyed by
  the sentence's pre-typeset canonical text, and re-applied on every reopen (immune to KaTeX
  rewriting the visible text).
- **AC3 — Sentence-scoped slow explanation.** "Explain this slowly" copies a prompt containing the
  topic, its curriculum path, and the marked sentence, demanding stepwise pedagogy (one idea per
  paragraph, symbols defined at first use, analogy first, equations in words, plain restatement) and
  opens NotebookLM/Gemini/AI Studio — nothing sent automatically.
- **AC4 — Hidden prerequisite → a door.** "What am I missing?" copies a prompt with the sentence +
  the full lens-grouped topic list, asking for the assumed concepts as EXACT topic names (one per
  line; off-map concepts prefixed "missing:"). Pasting the reply back renders matched names as chips
  that fly to + open that plateau; unmatched lines are surfaced, never invented.
- **AC5 — Clean lifecycle.** Opening a different topic re-applies that topic's marks and hides the
  action row (no stale sentence carried over); the row is hidden in the bridge/connection view; links
  inside the body keep their own behavior; drag-selection (the rhizome grow menu) is unaffected —
  marking is plain click only.
- **AC6 — Pure + additive + tested + model-free at the edge.** `rabbit-hole.js` (`sentenceChunks`,
  `explainSlowlyPrompt`, `missingForPrompt`) is pure/deterministic with `node --test`; `apps/web`
  only; no core/Rust/wasm change; no new dependency; all generation rides the hand-off.

## 4. Constraints & non-goals

- **Marks are private** — a confusion is personal study state, like the notepad; localStorage only.
- **Segmentation is prose-level** — headings are left whole (they're titles); inline elements
  (bold/code/KaTeX) ride the sentence they're in; a sentence boundary inside a bold span doesn't split.
- **Non-goals (follow-ups):** the same marking inside the R-0060 lesson's summary step (it renders
  the same notes — one call away, deferred to keep this diff tight); a "my confusions" overview
  across topics; auto-suggesting the prereq without the hand-off round-trip; sharing marks.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Segment BEFORE typesetMath, with a math-atomic splitter | KaTeX replaces `$…$` text with elements; splitting a delimiter pair across spans would kill the render. Pre-typeset segmentation + `$`-aware chunking makes math unbreakable by construction. |
| 2026-07-16 | Key marks on the pre-typeset canonical text (`dataset.rh`) | KaTeX rewrites visible textContent; the canonical text is stable across renders, so persistence survives typesetting and reopening. |
| 2026-07-16 | Reuse matchTopics for the "what am I missing" paste-back | The hidden-prereq answer is the same shape as R-0069's routing answer — exact names → real plateaus; one matcher, two doors. |
| 2026-07-16 | Tap = mark + actions; tap again = clear | The mark IS the interaction — no separate mode or toolbar; "it clicked now" is one tap. |

## Changelog

- 2026-07-16 created (Accepted) + implemented — tappable sentence marks with persisted amber
  highlights, the 🐇 slow-explanation and 🧩 hidden-prereq hand-offs, and paste-back doors onto
  missing plateaus. Pure `rabbit-hole.js` with 6 `node --test` cases (full suite 519/519).
  Live-verified on *The Geometric Product*: 6 sentences segmented with all KaTeX intact inside the
  spans and zero raw `$…$` leaks; tapped the "Everything downstream…" sentence → mark + actions row;
  pasted "Bivectors: Oriented Planes" + a "missing:" line → one door chip + "Not on the map: …";
  the door flew to Bivectors; returning to the topic re-applied the mark; no console errors.
