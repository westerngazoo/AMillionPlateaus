# SPEC-0032 — Math mastery by AI-checked proof ("Prove it": LaTeX input + grading turn)

- **Status:** Implemented
- **Realizes:** R-0032
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-18
- **Depends on:** SPEC-0030 (`signMastery`/`renderMastery`), SPEC-0007 (`assembleMessages`/`sendTurn`), SPEC-0023 (`buildPlateauStudyContext`, `voiceFor`), SPEC-0020 (`renderMarkdown` + `typesetMath`)
- **Module(s):** `apps/web/src/study.js` (+ `study.test.mjs`) — pure `parseVerdict` + `buildProofGrading`; `apps/web/src/main.js` — the "Prove it" path in `renderMastery` (proof box + grade + sign); `apps/web/index.html` — proof-box markup + CSS. **No Rust/wasm rebuild, no CRDT/reputation change; mastery content unchanged (proof ephemeral).**

## 1. Motivation

R-0032: write a proof, the model judges it, a PASS signs the R-0030 mastery. All
pieces exist (`sendTurn`, `buildPlateauStudyContext`, KaTeX, `signMastery`); this
composes them behind a "Prove it" button with a LaTeX input. The model is a
**judge, not a verifier** — the UI says so, and the verdict parse is fail-safe.

## 2. Design

### 2.1 `study.js` — pure grading helpers

```js
const PROOF_CAP = 4000; // bound the proof we send (token safety)

// The grading USER message (the grounding rides separately via assembleMessages).
export function buildProofGrading({ plateau, proof } = {}) {
  const name = plateau?.name ?? "this topic";
  const p = String(proof ?? "").slice(0, PROOF_CAP);
  return [
    `I'm demonstrating my understanding of "${name}". My proof / explanation:`,
    "",
    p,
    "",
    "You are a tutor giving JUDGMENT, not a formal proof checker. Judge whether " +
      "this correctly demonstrates understanding of THIS topic, grounded ONLY in " +
      "its notes above. Give brief, specific feedback. Then end with EXACTLY one " +
      "final line: `VERDICT: PASS` if it holds, or `VERDICT: REVISE` if it needs work.",
  ].join("\n");
}

// Parse the model's verdict. Fail-safe: only an explicit PASS passes; an absent or
// ambiguous verdict ⇒ revise (never auto-grant mastery). `feedback` strips the
// verdict line(s). Pure + deterministic.
export function parseVerdict(reply = "") {
  const text = String(reply);
  // LINE-ANCHORED detection (mirrors the strip) — a mid-sentence "VERDICT: PASS"
  // in the model's prose must NOT pass (fail-safe). Last standalone verdict wins.
  const last = [...text.matchAll(/^[ \t]*VERDICT:\s*(PASS|REVISE)\b/gim)].pop();
  const pass = last ? last[1].toUpperCase() === "PASS" : false;
  const feedback = text.replace(/^[ \t]*VERDICT:\s*(PASS|REVISE)[ \t]*$/gim, "").trim();
  return { pass, feedback: feedback || text.trim() };
}
```

The detection regex is **line-anchored** (`^…`, multiline), matching the strip —
so only a standalone final `VERDICT: PASS` line passes; an inline mention
(`"… VERDICT: PASS …"`), a quoted instruction, or an absent token ⇒ `pass:false`.
And the **proof text never reaches `parseVerdict`** — only the model's reply does
(the proof rides in the user message), so a learner can't self-grant by writing
the token in their own proof.

### 2.2 `main.js` — the "Prove it" path (in `renderMastery`)

`renderMastery(p)` (R-0030) opens with `detailMastery.replaceChildren()` and is
re-invoked on every state change — so the proof box must **not** be a child of
`#detail-mastery` (it'd be destroyed, losing the draft). **`#detail-proof` is a
static sibling right after `#detail-mastery`** (hidden by default; its
input/palette/preview/feedback/Check nodes queried **once at module init**, like
`#detail-study`/`#detail-mastery`). `renderMastery` only **appends the "Prove it
(AI-checked)" toggle button** into `#detail-mastery` — **only when
`modelConfig.kind !== "fake"`** and not already mastered — wired to show/hide the
sibling `#detail-proof`. Opening a different plateau hides + clears it.

