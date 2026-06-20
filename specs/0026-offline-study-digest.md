# SPEC-0026 — Offline study digest (pure local digest behind the study actions)

- **Status:** Implemented
- **Realizes:** R-0026
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-14
- **Depends on:** SPEC-0023 (Study view: `study.js` `rankResources`/`buildPlateauStudyContext`/`STUDY_ACTIONS`, the `studyAction` handler), SPEC-0007 (companion + the `fake` provider)
- **Module(s):** NEW `apps/web/src/offline-digest.js` + `offline-digest.test.mjs` (pure); `apps/web/src/main.js` (route `studyAction` to the digest when offline). **No Rust/wasm/CRDT/GA. JS-only, additive.**

## 1. Motivation

R-0026: offline, the study actions echo (`companion.js` `fake` branch). The
grounded context (`buildPlateauStudyContext`) and the ranked resources already
exist; this adds a **pure** local digest that turns them into a real answer for
each of the four actions, with no model and no network.

## 2. Design

### 2.1 `offline-digest.js` — pure (no DOM/network/LLM/GA)

```js
import { rankResources } from "./study.js"; // one ranking everywhere (R-0023/R-0015)

const STOP = new Set("the a an and or but of to in on for with is are was were be ...".split(" "));
const SENTS = 3;   // Summarize: salient sentences
const QUIZ = 3;    // Quiz me: questions
const TERMS = 6;   // Mental model: key terms

// Markdown → plain text: drop code fences (``` blocks), heading hashes, list/
// quote markers, link syntax (keep the text), emphasis markers. Inline math
// `$…$` and inline `code` substrings PASS THROUGH VERBATIM (they are body text,
// not invented). Pure string transforms; `toLowerCase()` only — NEVER
// `toLocaleLowerCase`/`localeCompare`/locale-sensitive sorts anywhere in this
// module (AC4 cross-env determinism).
export function plainText(md = "") { /* … */ }

// Split into trimmed, non-empty sentences: a boundary is `[.!?]` FOLLOWED BY
// whitespace/EOL (so `1.5` and `$x^2$` don't split mid-token); math/code
// substrings ride along inside their sentence. Emits WHOLE sentences verbatim —
// never synthesized text (AC2 honesty).
export function sentences(text = "") { /* … */ }

// "# Heading" / "## Heading" lines → their titles, in document order.
export function headings(md = "") { /* … */ }

// Content words (len ≥ 3) minus STOP, lowercased via toLowerCase(). Counts are
// accumulated in a FIRST-SEEN-ORDERED Map; the top n are chosen with an explicit
// tiebreak `(a,b) => freq[b]-freq[a] || firstSeenIdx[a]-firstSeenIdx[b]` (same
// shape as rankResources' id tiebreak) — no reliance on implicit key order.
export function keyTerms(text = "", n = TERMS) { /* … */ }

// Extractive summary. Score each sentence = leadBias(index) + keyTermDensity
// (count of keyTerms(text) it contains / its word count). SELECT the top n by
// `(a,b) => score[b]-score[a] || idx[a]-idx[b]`, then REORDER the selected set
// back into original document order. Whole sentences only, verbatim.
export function topSentences(body = "", n = SENTS) { /* … */ }

// The four actions. Each returns a plain string and handles the empty case
// honestly (AC2) — output is only body substrings / resource metadata / fixed
// non-factual scaffolding; NEVER an asserted fact.
//  doSummary(body):      topSentences(body), else "The notes here are thin — add
//                        a few sentences, or connect a model for a richer answer."
//  doMentalModel(body):  headings(body) as a skeleton list; else the keyTerms as
//                        "key ideas"; else the thin-notes line.
//  doReading(resources): rankResources(resources).slice(0,8), each rendered with
//                        the SAME line shape as buildPlateauStudyContext —
//                        `- ${kind}: ${title}` + (uri?` (${uri})`:"") +
//                        (state==="Crystallized"?" [vouched]":""); empty → "No
//                        resources pinned yet — an Article or Video would be a
//                        good first stone."
//  doQuiz(body):         up to QUIZ questions from FIXED templates that
//                        interpolate ONLY body-derived terms/sentence fragments,
//                        e.g. `Can you explain "${term}" in your own words?` and
//                        `What is the key idea behind: "${sentenceFragment}"?` —
//                        the scaffold asserts nothing; empty body → thin-notes line.

