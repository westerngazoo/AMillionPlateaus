# R-0077 — 📷 Image: attach images into a markdown note

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-21
- **Owner:** Gustavo Delgadillo
- **Depends on:** R-0056 (the notepad), R-0020 (injection-safe Markdown), R-0075 (GitHub
  notes-sync), R-0076 (PDF export).
- **Source:** the owner: "can I add an image as well attached into an md, after attaching, as a
  way to add Boox notes?"

## 1. Statement

The notepad gains **📷 Image**: pick an image (a Boox handwriting page export, a photo of paper
notes), it is downscaled in-browser (longest side ≤ 1280 px, JPEG q0.8) and embedded **inside the
markdown text** as a `![alt](data:image/jpeg;base64,…)` line at the cursor. Because the bytes
live in the note itself, the drawing travels everywhere the note travels: autosave, **Push ↑ /
Pull ↓ to the private GitHub repo (both Boox tablets)**, Preview, and the **PDF export** — with
no separate image storage to sync.

`renderMarkdown` learns the `![alt](src)` image syntax under the existing injection-safety
contract: `<img>` joins the fixed tag allowlist; `src` must pass `safeImgSrc` — **https:, or a
base64 RASTER data URI (png/jpeg/gif/webp) only**. `data:image/svg+xml` is deliberately excluded
(SVG can carry script), `http:` is excluded (mixed content on the hosted app), and a rejected
image renders as inert escaped literal text — held, so the link pass cannot re-parse it.
`loading="lazy"` is emitted **only for https images**: a lazy data: URI that starts offscreen can
sit unloaded forever (bytes are already inline, there is nothing to defer) and would print blank.

## 2. Acceptance criteria

- **AC1** — 📷 Image on the notepad opens a file picker (`accept="image/*"`); the chosen image is
  downscaled (≤1280 px longest side, JPEG q0.8) and inserted at the cursor as
  `![<sanitized filename>](data:image/jpeg;base64,…)`; the edit autosaves; the status line
  reports the embedded size and warns when the note grows past ~700 KB (GitHub contents-API
  comfort zone). Re-attaching the same file works (input value cleared).
- **AC2** — `renderMarkdown` renders `![alt](src)` to `<img src alt>` **only** when `src` passes
  `safeImgSrc` (https: or base64 raster data URI); alt is escaped; `javascript:`, `data:text/html`,
  `data:image/svg+xml`, `http:` and non-base64 data URIs render as inert escaped text and are
  never re-parsed as links. `loading="lazy"` on https srcs only.
- **AC3** — the embedded image displays in the notepad Preview and in topic bodies
  (`max-width: 100%`), and appears in the R-0076 PDF print surface.
- **AC4** — additive, no new dependency, `apps/web` only; suite stays green.

## Changelog

- 2026-07-21 created (Accepted) + implemented. Suite 534/534 (new image security battery in
  markdown.test.mjs). Live-verified end-to-end: synthesized 2400×1800 PNG "Boox page" → embedded
  as 27 KB JPEG data URI (downscaled to 1280×960), alt sanitized, autosaved, survived reload,
  rendered in Preview at container width, and appeared complete in the PDF print surface.
  Found-and-fixed during verification: `loading="lazy"` on an offscreen data: URI never loads
  (complete=false, 0×0) — lazy is now https-only.
