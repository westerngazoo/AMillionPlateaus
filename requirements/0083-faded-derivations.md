# R-0083 — faded derivations: now you — fill the missing step

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0074 (worked derivations), R-0020 (Markdown/KaTeX).
- **Source:** the owner's approved pedagogy trio (spaced review → pretest → **faded derivations**);
  part (c), the final item.

## 1. Statement

The worked-example literature's strongest move (Renkl & Atkinson) is **fading**: start from the
fully worked derivation, then hide steps and make the learner produce them — **backward** (the
last step first), because the early steps keep scaffolding the goal. Every R-0074 derivation with
2+ `**Step N — title.**` steps now carries a practice bar: **✍️ Practice — fill the missing
step** re-renders the derivation with the last *k* steps replaced by dashed "your turn" cards
(title shown, body hidden — write it on paper or the notepad, then **Reveal step** to check).
When every hidden step is revealed, you self-assess: **✓ Got them** fades one more step next
time; **↩ More support** restores one. *k* is persisted per topic in `mp.fade` (this browser
only); at *k* = all steps you're deriving from a blank page. **📜 Show worked again** restores
the full derivation any time. Offline, no model.

## 2. Acceptance criteria

- **AC1** — pure `faded.js`: `parseSteps` (R-0074's `**Step N — title.**` paragraphs → preamble +
  steps with full md; en/em-dash/hyphen separators; no markers → zero fadeable steps; trailing
  prose rides the last step), `fadedView` (backward: last *k* hidden, clamped), `clampFade`,
  `levelUp`/`levelDown` (capped/floored), `fadeLabel`. Unit-tested.
- **AC2** — derivations with ≥2 steps get the practice bar; practice opens the collapsible,
  shows worked steps + per-hidden-step cards (title via textContent, Reveal renders + typesets the
  real step); the self-assessment row appears only after ALL hidden steps are revealed.
- **AC3** — Got them / More support persist the new level (`mp.fade`, floor 1, cap = step count)
  and the button label + note reflect it ("last 2 steps are yours", "derive it all").
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 565/565 (6 new faded tests). Live-verified
  on The Geometric Product's 5-step ½(ab±ba) derivation: practice hid exactly Step 5 (backward),
  Reveal typeset the real step (7 KaTeX renders), the assess row appeared only after all reveals,
  ✓ Got them persisted level 2 ("last 2 steps are yours"), round 2 hid Steps 4–5, and the level
  survived a plateau re-render.
