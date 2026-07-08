# R-0048 — Deep study: the NotebookLM prompt patterns, graph-grounded

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-07-08
- **Depends on:** R-0023 (plateau study view + companion grounding — the send path), R-0007
  (bring-your-own model), R-0026 (offline digest fallback), R-0030 (mastery data the gap map
  reads), R-0039 (the followed path the gap map references), R-0013 (bridges — the neighbour
  context the deep quiz crosses).
- **Realized by:** direct implementation (`study-prompts.js` + drawer wiring; design folded here —
  the verbs are pure prompt builders over existing seams, no new architecture)
- **QA:** `qa` agent run scoped to this requirement
- **Source:** the owner's collected "Prompts NotebookLM" study patterns (how MIT students study
  with NotebookLM), adapted from "all the sources in this notebook" to the graph.

## 1. Statement

The Study drawer offers a **Deep study** row of seven verbs that turn the companion from a
question-answerer into a study *method*, each adapted from the owner's NotebookLM prompt
collection — and each grounded in something the graph genuinely has, which NotebookLM does not:

| Verb | NotebookLM pattern | Graph grounding |
|---|---|---|
| Mental models | across all notebook sources | across ALL topics of the plateau's **domain** |
| Disagreements | experts disagree across sources | across THIS plateau's **pinned resources** |
| Deep quiz | 10 reasoning-not-recall questions | must cross the plateau's **bridges** (named neighbours) |
| Hidden connections | overlaps/tensions/meta-model | over the bridged neighbours; proposes **new bridges** |
| Gap map | inferred from the chat | the REAL **mastered/studying sets** + the followed path's next step |
| Feynman: I explain | learner explains, model grades 1–10 | template prefilled with the topic; learner's own words |
| Grade my answer | evaluate my quiz answer | template with reread pointers into pinned resources |

## 2. Rationale

The owner shared the prompt file asking to "connect it to our plateau … to learn any topic".
The patterns' power is bounding the model to a source set and demanding synthesis across it; the
graph strengthens every one of them: domains bound better than notebooks, bridges make
"connections across sources" literal edges, and the gap map stops guessing — mastery is recorded,
signed data.

## 3. Acceptance criteria

- **AC1 — Seven verbs in the drawer.** An open plateau shows the Deep study row (Mental models,
  Disagreements, Deep quiz, Hidden connections, Gap map, Feynman: I explain, Grade my answer).
- **AC2 — Scoped grounding.** Mental models/Gap map read the plateau's whole domain (bodies
  capped per topic); Deep quiz/Hidden connections carry the bridged neighbours with bridge
  concepts; Disagreements rides the standard plateau grounding (its resources).
- **AC3 — Real-progress gap map.** The gap map prompt embeds each domain topic's actual status
  (mastered / studying / untouched) and the followed path's title + next unmastered step — never
  self-report.
- **AC4 — Templates for the learner's words.** Feynman and Grade-my-answer PREFILL the companion
  input with a placeholder template naming the topic; the learner completes and sends — their
  explanation is the payload, never auto-generated.
- **AC5 — Same trust boundary.** Everything rides the existing companion path (visitor's own
  endpoint/key, R-0007 AC5); offline (no model), one-click verbs fall back to the honest R-0026
  digest and templates still prefill.
- **AC6 — Pure + tested.** The prompt builders are a pure module (`study-prompts.js`), covered by
  unit tests (inputs embedded, bodies capped, each verb's defining instruction present); glue in
  main.js only gathers context. Existing suites stay green.

## 4. Constraints & non-goals

Non-goals (follow-ups): the report/slides/podcast output formats from the same prompt file;
auto-creating the bridges "Hidden connections" proposes (learner drafts them via R-0013);
feeding a high Feynman grade into R-0030 mastery automatically (the learner still self-attests
or uses Prove-it/Solve-it); per-verb quiz-history memory.

## 5. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Domain = the "notebook" for cross-source verbs | The lens is the natural source boundary; bodies capped at 700 chars/topic keep whole-domain prompts token-sane |
| 2026-07-08 | Templates prefill the companion input | The Feynman method requires the LEARNER's words; prefill + placeholder beats a second input widget |
| 2026-07-08 | Gap map reads mastery records, not chat | The app's core advantage over NotebookLM — grounded, signed progress |

## Changelog

- 2026-07-08 created (Accepted) + implemented — seven graph-grounded deep-study verbs from the
  owner's NotebookLM prompt collection; verified live (drawer renders, verbs fire, offline digest
  falls back, Feynman prefills with the topic name).
