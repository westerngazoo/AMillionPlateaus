# SPEC-0034 — CAS-checked answers ("Solve it": deterministic equivalence check over generated + authored problems)

- **Status:** Implemented
- **Realizes:** R-0034
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-20
- **Depends on:** SPEC-0030 (`signMastery`/`renderMastery`), SPEC-0020 (vendored-KaTeX `typesetMath` + the safe renderer), SPEC-0023 (the Study view + `buildPlateauStudyContext`), SPEC-0032 (the "Prove it" sibling — proof box patterns, symbol palette)
- **Module(s):** `apps/web/src/cas.js` (NEW, + `cas.test.mjs`) — a **self-contained** pure/deterministic engine (no dependency, no vendoring): a small safe expression parser/evaluator (`parseExpr`, `evalAt`, `numericDerivAt`, `toTeX`), the tested integrity predicates (`isValidSample`/`agree`/`seededPoints`/`agreesOnSamples`), `checkEquivalence`, `generateDrill`, `drillsFor`, `parseChallenges`, `stripChallenges`; `apps/web/src/main.js` — the "Solve it" path in `renderMastery` + grounding strip; `apps/web/index.html` — `#detail-solve` markup + CSS. **No new dependency, no Rust/wasm rebuild, no CRDT/reputation change; mastery content unchanged (problem/answer ephemeral).**

## 1. Motivation

R-0034: the deterministic sibling of R-0032's model-judged "Prove it". Computational
answers are mechanically checkable, so a **vendored, offline CAS** (mathjs, vendored
like KaTeX) verifies the learner's answer is **equivalent to the correct one** and a
correct answer signs the same R-0030 mastery. It needs **no model** — it joins the
offline floor (R-0026/R-0030) as the *rigorous* offline rung. Problems come from two
sources: **app-generated drills** (the engine computes the reference independently) and
**author-attached challenges** (a `solve` fenced block in the plateau body).

### Integrity model (the load-bearing concern)

Unlike "Prove it" — where only the *model's reply* reaches `parseVerdict`, so self-grant
is structurally impossible — in "Solve it" the **learner controls the input and can read
the client-side gate** (`cas.js` ships to the browser). The acceptance bar is therefore:

> **A learner reading `cas.js` must not be able to construct a wrong answer that passes.**

A naive fixed, public sample set fails this: a learner could interpolate / add a bump
(`reference + ε·∏(x−sᵢ)`) that matches at the known points but is globally wrong. The
engine below defeats that with (1) **per-problem seeded sample points** (not globally
predictable), (2) **all jointly-valid points must agree** (no minority-pass), (3) a
**mixed abs+rel tolerance** with strict complex/NaN exclusion, and (4) **value *and*
first-derivative agreement** for non-`evaluate` operations (a vanishing bump has nonzero
slope at the points). The honest framing (AC6) is "verified by numeric checking at many
points," a **strong check, not a symbolic proof** — never oversold.

## 2. Design

### 2.1 Self-contained evaluator — `apps/web/src/cas.js` (no dependency)

The engine is a **small, hand-written, safe expression parser/evaluator in `cas.js`** —
**no mathjs, no vendoring, no network, no bundler**. (A bundled mathjs ESM is *not*
self-contained — it imports `decimal.js`/`typed-function`/`@babel/runtime` by URL — so it
neither resolves under bare `node --test` nor stays offline in the browser; and the project
is offline-first/no-build. We only need numeric evaluation, which is small to own outright,
and owning it gives full control of the eval semantics — a security plus, since nothing the
learner types is ever `eval`/`Function`'d.) It touches **no** graph geometry (garust owns
positions/rotors/reputation, `CLAUDE.md` §1); this is unrelated answer-checking math.

The parser accepts a **bounded grammar** and **rejects everything else** (→ parse error →
conservative false):

- numbers (incl. decimals), the variable (default `x`), constants `pi`/`e`;
- binary `+ - * / ^`, unary `-`, parentheses, **implicit multiplication** (`3x`, `2(x+1)`, `(x+1)(x-1)`);
- a fixed function whitelist: `sin cos tan sqrt exp ln log abs`.

It compiles to a tiny AST and offers (all pure, **synchronous**, real-valued):

