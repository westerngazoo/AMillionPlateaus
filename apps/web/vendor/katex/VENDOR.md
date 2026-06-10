# Vendored: KaTeX

- **Library:** [KaTeX](https://katex.org) — fast TeX math rendering for the web.
- **Version:** 0.16.11 (pinned)
- **Source:** the official npm tarball `https://registry.npmjs.org/katex/-/katex-0.16.11.tgz` (`package/dist/`).
- **License:** MIT (KaTeX is MIT-licensed; see the KaTeX project).

## Why vendored (not a CDN / npm dep)

A Million Plateaus is offline-first and decentralized (`DECENTRALIZATION.md`):
"no central server owns the world." Math must render **without a network**, so
KaTeX ships **inside the repo** and is loaded lazily by `apps/web/src/katex.js`
(`import("../vendor/katex/katex.mjs")`) only when a plateau body with math is
first opened (SPEC-0020 / R-0020 AC5). `apps/web` has no bundler/npm — vendoring
static ES modules is the established pattern here.

## What is vendored (and what is not)

- `katex.mjs` — the ESM build (`export { katex as default }`).
- `katex.min.css` — injected once on first use by `katex.js`'s `ensureCss()`.
- `fonts/*.woff2` — **woff2 only** (20 files). This is a deliberate
  modern-browser scope: each `@font-face` lists `woff2` first, so browsers use it
  and never request the absent `.woff`/`.ttf`. The `.js`/`.min.js` (UMD),
  `contrib/`, and non-woff2 fonts from the dist are intentionally **not**
  vendored, to keep the footprint small (~0.9 MB total).

## Graceful fallback

If `katex.mjs` is ever unavailable, `katex.js` swallows the import error and the
Markdown renderer's math placeholders keep showing the **raw `$…$` TeX text** —
the read view never breaks (AC5).

## Updating

Re-fetch the pinned tarball, copy `dist/katex.mjs`, `dist/katex.min.css`, and
`dist/fonts/*.woff2` here, and bump the version above.