The proof box:

- **textarea** (`#proof-input`) + a **symbol palette** (buttons inserting LaTeX at
  the cursor: `\forall \exists \in \le \ge \Rightarrow \iff \sqrt{} \sum \int
  \frac{}{} \lim_{}` and a `$ $` wrapper) + a **live preview** (`#proof-preview`)
  rendered on `input` via `preview.innerHTML = renderMarkdown(value); typesetMath(preview)`
  (the R-0020 **safe** path — same sanitiser as a plateau body, so the learner's
  text is inert) + a one-line honesty note + a **Check** button + a feedback area.
- **Check** → early-return if `input.value` is blank/whitespace (sign nothing,
  show a "write a proof first" hint); otherwise:
  ```js
  const rs = doc.to_graph().resources().filter(r => r.plateau_id === p.id);
  const grounding = buildPlateauStudyContext({ plateau: p, resources: rs });
  const messages = assembleMessages(voiceFor(activePersona), grounding, [],
    buildProofGrading({ plateau: p, proof: input.value }));
  feedbackEl.textContent = "Checking…";
  sendTurn(modelConfig, messages)
    .then((reply) => {
      const { pass, feedback } = parseVerdict(reply);
      feedbackEl.textContent = feedback;
      if (pass) { signMastery(p); renderMastery(p); } // ✓ + community count; box replaced by "✓ Mastered"
    })
    .catch((err) => { feedbackEl.textContent = `⚠ ${err.message}`; }); // graceful, signs nothing
  ```
  Empty history (`[]`) — grading is a stateless turn, not the chat transcript.

`signMastery` (R-0030) is the **only** sign path; a PASS routes through it, so the
proof mastery is identical to a self-test mastery (✓, persists, community count,
reset clears). REVISE/error sign nothing. The proof text is **not** stored.

### 2.3 `index.html` — proof box + CSS

