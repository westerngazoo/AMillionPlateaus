# R-0074 — Worked derivations: depth one tap away

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Created:** 2026-07-20
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0020 (Markdown/KaTeX bodies), R-0071 (sentence segmentation, which covers the
  derivation too), R-0073 (`handoffOpenUrl` — whose popup ordering this fixes).
- **Realized by:** direct implementation — `splitDerivation` (deliverable.js) + a collapsible
  renderer in openPlateau + seven authored `### Worked derivation` sections.
- **Source:** the owner: clicking the Deliverable ($a\wedge b = \tfrac12(ab-ba)$) "I wanna see the
  full derivation, where it comes from and all"; Motion "takes me to the topic generally" — teach
  with formulas and derivations, pedagogically. Also: "the explain this slowly not even working" —
  the hand-off popup was opened after an `await`, losing the click's activation.

## 1. Statement

Topic bodies may carry a `### Worked derivation` section. It renders as a **collapsible**
"📜 Worked derivation — step by step" block — the first read stays approachable; the full math is
one tap away. Seven derivations ship: **Motion** (new full body — the three constant-acceleration
equations from the definitions), **Kinematics 2D** (the range $R=v_0^2\sin2\theta/g$), **Newton's
Laws** ($a=g\sin\theta$ on the incline), **Classical Mechanics** (Euler–Lagrange from $\delta S=0$),
**The Geometric Product** (the $\tfrac12(ab\pm ba)$ split from the single axiom — the owner's
screenshot), **Rotors** (mirror → sandwich → half-angle → exponential), **Maxwell** ($\nabla F = J$
unpacked by grade). Also fixed: every hand-off now calls `window.open` BEFORE the clipboard `await`,
so the popup can never be blocked by lost user-activation.

## 2. Acceptance criteria

- **AC1** — a body's `### Worked derivation` renders as a closed-by-default `<details>` block with
  KaTeX intact inside (segmentation-safe: R-0071 sentence marking works within it); bodies without
  one render unchanged.
- **AC2** — the seven derivations above ship, each stepwise (numbered steps, every move justified,
  a sanity check at the end), KaTeX-clean, and consistent with their topic's Deliverable.
- **AC3** — Motion (the Physicist trailhead) has a real teaching body (was a bare label).
- **AC4** — all seven hand-off sites open the tab synchronously on click (before any `await`).
- **AC5** — pure + additive + tested: `splitDerivation` under `node --test`; `apps/web` only; the
  curriculum integrity suites (incl. the grand-union id test) stay green.

## 3. Non-goals (follow-ups, owner-approved order)

R-0075 GitHub notes-sync (Boox) + explicit notepad Save UI → spaced review queue → pretest lesson
step → **faded derivations** ("now you: fill the missing step" variants of these sections).

## Changelog

- 2026-07-20 created (Accepted) + implemented — 7 derivations + collapsible renderer + popup-order
  fix. Suite 529/529. Live-verified: Motion body + 📜 block (3 equations, 22 KaTeX renders, no raw
  `$` leaks); Geometric Product derivation end-to-end; a 🐇 Gemini click opened the prefilled URL
  synchronously.
