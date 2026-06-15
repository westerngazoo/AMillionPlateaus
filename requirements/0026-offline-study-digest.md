# R-0026 — Offline study digest: the companion helps with no model connected

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-14
- **Depends on:** R-0023 (Study view + `STUDY_ACTIONS` + `buildPlateauStudyContext`), R-0015 (votes/stones → resource ranking), R-0007 (the bring-your-own companion + the offline `fake` provider this replaces for study actions)
- **Realized by:** SPEC-0026
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Out of the box, with **no model connected** (the default offline `fake`
provider), the Study companion **echoes**: clicking a study action returns
`I hear you: "…". Configure a model to go deeper.` — useless for actually
studying. Connecting a local/remote model is already supported (R-0007), but
that is a *config* step the visitor may not take, so the zero-config experience
is dead. This requirement makes the four study actions — **Summarize**, **Mental
model**, **What to read first**, **Quiz me** — return a **real, useful answer
with no model at all**, computed **locally** from the plateau's own notes +
ranked resources by simple text heuristics (extractive summary, structure
extraction, stone-ranked reading order, recall questions). It is the honest
offline floor: the companion helps immediately, and connecting a model upgrades
the same actions to a full LLM answer.

## 2. Rationale

The Study view (R-0023) already assembles a grounded, plateau-scoped context
(name + capped body + best-first resources) — but offline that context is thrown
at an echo. Everything needed for a genuinely useful answer is already in hand:
the body text and the stone-ranked resources. A small, **pure** text layer turns
that into a real digest with **no network and no LLM**, which fits the project's
offline-first, decentralized spine exactly. It is the smallest change that makes
the headline "travel there and study" loop deliver value on first run, before any
setup, and it is **additive, JS-only** — no GA/CRDT/Rust, and the connected-model
path is untouched.

## 3. Acceptance criteria

- **AC1 — Real answer, not an echo (offline).** With the `fake`/offline provider
  active, each of the four study actions returns a substantive answer derived
  from the plateau's notes/resources — **never** the `I hear you …` echo. The
  reply is clearly marked as an **offline digest** and invites connecting a model
  for a richer answer.

- **AC2 — Grounded and honest.** The digest uses **only** the plateau body and
  its pinned resources — it never invents facts or resources. When the notes are
  empty/thin it says so and suggests what to add (mirroring R-0023's grounding
  rule), rather than fabricating.

- **AC3 — Per-action behaviour.** **Summarize** → the most salient sentences of
  the body, in original order. **Mental model** → the topic's structure (its
  headings / key ideas). **What to read first** → resources **stone-ranked**
  best-first (crystallized/vouched marked), or a suggestion of what kind to add
  if none. **Quiz me** → a few short recall questions generated from the notes.

- **AC4 — Pure and tested.** The digest is a **pure** module —
  `offlineDigest({ action, plateau, resources }) → string` plus its helpers
  (sentence ranking, heading/key-term extraction, quiz generation) — **no DOM,
  network, LLM, or GA**, deterministic, and unit-tested. Resource ranking reuses
  the existing `rankResources` (one ranking, R-0023/R-0015).

- **AC5 — Additive; connected model untouched.** When a real model **is**
  configured, the existing `sendTurn` path runs unchanged (full LLM answer). No
  Rust/wasm/CRDT/GA/identity change; no new injection surface (the digest is
  rendered as **text**, never innerHTML); free-chat (non-study) offline replies
  are out of scope and unchanged. Existing suites stay green.

- **AC6 — Green + browser-verified.** All suites green; in the browser, offline
  (no model), opening a real plateau and clicking each study action shows a
  grounded digest (not the echo), with no uncaught console errors.

## 4. Constraints & non-goals

- **Heuristics, not an LLM.** This is an honest extractive floor, not a language
  model; it does not paraphrase or reason. A connected model remains the way to
  get a generative answer — the digest explicitly says so.
- **No network.** It never fetches resource/page/transcript content (same
  boundary as R-0023); it works only from the local body + resource metadata.
- **Scope = the four study actions.** The general free-chat companion's offline
  reply (no grounded plateau context) is **not** in scope and keeps its current
  behaviour.
- **Non-goals:** multilingual tuning (English-leaning stopwords/sentence split
  are acceptable v1); embeddings/RAG; persistent transcripts; changing
  `STUDY_ACTIONS`, the grounding, or the connected-model providers.

## 5. Open questions

- **Digest length / sentence count.** 3 salient sentences for Summarize, 3 quiz
  questions — spec fixes the small constants.
- **Key-term extraction.** Plain stopword-filtered frequency vs. a lightweight
  TF-style weighting. Leans: frequency minus a small stopword set (pure, tiny).
  Spec decides.
- **Where the offline branch lives.** In `studyAction` (main.js) routing to the
  pure module when offline, vs. inside `companion.js`. Leans: route in
  `studyAction` (it already holds the plateau + resources; `companion.js` does
  not). Spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-14 | Build an offline extractive digest rather than treat "connect a model" as the only path | The zero-config experience must be useful; everything needed (body + ranked resources) is already in hand; pure + offline-first |
