# R-0034 — CAS-checked answers (solve it, the machine verifies it)

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-20
- **Depends on:** R-0030 (the mastery sign — `signMastery`/`KIND_MASTERY`), R-0020 (vendored KaTeX typesetting + the safe renderer), R-0023 (the plateau Study view), R-0032 (the "Prove it" path this complements), R-0026 (the offline floor this strengthens), R-0027 (the seeded-content pattern for author/seed problems)
- **Realized by:** SPEC-0034
- **QA:** `qa` agent — PASS on AC1–AC9 (2026-06-20)

## 1. Statement

R-0032 added a **"Prove it"** path where a model **judges** a free-text proof — a
strong tutor's *opinion*. For **computational** maths ("solve this", not "prove
this") we can do better than opinion: a **Computer Algebra System can verify the
answer deterministically**. This requirement adds a **"Solve it"** mastery path: a
**LaTeX answer input** (reusing the R-0020 KaTeX preview + the R-0032 symbol
palette) where the learner answers a quantitative problem, and a **vendored,
offline CAS/equivalence engine checks the answer** — `correct` / `not yet`, with
specific feedback. A **correct** answer signs the **same mastery event** (R-0030 →
✓ and the community count, R-0031). Crucially, because the check is **deterministic
and runs in the browser, this rung needs no model** — it joins the offline floor
(R-0026 digest, R-0030 self-attest) as the *rigorous* offline rung.

Problems come from **two sources** (owner decision):

1. **App-generated drills.** A quantitative plateau offers generated problems
   (e.g. *differentiate*, *integrate*, *simplify*, *evaluate* a freshly-generated
   expression). The engine computes the reference **independently** and checks the
   learner's answer for **equivalence** — infinite practice, zero authoring.
2. **Author-attached challenges.** A plateau author may attach a specific problem
   (a prompt + a checkable reference answer/condition) to a topic; the same engine
   checks the learner's submission against it.

Either source, the same engine, the same mastery sign.

## 2. Rationale

The owner asked for "some sort of AI checked … for math," which R-0032 answered
with model-judging. The honest gap R-0032 named is rigor: an LLM cannot *verify* a
proof. But a large class of maths is **computational**, where the answer **is**
mechanically checkable — and the project already vendors a math typesetter (R-0020)
and has a mastery sign (R-0030). So this is the **deterministic** sibling of
"Prove it": a CAS/equivalence check wired to the existing mastery layer. It makes
the strongest possible claim the project can honestly make ("the machine verified
your answer is equivalent to the correct one"), and — unlike "Prove it" — it
**works with no model connected**, deepening the offline-first floor with actual
rigor rather than self-attestation.

## 3. Acceptance criteria

- **AC1 — Solve-it input.** On a quantitative plateau the Study view offers
  **"Solve it"**, opening a problem prompt + a LaTeX **answer textarea** with the
  R-0020 **live KaTeX preview** and the R-0032 **symbol palette**. Available
  **offline** (no model required).

- **AC2 — App-generated drills.** "Solve it" can present an **app-generated**
  problem appropriate to the topic (e.g. differentiate / integrate / simplify /
  evaluate a generated expression). The reference answer is computed by the engine
  **independently of the learner's input** (never derived from it). A "new
  problem" control regenerates.

- **AC3 — Author-attached challenges.** A plateau **author** can attach a problem
  (prompt + reference answer/condition) to a topic; "Solve it" then offers that
  problem, checked by the same engine. A topic may have both an author challenge
  and generated drills.

- **AC4 — Deterministic verification.** Submitting checks the learner's answer for
  **mathematical equivalence** to the reference via the vendored CAS/equivalence
  engine — **deterministic, offline, no network, no model**. The check is robust
  to trivial form differences (e.g. `2x` vs `x+x`, ordering, unsimplified forms);
  it is **conservative** — when it cannot establish equivalence it returns **not
  correct** (never a false "correct").

- **AC5 — Verdict gates the sign.** A **correct** answer signs the **R-0030 mastery
  event** (the same `signMastery` → ✓ + community count). A wrong/unparseable
  answer shows specific feedback and signs **nothing**. **Nothing is signed without
  a verified-correct answer.**

- **AC6 — Honest boundary.** The UI frames this as a **deterministic check** of
  *equivalence to the reference answer* — stronger than the R-0032 *judgment*, but
  **not** a claim of full symbolic proof. The engine's known limits (e.g. domain /
  branch-cut caveats, bounded problem types) are not oversold.

- **AC7 — Pure + tested.** The equivalence check and the problem generator are
  **pure** functions (deterministic, no DOM/network) — **unit-tested**: equivalent
  forms accepted, non-equivalent rejected, conservative on the un-decidable,
  generator output is well-formed and its reference is self-consistent.