```js
export function parseExpr(src, variable = "x") { … } // → AST, or throws on anything off-grammar
export function evalAt(ast, x) { … }                 // → a JS number (NaN/±Infinity for undefined points)
export function numericDerivAt(ast, x, h = 1e-4) {   // central difference — the forgery defense
  return (evalAt(ast, x + h) - evalAt(ast, x - h)) / (2 * h);
}
export function toTeX(ast) { … }                     // small AST → LaTeX, for the live preview only
```

**No symbolic algebra is needed:** equivalence is numeric sampling (§2.2), the
derivative-agreement pass uses `numericDerivAt` (a vanishing-bump forgery has nonzero
numeric slope at the seeded points), and drill references are built **by construction**
from seeded coefficients (§2.2) — never by a symbolic differentiator. `cas.js` is plain
ESM importable directly by `cas.test.mjs` under bare `node --test` (no lazy import, no
vendoring) — and being ~real-only, `evalAt` never returns a Complex, so the only
non-finite cases are `NaN`/`±Infinity` (poles, `sqrt` of a negative, `ln` of ≤0), which
the valid-point filter excludes.

### 2.2 `cas.js` — the integrity predicates (each separately tested)

Constants and the small, individually-tested predicates that ARE the security surface
(all **synchronous** — `cas.js` has no lazy import):

```js
const SAMPLE_COUNT = 16;       // many points → interpolation/bump forgery is impractical
const RANGE = [-3.3, 3.3];     // sampling window
const MIN_VALID = 6;           // floor on JOINTLY-valid points; below ⇒ conservative-false
const TOL = 1e-7;
const DERIV_TOL = 1e-4;        // central-difference derivative is approximate — looser, but a
                               // forgery's slope is O(1) off, far exceeding this (see §integrity)

// A point counts ONLY if BOTH sides are finite real numbers. `evalAt` returns a JS number;
// undefined points (pole, sqrt<0, ln≤0, overflow) are NaN/±Infinity → EXCLUDED from the
// valid set, NEVER treated as agreement.
function isValidSample(a, b) { return Number.isFinite(a) && Number.isFinite(b); }

// Mixed absolute+relative tolerance — robust near zero and at large magnitude.
function agree(a, b, tol = TOL) { return Math.abs(a - b) <= tol * (1 + Math.max(Math.abs(a), Math.abs(b))); }

// Deterministic, PER-PROBLEM sample points: seed = hash(reference source string),
// mulberry32 → SAMPLE_COUNT points in RANGE, skipping any within 1e-3 of an integer
// (dodges the common poles). Points depend on the problem, so they are NOT a globally
// known fixed set a learner reading cas.js can target. Pure: same reference → same points.
function seededPoints(referenceSrc) { … }

// All-must-agree over the points (after exclusion), using `valueOf(node,x)` to read each
// side (evalAt for values; numericDerivAt for the derivative pass). Returns { ok, valid }.
// ok ⇔ (every jointly-valid point agrees within `tol`) AND (valid ≥ MIN_VALID). One
// disagreement ⇒ ok:false. Too few valid points ⇒ ok:false (conservative — never a pass).
function agreesOnSamples(valueOf, aAst, bAst, points, tol) { … }
```

The public checker:

```js
// Is the learner's answer mathematically equivalent to the reference? CONSERVATIVE:
// parse failure, any disagreement at a jointly-valid point, or too few valid points ⇒
// { equivalent:false } (never a false "correct"). For non-`evaluate` operations also
// requires the FIRST DERIVATIVES (central difference) to agree on the same points
// (defeats value-only forgeries). Pure/deterministic (fixed seed-from-reference, no
// Date/Math.random). `parseExpr` REJECTS any symbol other than `variable` (off-grammar
// ⇒ throw ⇒ conservative false) — so an answer in the wrong variable cannot pass.
export function checkEquivalence(answer, reference, { variable = "x", checkDerivative = true } = {}) {
  let aAst, bAst;
  try { aAst = parseExpr(answer, variable); bAst = parseExpr(reference, variable); }
  catch { return { equivalent: false, reason: "I couldn't read that answer — check the syntax." }; }
  const points = seededPoints(reference); // seeded from the REFERENCE source, not the answer
  const v = agreesOnSamples(evalAt, aAst, bAst, points, TOL);
  if (!v.ok) return { equivalent: false, reason: v.valid < MIN_VALID
    ? "I couldn't verify this — try a more explicit form." : "Not quite — that isn't equivalent." };
  if (checkDerivative) {
    const d = agreesOnSamples(numericDerivAt, aAst, bAst, points, DERIV_TOL);
    if (!d.ok) return { equivalent: false, reason: "Not quite — that isn't equivalent." };
  }
  return { equivalent: true };
}
```