| 2026-06-14 | Scope to the four study actions, not free-chat | Study actions have grounded context to digest; free-chat does not — echoing there is acceptable |
| 2026-06-14 | Reuse `rankResources` (R-0023) for "what to read first" | One ranking everywhere; the reading order matches the visible resource list |

## QA sign-off

## QA — R-0026 Offline study digest: the companion helps with no model connected

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) | Result |
|----|---------|--------|
| AC1 — real answer, not an echo | `offlineDigest 'first' … prefixes the header`; `'quiz' …`; `dispatches the four keys distinctly` (all start with the offline header, none contain `I hear you`); echo string exists only in `companion.js` (the `sendTurn` path); `main.js` routes the `modelConfig.kind === "fake"` branch to `offlineDigest` and `return`s before `sendTurn`, for the four study buttons only (free-chat `send` untouched) | PASS |
| AC2 — grounded and honest | `plainText … keeps $…$ and inline-code verbatim`; `sentences does not split decimals or $…$ mid-token; whole verbatim sentences`; `'quiz' … only interpolate body-derived terms`; `empty notes are handled honestly per action`; `'first' suggests a kind when no resources`. Adversarial run confirmed `$f(x)=x^2$`/`$2x$` ride verbatim, `1.5` not split, math symbols do not leak as key terms, empty body → "notes here are thin", empty resources → "Article or Video" | PASS |
| AC3 — per-action behaviour | summary=`topSentences` salient sentences (`topSentences selects … original order, capped`); model=`headings` else `keyTerms` (`headings returns titles in order`, `keyTerms is frequency-ranked …`); first=`rankResources` best-first + `[vouched]`⇔`Crystallized` + 8-cap (`'first' ranks by stones, marks [vouched]`); quiz=recall questions (`'quiz' …`) | PASS |
| AC4 — pure + deterministic | `node --test` 184 pass; module imports only `rankResources` from `study.js` — no DOM/network/LLM/GA; grep clean of `localeCompare`/`toLocale`/`Math.random`/`Date`/`innerHTML`/`fetch`/`document`/`window`; every `.sort` carries a total-order tiebreak (key-term freq then first-seen idx; sentence score then idx; resource votes then id); counts in first-seen-ordered `Map`s; `dispatches … and is deterministic` plus adversarial run prove two calls byte-identical for all four actions; tie cases (`zebra/apple/mango`, `aaa`<`zzz`) resolve deterministically | PASS |
| AC5 — additive; connected model untouched | `git diff --stat` shows only `apps/web/src/main.js` (+15/-6) plus the two new `apps/web/src/offline-digest.{js,test.mjs}`; no `crates/` diff; `sendTurn` branch + `history.push` shape preserved byte-for-byte; digest rendered via `appendMessage` → `textContent` (main.js:478), no innerHTML; all prior web suites green | PASS |
| AC6 — green + browser-verified | All suites green (184 web + 117 Rust). Implementer's browser evidence accepted as the manual portion: app loads clean after the new import; in-browser dynamic import produced header-prefixed digests with `$2x$`/`$f(x)=x^2$` intact, stone-ranked reading with `[vouched]`, quiz from body terms, no echo; real-UI e2e (The Geometer → lit "Algebra" plateau → Summarize + What to read first) rendered the digest in `#companion-log` with `digestPresent:true`/`echoPresent:false` and a clean console | PASS |

### Suites

- **test (web, `node --test apps/web/src/*.test.mjs`):** PASS — 184 pass / 0 fail (174 prior + 10 new in `offline-digest.test.mjs`).
- **test (Rust, `cargo test --workspace`):** PASS — 117 passed / 0 failed across all crates; unchanged (no `crates/` diff).
- **lint (`cargo clippy --workspace --all-targets -- -D warnings`):** PASS — clean (exit 0).
- **format (`cargo fmt --all --check`):** PASS — clean (exit 0).
- **e2e (offline digest, browser):** PASS — accepted via implementer-recorded browser evidence (AC6 manual portion).

### Gaps / failures

None. Minor non-gating note: `keyTerms` admits the 3-letter word `let` (not in the stop set), so a math-heavy body can surface `let` as a "key idea" — a relevance nit, not a correctness or honesty issue (still a verbatim body word, never a fabricated fact). No coverage gap; no tests added.

## Changelog

- 2026-06-14 QA sign-off — **Status → Met.** All six acceptance criteria covered
  by passing tests + accepted browser evidence. Web `node --test` 184 pass (174 +
  10 new); `cargo test --workspace` 117 pass unchanged (no `crates/` diff); clippy
  + fmt clean. Diff is additive, `apps/web` only; connected-model `sendTurn` path
  and `history.push` shape preserved; digest rendered as `textContent` (no
  injection surface). Adversarially confirmed math/decimal-safe sentence
  splitting, body-only quiz interpolation, honest empty-case fallbacks, and
  byte-identical determinism with total-order tiebreaks.
- 2026-06-14 created (Accepted) — the offline floor for the Study companion so it
  helps on first run instead of echoing; composes R-0023's grounding with a pure
  local digest. Pending SPEC-0026 + architect review.
