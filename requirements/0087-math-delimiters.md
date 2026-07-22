# R-0087 — render \( \) and \[ \] math: pasted answers typeset properly

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0020 (markdown/KaTeX), R-0056 (notepad).
- **Source:** the owner: "the private notepad feature does not display math and symbols properly."

## 1. Statement

Root cause: `renderMarkdown` only recognized `$…$` / `$$…$$` math, but the notepad's most common
paste source — **Gemini/ChatGPT answers from the hand-off features** — writes LaTeX-style
delimiters `\(…\)` (inline) and `\[…\]` (display). Those rendered as raw text everywhere the
markdown renderer runs. Fixed at the source: both forms are now extracted into the same inert
`.mp-math` placeholders as the `$` forms — **before** the image/link rules, so `\[…\]` can never
half-match a link — inheriting the whole existing safety story (escaped `data-tex`, script
breakouts stay inert, raw-TeX fallback when KaTeX is unavailable). One fix covers the notepad
preview, topic bodies, review answers, the lesson, and the PDF export.

## 2. Acceptance criteria

- **AC1** — `\(…\)` → inline `.mp-math`, `\[…\]` → display `.mp-math` (block-level, not wrapped
  in `<p>`); all four delimiter forms coexist in one body; no raw delimiter survives rendering.
- **AC2** — extraction order: before images/links (`\[x\](url)` is math, never an `<a>`); a
  script breakout inside `\(…\)` stays escaped inside `data-tex`, exactly like the `$` forms.
- **AC3** — additive, no new dependency; suite stays green.

## Changelog

- 2026-07-22 created (Accepted) + fixed. Suite 571/571 (1 new delimiter battery). Live-verified
  in the notepad preview: a note mixing `$…$`, `$$…$$`, `\(\alpha\cdot\beta\)`, and
  `\[ c^2 = a^2+b^2-2ab\cos\theta \]` rendered 4 KaTeX nodes with zero raw delimiters (before
  the fix: 2 nodes, both LaTeX-style forms raw).