A `#detail-proof` block **as a static sibling right after `#detail-mastery`**
(NOT a child — so `renderMastery`'s `replaceChildren()` never destroys it),
`hidden` by default: the honesty note (`"An AI tutor judges your proof —
feedback + a verdict, not a formal verifier."`), `#proof-palette`, `#proof-input`
(textarea), `#proof-preview`, a **Check** button, `#proof-feedback`. Add a
dedicated `#detail-proof` line to the **bridge-mode hide-list** (R-0029,
index.html:284–290 — required since it's a sibling, not inherited). CSS: mono
textarea, a small preview panel, palette as inline buttons. Hidden until "Prove
it" is clicked; the `#proof-feedback` is `textContent` (model output is
untrusted), the preview via the safe `renderMarkdown`/`typesetMath`.

## 3. Code outline

- `study.js`: `PROOF_CAP`, `buildProofGrading`, `parseVerdict` (~22 lines pure).
- `study.test.mjs`: `parseVerdict` (standalone PASS/REVISE line, lowercase,
  trailing-ws; last-wins; **inline mid-sentence `VERDICT: PASS` must NOT pass**;
  absent/ambiguous → `pass:false`; feedback strips the line; deterministic);
  `buildProofGrading` (embeds name + proof + the VERDICT instruction; caps at
  PROOF_CAP).
- `main.js`: in `renderMastery`, the "Prove it" button (model-gated) + the proof
  box wiring (palette insert, live preview, Check → grade → sign/feedback).
- `index.html`: `#detail-proof` markup + CSS + bridge-mode hide.

## 4. Non-goals

Per R-0032 §4: judge not verifier (no formal checking); no CAS rung; no proof
persistence/sharing (ephemeral); no per-step checking; no offline-digest or
self-attest change; no Rust/CRDT/event-shape change.

## 5. Open questions (resolved here)

- Verdict = a final `VERDICT: PASS|REVISE` line, last-wins, fail-safe to REVISE. §2.1.
- Both paths when a model is connected: "Mark as mastered" (self-attest) **and**
  "Prove it" (AI-checked). §2.2.
- Palette = the fixed set in §2.2.

## 6. Acceptance criteria

Maps to R-0032 AC:

- [x] AC1 — "Prove it" (model-connected) opens a LaTeX textarea + live KaTeX
      preview + symbol palette. *(browser)*
- [x] AC2 — Check sends grounding + proof + verdict instruction via `sendTurn`. *(code + browser w/ mocked fetch)*
- [x] AC3 — PASS → `signMastery` (✓); REVISE → feedback, no sign; unparseable /
      inline-mention / empty-proof → no sign. *(parseVerdict tests + empty-proof
      guard + browser mocked PASS/REVISE)*
- [x] AC4 — model-gated; offline self-attest unchanged; model error signs nothing. *(browser)*
- [x] AC5 — honesty note present; no "verifier" claim. *(browser/markup)*
- [x] AC6 — `parseVerdict`/`buildProofGrading` pure + unit-tested. *(node --test)*
- [x] AC7 — additive JS-only; no Rust/CRDT/event change; safe preview render;
      suites green. *(diff + suites)*
- [x] AC8 — browser (mocked grading fetch): write proof → preview/palette →
      PASS signs ✓, REVISE shows feedback; offline path intact; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-18 | Pure `parseVerdict` (last `VERDICT:` line, fail-safe REVISE) + `buildProofGrading` | Deterministic + node-testable; a flaky reply never auto-grants mastery |
| 2026-06-18 | PASS routes through the existing `signMastery` (R-0030) | One mastery layer — proof mastery == self-test mastery (✓, community, reset) |
| 2026-06-18 | Live preview reuses `renderMarkdown` + `typesetMath` (R-0020) | Same safe sanitiser as a plateau body — the learner's LaTeX is inert |
| 2026-06-18 | Proof ephemeral (not in the event) | No event-shape/Rust change; sharing a proof is a later privacy-considered step |

## Changelog

- 2026-06-18 created (Draft) — "Prove it" LaTeX proof path: pure
  `parseVerdict`/`buildProofGrading` + a model-gated proof box wired to
  `signMastery`. Pending architect review, then `Accepted`.
- 2026-06-18 implemented + QA **PASS** (AC1–AC8). `study.js` gained pure
  `parseVerdict`/`buildProofGrading`/`PROOF_CAP` (9 unit tests; suite 217 green);
  `main.js` wired the model-gated "Prove it" toggle + the `#detail-proof` box
  (palette insert, safe live preview, Check → grade → `signMastery` on PASS,
  graceful error, empty-proof guard); `index.html` added the static-sibling
  proof markup + CSS + bridge-mode hide line. Browser-verified online (PASS→✓,
  REVISE/inline-mention/empty/HTTP-500 → no sign), offline gate (no "Prove it"),
  plateau-switch reset, console clean. Trust boundary holds: only the model's
  reply reaches `parseVerdict`. **Status → Implemented.**
- 2026-06-18 architect design review: **REQUEST-CHANGES → resolved**. Confirmed
  sound: the trust boundary (only the model's reply reaches `parseVerdict`, never
  the proof — no self-grant), the safe preview reuse, mastery integrity (PASS is
  the only new sign, through `signMastery`; no PASS without a round-trip),
  `[]`-history stateless grading, and `window.fetch` monkeypatch testability (no
  new seam). Fixed the blocking fail-OPEN: `parseVerdict` detection is now
  **line-anchored** so a mid-sentence `VERDICT: PASS` can't grant mastery (+ an
  inline-mention test). Pinned `#detail-proof` as a **static sibling** of
  `#detail-mastery` (survives `replaceChildren`; nodes queried at init; its own
  bridge-mode hide line) and an **empty-proof guard** (Check signs nothing on
  blank). **Status → Accepted.**