The drill generator and topic mapping (references built **by construction** from seeded
coefficients — no symbolic engine, and never derived from learner input, AC2):

```js
// A deterministic drill, seeded by integer `seed` (pure: same seed → same problem).
// Returns { operation, prompt, expression, reference, variable }. A seeded mulberry32
// picks integer coefficients/degree. INVARIANT (asserted + tested): for non-`evaluate`
// operations the reference genuinely DEPENDS ON `variable` (never a constant) — so a
// degenerate "answer = a constant" cannot trivially pass.
//   differentiate: build poly p; reference = p' BY THE POWER RULE on its coefficients
//   simplify:      build like-terms expr (e.g. "2x + 3x"); reference = the collected form ("5x")
//   evaluate:      build poly p + a seeded point k; reference = the NUMBER p(k); checkDerivative FALSE
//   integrate:     build antiderivative P; PROMPT integrand = P' (power rule); reference = P;
//                  the check compares d/dx(answer) ≡ P' via numericDerivAt — so +C passes
export function generateDrill({ operation, seed }) { … }

// Which generated operations a plateau offers (by domain/name; [] ⇒ not quantitative).
export function drillsFor(plateau) { … }
```

Author-challenge parsing (no engine needed):

```js
// ```solve fenced blocks in the plateau body → [{ prompt, answer, operation?, variable? }].
// ONE shared fence grammar with stripChallenges (round-trip tested). Tolerates CRLF,
// leading whitespace, and multiple blocks. `answer` is the reference expression/number.
export function parseChallenges(body = "") { … }
// The body with EXACTLY those blocks removed (read view + grounding never show the answer).
export function stripChallenges(body = "") { … }
```

`generateDrill` uses a mulberry32 PRNG seeded by an explicit integer — pure, deterministic.
For an **integrate** drill the check is "is `d/dx(answer)` equivalent to the integrand?",
so any constant of integration passes without symbolic ∫. (Known limit, named in the AC6
note: this accepts antiderivatives differing by a piecewise constant on disjoint domain
intervals — fine for the bounded polynomial/rational POC set.) `simplify` is checked like
any other op: the learner's form must be **equivalent** to the already-simplified reference.

### 2.3 `main.js` — the "Solve it" path (in `renderMastery`) + grounding strip

Mirrors R-0032's "Prove it", with two differences: (a) it is **not** model-gated — it
shows whenever the topic is **quantitative**: `drillsFor(p).length || parseChallenges(p.description).length`;
(b) the check is local and **synchronous** (no `sendTurn`, no async engine).
Like `#detail-proof`, **`#detail-solve` is a static sibling of `#detail-mastery`/`#detail-proof`**
(survives `renderMastery`'s `replaceChildren`); its nodes are queried **once at init**;
`renderMastery` only appends the **"Solve it"** toggle (when quantitative and not already
mastered). `openPlateau` calls **`hideSolveBox`** (alongside the R-0032 `hideProofBox`) —
clears the input/preview/feedback and resets the active problem.

The box:
- A **problem prompt** (`#solve-prompt`, rendered via `typesetMath`), a **"New problem"**
  button (generated drills only), an **answer textarea** (`#solve-input`, **plain math
  syntax**, e.g. `3x^2`), the R-0032 **symbol palette**, a **live preview** (`#solve-preview`)
  via `toTeX(parseExpr(answer))` → a `.mp-math` span → `typesetMath` (KaTeX `trust:false`;
  **parse failure ⇒ `textContent` of the raw input — never `innerHTML` of learner text**),
  a **Check** button, and `#solve-feedback` (**`textContent`** — engine output is plain text).
- An **author challenge** (if present) shows first; **generated drills** use the
  operation(s) from `drillsFor` with "New problem" reseeding from an **incrementing
  integer `seed`** held in a closure var (the impurity lives in the UI; `generateDrill`
  stays pure). The **active problem** `current = { reference, variable, operation }` comes
  from `generateDrill` or the parsed author challenge.
- **Check** → early-return if `#solve-input` is blank; else:
  ```js
  const { equivalent, reason } = checkEquivalence(input.value, current.reference,
    { variable: current.variable, checkDerivative: current.operation !== "evaluate" });
  feedbackEl.textContent = equivalent ? "✓ Correct — verified equivalent to the answer." : reason;
  if (equivalent) { signMastery(p); renderMastery(p); } // ✓ + community count
  ```
  `signMastery` (R-0030) is the **only** sign path; a wrong/unparseable answer signs
  **nothing**. Problem/answer are **not** stored.

**Grounding strip:** when assembling the plateau study context, pass the **stripped**
description (`buildPlateauStudyContext({ plateau: { ...p, description: stripChallenges(p.description) }, … })`)
so an author's `answer:` never rides to the model. (Applies to the existing R-0023 study
actions and the R-0032 proof grounding for that plateau.)

