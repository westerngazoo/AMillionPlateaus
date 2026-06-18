# R-0032 — Math mastery by AI-checked proof (write a proof, the model judges it)

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-18
- **Depends on:** R-0030 (the mastery sign — `signMastery`/`KIND_MASTERY`), R-0007 (the bring-your-own model + `sendTurn`), R-0023 (the plateau-scoped grounding), R-0020 (vendored KaTeX typesetting), R-0026 (the offline self-attest path this complements)
- **Realized by:** SPEC-0032
- **QA:** `qa` agent — PASS on AC1–AC8 (2026-06-18)

## 1. Statement

For a maths topic, "I can answer these" is a weak gate — you want to **write a
proof and have it checked**. This requirement adds a **"Prove it"** mastery path
(available when a model is connected): a **LaTeX proof input** — a textarea with a
**live KaTeX preview** (R-0020) and a **symbol palette** (∀ ∃ ∫ ∑ √ ≤ ∈ ⇒ `\frac`
`\lim` …) — where you write a proof/explanation of the topic. Submitting sends it,
with the topic's notes, through your **bring-your-own model** (R-0007), which
returns **feedback + a verdict**. On **PASS** it signs the same **mastery event**
(R-0030 — so it flows into ✓ and the community count, R-0031); on **REVISE** it
shows the critique and you revise. **The model is a judge, not a verifier** — a
strong tutor's opinion, not a formal guarantee — and the UI says so. Offline (no
model) the existing self-attest "Mark as mastered" (R-0030) is unchanged.

## 2. Rationale

The owner asked: "for math … some sort of AI checked? LaTeX keyboard to write
proofs." Every piece exists — KaTeX renders math (R-0020), the BYO model answers
grounded turns (R-0007/R-0023), and `signMastery` records a verifiable mastery
(R-0030). So this is a **JS-only composition**: a LaTeX input widget + a grading
turn + a verdict parse wired to the existing mastery sign. It strengthens the
mastery gate for those who connect a model, **without** changing the offline
floor (R-0026 self-attest) or the core. The honesty boundary is non-negotiable:
an LLM cannot *verify* a proof (formal verification = Lean/Coq, out of scope), so
"AI-checked mastery" is framed as the model's judgment, consistent with the
project's earned-not-authoritative trust model.

## 3. Acceptance criteria

- **AC1 — LaTeX proof input.** When a model is connected, the plateau Study view
  offers **"Prove it"**, opening a proof **textarea** with a **live KaTeX preview**
  (reusing the R-0020 safe renderer + typesetter — `$…$` renders as you type) and
  a **symbol palette** that inserts common LaTeX at the cursor.

- **AC2 — Grading turn.** Submitting sends a **grading turn** through `sendTurn`
  (R-0007): the topic's grounding (R-0023 `buildPlateauStudyContext`) + a
  "demonstrate/prove your understanding of THIS topic" instruction + the learner's
  proof. The model is asked for brief feedback then **exactly one verdict line**
  (`VERDICT: PASS` / `VERDICT: REVISE`).

- **AC3 — Verdict gates the sign.** A **PASS** verdict signs the **R-0030 mastery
  event** (the same `signMastery` → ✓ + community count); a **REVISE** shows the
  feedback and lets the learner revise & resubmit. **Nothing is signed without a
  parsed PASS** — an unparseable/absent verdict is treated as REVISE (fail-safe,
  never auto-pass).

- **AC4 — Model-required, graceful.** "Prove it" appears **only when a model is
  connected** (`modelConfig.kind !== "fake"`); **offline**, the R-0030 self-attest
  "Mark as mastered" is the path, unchanged. A model error/timeout shows
  gracefully (R-0007 AC4) and **signs nothing**.

- **AC5 — Honest boundary.** The UI states the AI **judges** the proof (a tutor's
  feedback + opinion), **not a formal verifier**; mastery-by-proof means "the
  model judged you can prove it." No copy implies rigor/verification.

- **AC6 — Pure + tested.** `parseVerdict(reply) → { pass, feedback }` is a **pure**
  function — **unit-tested**: PASS/REVISE tokens (case/whitespace-insensitive),
  the verdict line stripped from `feedback`, absent/ambiguous → `pass: false`
  (fail-safe), deterministic. The grading-prompt builder is pure + tested (embeds
  grounding + proof, bounded length, the verdict instruction present).

- **AC7 — Additive, JS-only, safe.** Reuses `signMastery` (R-0030), `sendTurn`
  (R-0007), KaTeX (R-0020), the R-0023 grounding. **No Rust/wasm/CRDT/reputation
  change**; the mastery event content is unchanged (the proof is **ephemeral** —
  graded, not stored — this phase). The proof + preview render via the existing
  **safe** renderer (no innerHTML injection — the learner's LaTeX/markdown is
  sanitised exactly like a plateau body). Existing suites stay green.

- **AC8 — Green + browser-verified.** All suites green; in the browser, with a
  model connected (a mocked grading reply), opening a topic → "Prove it" → write a
  proof (preview renders, palette inserts) → submit → a **PASS** reply signs
  mastery (✓ appears), a **REVISE** reply shows feedback and signs nothing — no
  uncaught console errors; offline the self-attest path is unaffected.

## 4. Constraints & non-goals

- **Judge, not verifier.** No formal proof checking; the model's verdict is an
  opinion that gates the (revocable-by-reset) mastery claim.
- **Compose, don't extend the core.** Reuse the mastery sign + model client +
  KaTeX; no new event kind, no Rust, no CRDT field.
- **Non-goals:** **CAS-checked** computational answers (the deferred rigorous rung
  for "solve this", not "prove this"); a formal proof assistant (Lean/Coq);
  **persisting/sharing the proof** (ephemeral this phase — storing it in the
  mastery event is a later, privacy-considered step); per-step proof checking;
  changing the offline digest or the self-attest gate.

## 5. Open questions

- **Verdict protocol.** A final `VERDICT: PASS|REVISE` line (lean: simple,
  parseable, fail-safe) vs. structured JSON (brittle across models). Spec fixes
  the line form + the fail-safe.
- **One path or two when a model is connected.** Offer **both** self-attest and
  "Prove it", or make "Prove it" the gate when a model is present. Lean: offer
  both (self-attest stays the quick path; "Prove it" is the rigorous opt-in).
- **Symbol palette set.** A small, fixed common set vs. configurable. Lean: a
  fixed POC set; spec lists it.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-18 | AI **judges** (feedback + PASS/REVISE), gates the R-0030 mastery sign | Matches the owner's "AI checked"; honest (not a verifier); reuses the existing mastery layer |
| 2026-06-18 | Model-required; offline keeps R-0030 self-attest | Free-text proof grading needs a model; the offline floor (R-0026) must stay |
| 2026-06-18 | Proof is ephemeral (not in the event) this phase | No event-shape/Rust change; sharing a proof is a separate privacy-considered step |
| 2026-06-18 | Unparseable/absent verdict ⇒ REVISE (never auto-pass) | Fail-safe: a flaky model reply must not silently grant mastery |

## Changelog

- 2026-06-18 created (Accepted) — the owner's "LaTeX keyboard + AI-checked proof"
  as a "Prove it" mastery path over R-0030/R-0007/R-0020. Pending SPEC-0032 +
  architect review.
