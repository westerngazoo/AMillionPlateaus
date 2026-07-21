# R-0076 — PDF ⬇: export a note as PDF

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-21
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0056 (the notepad), R-0020 (Markdown/KaTeX render).
- **Source:** the owner: "once I am checking a note on the md editor, can I export it as a PDF?"

## 1. Statement

The notepad gains **PDF ⬇**: the note renders — topic title, dated meta line, Markdown with the
math **typeset (awaited)** — into a dedicated print surface, print CSS makes it the only visible
element (white, serif, book-like), and the browser's own print dialog opens → **Save as PDF**.
Offline, dependency-free, and the Boox tablets get the same dialog (Android print → Save as PDF).
Everything restores on `afterprint` (with a timeout safety net for webviews that never fire it).

## 2. Acceptance criteria

- **AC1** — PDF ⬇ on the notepad: flushes the pending edit, refuses an empty note with a clear
  message, fills `#note-print` (h1 topic via textContent, meta line, rendered note), **awaits**
  `typesetMath` so the PDF never shows raw TeX, then `window.print()`.
- **AC2** — in print mode (`body.print-note`) only `#note-print` is visible: white background,
  black serif text; on screen the surface is never visible.
- **AC3** — cleanup on `afterprint` (class removed, surface emptied) + a 60s fallback.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-21 created (Accepted) + implemented. Suite 533/533. Live-verified with a print
  monkey-patch: title "Motion" + meta + 2 KaTeX renders (zero raw `$` leaks), print called once,
  print-mode toggled, afterprint restored everything.