### 2.4 `index.html` — solve box + CSS, and the body strip

A `#detail-solve` block **as a static sibling right after `#detail-proof`** (NOT a child),
`hidden` by default: an **honesty note** (`"Checked by computer algebra — your answer is
verified equivalent to the correct one by numeric checking (a strong check, not a
step-by-step proof)."`), `#solve-prompt`, "New problem" button, `#solve-palette`,
`#solve-input`, `#solve-preview`, **Check** button, `#solve-feedback`. Add a `#detail-solve`
line to the **bridge-mode hide-list**. The plateau read view renders
**`stripChallenges(p.description)`** (this strip must run **before** `renderMarkdown`,
because markdown.js greedily turns any ```` ``` ```` fence into `<pre><code>` first — an
unstripped `solve` fence would otherwise show its raw `prompt:`/`answer:` lines). CSS
reuses the R-0032 proof-box styling.

## 3. Code outline

- `cas.js`: the parser/evaluator `parseExpr` (bounded grammar, rejects off-grammar — no
  `eval`/`Function`), `evalAt`, `numericDerivAt`, `toTeX` (each unit-tested); the integrity
  predicates `isValidSample`, `agree`, `seededPoints`, `agreesOnSamples` (each exported for
  direct unit tests) + `checkEquivalence` (value pass + numeric-derivative pass for non-evaluate);
  `generateDrill` (seeded, 4 ops, references by construction, reference-depends-on-variable
  invariant); `drillsFor`; `parseChallenges` + `stripChallenges` (one shared fence grammar). All sync.
- `cas.test.mjs`:
  - **Parser/evaluator units:** `parseExpr` accepts the grammar incl. implicit multiplication
    (`3x`, `2(x+1)`) and rejects off-grammar (unknown ident/function, trailing garbage) by throwing;
    `evalAt` matches known values (incl. `pi`/`e`/functions); `numericDerivAt` ≈ the analytic slope;
    `toTeX` produces sane LaTeX. **No `eval`/`Function`** (grep-assert in review).
  - **Equivalence accepts** form differences: `2x`≡`x+x`, `(x+1)^2`≡`x^2+2x+1`, unsimplified/reordered.
  - **Equivalence rejects** non-equivalent: `x`≢`x^2`; and is **conservative** on unparseable / too-few-valid.
  - **Forgery rejected (the integrity test):** an answer built to match the reference's *values*
    at sampled points but globally wrong (a vanishing-bump `reference + c·∏(x−pᵢ)` and/or a
    value-only interpolant) is **rejected** by the all-must-agree + per-problem-seed + derivative pass.
  - **All-must-agree:** an answer agreeing at some points but disagreeing at others ⇒ rejected.
  - **Predicate units:** `isValidSample` excludes NaN/±Infinity (the real-only evaluator never yields
    Complex); `agree` mixed tolerance at near-zero and large magnitude; `seededPoints` deterministic
    per reference, skips near-integers.
  - **`generateDrill`:** same seed → same problem; reference self-consistent (differentiate:
    `numericDerivAt(expression)`≡`evalAt(reference)`; integrate: `numericDerivAt(reference)`≡`evalAt(expression)`);
    reference **depends on `variable`** for non-evaluate ops (not a constant).
  - **`parseChallenges`/`stripChallenges`:** extracts prompt/answer (+ optional op/var); **round-trip**
    (strip removes exactly what parse finds); CRLF + multiple blocks; no block ⇒ [] / unchanged body.
- `main.js`: in `renderMastery`, the quantitative-gated "Solve it" toggle + solve-box wiring (palette
  reuse, live `toTex` preview, New-problem reseed, Check → check → sign/feedback, blank guard);
  `hideSolveBox` in `openPlateau`; read view + grounding use `stripChallenges`.
- `index.html`: `#detail-solve` markup + CSS + bridge-mode hide.

## 4. Non-goals

Per R-0034 §4: verify equivalence, not prove (no step/derivation checking, no theorem prover);
deterministic + offline + model-free; no new event kind / Rust / CRDT field; no proof/answer
persistence (ephemeral); bounded operation set; no change to R-0032 "Prove it" or the R-0030
self-attest gate; no difficulty/scheduling.

## 5. Open questions (resolved here)

- **Engine** = a **self-contained** hand-written parser/evaluator in `cas.js` (no dependency,
  no vendoring, no network, no `eval`); numeric eval + central-difference derivative. §2.1.
- **Operations** = differentiate, simplify, evaluate (core) + integrate (via derivative check). §2.2.
- **Author-challenge shape** = a ```solve fenced block (`prompt:` / `answer:` [/ `var:` / `op:`]) in
  the body — **zero schema/CRDT change**, authored via the existing body editor; stripped from the
  read view **and** the model grounding. §2.2–2.4.
- **Equivalence (the integrity boundary)** = per-problem **seeded** points (16, seeded from the
  reference), **all jointly-valid points must agree**, **mixed abs+rel** `TOL=1e-7`, complex/NaN
  **excluded**, `MIN_VALID=6` floor (below ⇒ conservative-false), **value + first-derivative**
  agreement for non-evaluate ops. Conservative — never a false correct. §2.2.

## 6. Acceptance criteria

Maps to R-0034 AC:

- [x] AC1 — "Solve it" (offline) opens a prompt + LaTeX-preview answer textarea + palette. *(browser)*
- [x] AC2 — app-generated drill; reference computed independently of input; "New problem" reseeds. *(cas tests + browser)*
- [x] AC3 — author `solve` fenced block becomes a checkable problem; both can coexist; stripped from read view + grounding. *(parse/strip tests + browser)*
- [x] AC4 — deterministic equivalence (offline, no model); robust to form; **conservative — no false correct**, incl. a forgery-rejection test (per-problem seed + all-agree + derivative). *(checkEquivalence + predicate + forgery tests)*
- [x] AC5 — correct → `signMastery` (✓); wrong/unparseable → feedback, no sign. *(tests + browser)*
- [x] AC6 — honesty note: a deterministic numeric-equivalence check, **a strong check not a symbolic proof**; integrate +C / branch limit named. *(markup)*
- [x] AC7 — predicates + `checkEquivalence`/`generateDrill`/`parseChallenges`/`stripChallenges` pure + unit-tested. *(node --test)*
- [x] AC8 — additive JS-only; **no new dependency**; no Rust/CRDT/event change; the
      self-contained evaluator is outside the garust boundary and never `eval`s input; safe
      preview/feedback (textContent); suites green. *(diff + suites)*
- [x] AC9 — browser: generated + authored problem → correct signs ✓, wrong shows feedback, New problem reseeds; works with no model; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | A **self-contained** hand-written parser/evaluator (no mathjs, no vendoring) | A bundled mathjs ESM isn't self-contained (imports decimal.js/typed-function/@babel by URL) → won't resolve under bare `node --test` and isn't offline in-browser; the project is offline-first/no-build; we only need numeric eval, which is small to own and safer (never `eval`s learner input) |
| 2026-06-20 | Numeric **sampling** for equivalence + **central-difference** derivative pass | Deterministic + node-testable; sidesteps undecidable symbolic equality AND symbolic differentiation; conservative ⇒ never a false "correct" |
| 2026-06-20 | **Per-problem seeded** points + **all-must-agree** + **value+derivative** (non-evaluate) | The integrity boundary: a learner reading `cas.js` cannot forge a passing wrong answer (no fixed public point set; a vanishing bump has nonzero slope at the points) |
| 2026-06-20 | Mixed abs+rel tolerance; complex/NaN/∞ excluded (never agreement); `MIN_VALID` is a floor only | Closes the float / degenerate / wrong-variable false-correct leaks the architect flagged |
| 2026-06-20 | integrate checked by `derivative(answer) ≡ integrand` | Handles +C, needs no symbolic ∫ (piecewise-constant/branch limit named in AC6) |
| 2026-06-20 | Author challenges as ```solve fenced blocks; stripped before render AND grounding | Zero schema/CRDT change; reuses the body editor; the answer never shows in the read view or rides to the model |
| 2026-06-20 | "Solve it" is offline (not model-gated, unlike "Prove it") | The check is local + deterministic — the rigorous offline rung |

## Changelog

- 2026-06-20 created (Draft) — deterministic "Solve it": vendored mathjs equivalence engine
  + seeded drill generator + author `solve` fenced-block challenges, gating the R-0030 mastery; model-free.
- 2026-06-20 architect design review: **REQUEST-CHANGES → resolved**. Confirmed sound: the
  composition (static-sibling box, query-once, hide-on-open, bridge hide, vendored-lazy engine,
  `signMastery` as the only sign, no Rust/CRDT/event change), the vendored CAS being outside the
  garust boundary, the integrate-by-derivative trick, and offline/not-model-gated being consistent.
  **Hardened the false-correct integrity boundary** (the load-bearing concern): per-problem **seeded**
  sample points (not a fixed public set — closes the interpolation/bump forgery), **all jointly-valid
  points must agree** (`MIN_VALID` is a floor only — no minority pass), **mixed abs+rel tolerance** with
  **complex/NaN/∞ excluded** (never counted as agreement), **value + first-derivative** agreement for
  non-evaluate ops, and a **reference-depends-on-variable** generation invariant — each as a separately
  unit-tested predicate, plus an explicit **forgery-rejection** test. Pinned `stripChallenges` to run
  **before** `renderMarkdown` and to share one fence grammar with `parseChallenges` (round-trip tested),
  and to also strip the `solve` block from the **model grounding**. **Status → Accepted.**
- 2026-06-20 implemented + QA **PASS** (AC1–AC9). `cas.js` (the self-contained parser/
  evaluator, integrity predicates, `checkEquivalence`, `generateDrill`, `drillsFor`,
  `parseChallenges`/`stripChallenges`) + 24 unit tests (suite 244 green); `main.js` wired
  the quantitative-gated "Solve it (CAS-checked)" toggle + `#detail-solve` box (palette,
  live `toTeX` preview, "New problem" reseed, Check → `checkEquivalence` → `signMastery`
  on correct, blank guard), `hideSolveBox` on plateau switch, and `stripChallenges` in the
  read view + model grounding; `index.html` added the static-sibling solve markup + CSS +
  bridge hide. Browser-verified offline (generated + authored problems: correct signs ✓,
  wrong → feedback no sign, New problem reseeds; no "Prove it" when offline; body strips the
  author `solve` block; console clean). QA's independent adversarial sweep found **no
  false-correct path**. One fix during verification: `agreesOnSamples` now returns
  `disagreed` so a plain wrong answer reports "isn't equivalent" (not the too-few-valid
  message). **Status → Implemented.**
- 2026-06-20 engine revised (pre-implementation): swapped the vendored mathjs for a
  **self-contained hand-written parser/evaluator** in `cas.js` after a feasibility probe — a
  bundled mathjs ESM is *not* self-contained (it imports `decimal.js`/`typed-function`/`@babel/runtime`
  by URL), so it neither resolves under bare `node --test` nor stays offline in-browser, against
  the project's offline-first/no-build values. The integrity design is unchanged (seeded points,
  all-agree, mixed tolerance, real-only exclusion, value + **numeric central-difference** derivative,
  reference-depends-on-variable); the engine is now **synchronous, dependency-free, never `eval`s**
  learner input, and drill references are built **by construction** from seeded coefficients. Re-reviewed
  by the architect (engine swap + parser safety) before implementation.