const HEADER =
  "Offline digest (no model connected — connect one in “Model setup” for a richer answer):";

// action: one of "summary" | "model" | "first" | "quiz" (STUDY_ACTIONS keys).
export function offlineDigest({ action, plateau, resources = [] } = {}) {
  const body = plateau?.description ?? "";
  const name = plateau?.name ?? "this topic";
  const make = { summary: () => doSummary(body), model: () => doMentalModel(body),
                 first: () => doReading(resources), quiz: () => doQuiz(body) };
  const fn = make[action] ?? make.summary;
  return `${HEADER}\n\n${fn()}`;
}
```

- **Honesty (AC2):** `doSummary`/`doMentalModel`/`doQuiz` return a "the notes
  here are thin — add a few sentences (or connect a model)" line when the body
  yields nothing; `doReading` suggests a kind ("no resources pinned yet — an
  Article or Video would be a good first stone") when `resources` is empty.
- **Determinism (AC4):** every sort carries an explicit total-order tiebreak
  (key-term: freq then first-seen index; sentence: score then original index;
  `rankResources`: votes then id); counts live in first-seen-ordered `Map`s; only
  `toLowerCase()` + plain `<`/`>` (no locale ops). No `Date`/`Math.random`. Two
  calls on the same input return byte-identical strings.

### 2.2 `main.js` — route the study action when offline

`studyAction` already holds `studyPlateau` + the filtered `rs` resources. Change
it to take the **action object** (so it has the `key`), and branch on the
provider:

```js
function studyAction(action) {                       // was (prompt)
  if (!studyPlateau || !activePersona) return;
  const rs = doc.to_graph().resources().filter((r) => r.plateau_id === studyPlateau.id);
  companion.hidden = false;
  appendMessage("user", action.prompt);
  if (modelConfig.kind === "fake") {                 // OFFLINE → pure digest, no await
    const reply = offlineDigest({ action: action.key, plateau: studyPlateau, resources: rs });
    appendMessage("bot", reply);
    history.push({ role: "user", content: action.prompt }, { role: "assistant", content: reply });
    return;
  }
  const grounding = buildPlateauStudyContext({ plateau: studyPlateau, resources: rs });
  const messages = assembleMessages(voiceFor(activePersona), grounding, history, action.prompt);
  sendTurn(modelConfig, messages).then(/* … unchanged … */).catch(/* … unchanged … */);
}
// button wiring: () => studyAction(a)   // was studyAction(a.prompt)
```

`appendMessage` renders via `textContent` (existing), so the digest is **text**,
never innerHTML — no new injection surface (AC5). The connected-model branch is
byte-for-byte the prior behaviour.

## 3. Code outline

- NEW `apps/web/src/offline-digest.js` (~70 lines pure) — exports above.
- NEW `apps/web/src/offline-digest.test.mjs` — `plainText` strips markdown but
  keeps `$…$`/inline-code verbatim; `sentences` does **not** split `1.5` or a
  `$x^2$` mid-token and returns whole verbatim sentences (a math-body test);
  `topSentences` selects then reorders to original order + caps; `headings`/
  `keyTerms` deterministic with explicit tiebreak; `doReading` best-first +
  `[vouched]`⇔`Crystallized` + the empty-suggestion; each `quiz` question
  contains a body-derived key term and no text outside the fixed template +
  body substrings; empty-body honesty for each action; `offlineDigest`
  dispatches the four keys distinctly + always prefixes the header; two calls on
  the same input are byte-identical.
- `apps/web/src/main.js` — `import { offlineDigest } from "./offline-digest.js"`;
  `studyAction(action)` offline branch + button wiring (two-line change).

## 4. Non-goals

Per R-0026 §4: not an LLM (extractive only); no network/resource-fetch; scope is
the four study actions (free-chat offline reply unchanged); no change to
`STUDY_ACTIONS`, grounding, providers, or the connected-model path.

## 5. Open questions (resolved here)

- Constants: `SENTS = 3`, `QUIZ = 3`, `TERMS = 6`. §2.1.
- Key terms = stopword-filtered frequency, first-seen tiebreak (pure, tiny). §2.1.
- Offline branch lives in `studyAction` (it holds the plateau + resources),
  not `companion.js`. §2.2.

## 6. Acceptance criteria

Maps to R-0026 AC:

- [ ] AC1 — offline, each action returns a real digest (not the echo), prefixed
      with the "connect a model" header. *(test: `offlineDigest` per key ≠ echo;
      browser: click all four offline.)*
- [ ] AC2 — grounded/honest: empty body → "thin notes" line; no resources →
      kind suggestion; never invents. *(unit tests for empty cases.)*
- [ ] AC3 — per-action: summary=salient sentences; model=headings/key terms;
      first=stone-ranked + `[vouched]`; quiz=recall questions. *(unit tests.)*
- [ ] AC4 — pure + deterministic, no DOM/network/LLM/GA; reuses `rankResources`.
      *(node `--test`.)*
- [ ] AC5 — connected-model `sendTurn` path unchanged; text-only render; no
      Rust/CRDT/GA change; existing suites green. *(diff scope + full suite.)*
- [ ] AC6 — browser-verified offline on the imported vault; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-14 | Pure `offline-digest.js`, imported by `main.js`; reuse `study.js` `rankResources` | Mirrors `study.js`/`labels.js` (pure + node-tested); one ranking everywhere |
| 2026-06-14 | Route the offline branch in `studyAction`, dispatch by action `key` | `studyAction` holds the plateau + resources; `companion.js` only sees assembled messages |
| 2026-06-14 | Extractive heuristics (lead-bias + key-term density), fixed small constants | Honest, deterministic, testable; the digest names itself "offline" and points to a model |
| 2026-06-14 | Pinned all sorts to explicit total-order tiebreaks + first-seen `Map`s; no locale ops | Architect finding 1/2 — guarantees the AC4 cross-env determinism the tests assert |
| 2026-06-14 | `sentences` boundary = `[.!?]`+whitespace/EOL; `$…$`/code ride verbatim; quiz uses fixed body-only templates | Architect finding 4/5 — extractive output stays whole + honest, never mangles math or fabricates a fact |

## Changelog

- 2026-06-14 created (Draft) — pure offline digest behind the four study actions;
  `main.js` routes to it when the provider is `fake`. Pending architect review,
  then `Accepted`.
- 2026-06-14 architect design review: **APPROVE-WITH-NITS** (integration claims
  verified against the code — `appendMessage` is textContent, `study.js` exports
  `rankResources` with no cycle, `plateau.description` is the body, `fake` is the
  offline provider). Folded all four must-fixes: pinned the `keyTerms`/
  `topSentences` tiebreaks + select-then-reorder; pinned the `sentences` splitter
  + `$…$`/code-verbatim with a math-body test; pinned the `doQuiz` fixed
  body-only templates; stated the no-locale-ops constraint + the `doReading` line
  shape/`[vouched]`/cap. **Status → Accepted.**
- 2026-06-14 implemented + browser-verified. `offline-digest.js` (pure, all
  helpers as specced) + `offline-digest.test.mjs` (10 tests); `main.js`
  `studyAction(action)` offline branch routes to `offlineDigest` before
  `sendTurn`. 184 JS tests pass; `cargo test`/clippy/fmt green & unchanged (no
  Rust diff). Browser: in-page dynamic import produced rich digests (summary with
  `$2x$` intact, stone-ranked reading + `[vouched]`, quiz from body terms);
  real-UI e2e (Geometer → opened "Algebra" → Summarize + What-to-read-first
  buttons) rendered the offline digest in the companion, no echo, console clean.
  QA PASS → R-0026 **Met**. **Status → Implemented.**