- **AC8 — Additive, JS-only, safe, core untouched.** Reuses `signMastery`
  (R-0030), KaTeX (R-0020), the Study view (R-0023). **No Rust/wasm/CRDT/reputation
  change**; the mastery event content is unchanged (the problem + answer are
  **ephemeral** — checked, not stored, this phase). The answer + preview render via
  the existing **safe** renderer (no innerHTML injection). The CAS engine is a
  **vendored, offline** dependency used **only** for answer-checking — it never
  touches graph geometry (positions/rotors/reputation stay in **garust**, per
  `CLAUDE.md`). Existing suites stay green.

- **AC9 — Green + browser-verified.** All suites green; in the browser, opening a
  quantitative topic → "Solve it" → a generated problem (and, where present, an
  author challenge) → entering a correct answer (preview renders, palette inserts)
  → submit signs mastery (✓ appears); a wrong answer shows feedback and signs
  nothing; "new problem" regenerates; the path works with **no model connected**;
  no uncaught console errors.

## 4. Constraints & non-goals

- **Verify equivalence, not prove.** The engine checks the learner's answer is
  **equivalent to a reference**; it is **not** a theorem prover and does not check
  derivations/steps. "Solve it" = "your answer matches the correct one," honestly
  framed.
- **Deterministic + offline + model-free.** The check must not call a model or the
  network. (Contrast R-0032's model-judged "Prove it," which requires a model.)
- **Compose, don't extend the core.** Reuse the mastery sign + KaTeX + Study view;
  **no new event kind, no Rust, no CRDT field.** The CAS engine is vendored like
  KaTeX and is scoped to answer-checking only — explicitly **outside** the garust
  graph-geometry boundary.
- **Non-goals:** a full CAS surface or a proof assistant (Lean/Coq); per-step /
  derivation checking; **persisting or sharing** the problem/answer (ephemeral this
  phase — storing it is a later, privacy-considered step); auto-generating problems
  for **every** domain (the POC covers a bounded set of quantitative operations —
  the spec lists them); changing the R-0032 "Prove it" path or the R-0030
  self-attest gate; difficulty/spaced-repetition scheduling.

## 5. Open questions

- **Engine choice.** A vendored symbolic CAS (e.g. mathjs/nerdamer) vs. a small
  **numeric-sampling** equivalence checker (parse + evaluate both expressions at
  several points, compare within tolerance — robust, tiny, sidesteps symbolic
  equality). Spec picks; leaning numeric-sampling for the core with symbolic
  niceties where cheap. Must be **offline + deterministic**.
- **Problem-type set for the POC.** Which generated operations ship (lean:
  differentiate, simplify, evaluate over single-variable polynomials/rationals;
  *solve linear/quadratic* and *integrate* as stretch). Spec fixes the list.
- **Author-challenge shape.** How an attached problem is stored/edited for the POC
  (e.g. a typed resource/marker on the plateau vs. a dedicated field) and how its
  reference is expressed (an expression to match vs. an equation to satisfy). Spec
  fixes the minimal form, reusing existing authoring where possible.
- **Equivalence tolerance & safety.** Sampling count, numeric tolerance, handling
  of undefined points / non-real values — chosen to keep the check **conservative**
  (never a false positive). Spec fixes.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | A deterministic **CAS/equivalence check** (not a model) gates a "Solve it" mastery, wired to the R-0030 sign | The honest *rigorous* rung R-0032 deferred; computational answers are mechanically checkable, so we can claim verification, not opinion |
| 2026-06-20 | **Model-free + offline** | Determinism is the whole point; it also strengthens the offline floor (R-0026/R-0030) with real rigor, complementing R-0032's model-gated "Prove it" |
| 2026-06-20 | **Two problem sources**: app-generated drills **and** author-attached challenges | Owner decision — generated drills give every quantitative topic infinite practice with zero authoring; author challenges let a topic pose a specific problem |
| 2026-06-20 | Problem + answer are **ephemeral** (not in the event) this phase | No event-shape/Rust change; storing them is a separate privacy-considered step (mirrors R-0032) |
| 2026-06-20 | The CAS engine sits **outside** the garust graph-geometry boundary | `CLAUDE.md` forbids non-garust math for **graph geometry**; answer-checking touches no positions/rotors/reputation, so a vendored CAS is permitted and isolated |

## Changelog

- 2026-06-20 created (Accepted) — the deterministic "Solve it" sibling of R-0032's
  "Prove it": a vendored offline CAS/equivalence check over app-generated **and**
  author-attached problems, gating the R-0030 mastery; model-free. Pending
  SPEC-0034 + architect review.
