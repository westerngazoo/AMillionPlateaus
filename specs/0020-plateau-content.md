# SPEC-0020 — Plateau content: Markdown body + typeset math + a read view

- **Status:** Implemented
- **Realizes:** R-0020
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-08
- **Depends on:** SPEC-0011 (plateau authoring), SPEC-0014 (resources), SPEC-0012 (durable load), SPEC-0005 (render/interaction)
- **Module(s):** `crates/mp-wasm/src/lib.rs` (add `description` arg), `apps/web/src/markdown.js` + `markdown.test.mjs` (NEW), `apps/web/src/katex.js` (NEW, lazy loader), `apps/web/vendor/katex/**` (NEW, vendored), `apps/web/src/plateau.js` (thread body), `apps/web/src/main.js` (form body + read view), `apps/web/index.html` (textarea + detail panel + CSS).

## 1. Motivation

R-0020: a plateau gets an authorable **Markdown body** (text + LaTeX) and a
**read view** that renders it safely. The `description` field already exists and
syncs through the CRDT — this spec (a) lets the client author it, (b) renders it
injection-safely with vendored, lazy KaTeX, and (c) shows it (plus the plateau's
resources) in a detail panel when a lit plateau is opened.

## 2. Design

### 2.1 Data path (the field already syncs)

`PlateauNode.description: String` exists end-to-end: it round-trips through the
CRDT `plateaus` map and is exposed as `PlateauDto.description` to JS. The only
missing link is **authoring from the client**. So:

- **`crates/mp-wasm/src/lib.rs` — `WasmCrdtDoc::add_plateau`** gains a trailing
  `description: &str` parameter:
  ```rust
  pub fn add_plateau(&mut self, name: &str, domain_id: &str,
                     e1: f32, e2: f32, e3: f32, description: &str)
      -> Result<String, JsError> {
      let domain = Uuid::parse_str(domain_id)?;
      let p = PlateauNode::new(name, domain, e1, e2, e3).with_description(description);
      let id = p.id.to_string();
      self.inner.add_plateau(&p)?;
      Ok(id)
  }
  ```
  `seed_plateau` (the deterministic toy seed) is **unchanged** — seed plateaus
  carry no body. Rebuild `apps/web/pkg` via `wasm-pack`.

No change to `mp-domain`, `mp-crdt`, the CRDT root keys, or the DTO (description
is already there).

### 2.2 `markdown.js` — pure, injection-safe Markdown → safe HTML

A **pure** function `renderMarkdown(src) → string` returning **safe HTML** (every
text run HTML-escaped; only tags this function emits appear). main.js assigns it
via `innerHTML`; safety is the function's contract, and the tests target exactly
that.

Supported subset (enough to be legible; auditable):

- `#`…`######` → `<h1>`…`<h6>`; blank-line-separated blocks → `<p>`
- `**b**`/`__b__` → `<strong>`, `*i*`/`_i_` → `<em>`, `` `c` `` → `<code>`
- `- `/`* ` → `<ul><li>`, `1. ` → `<ol><li>`
- ```` ```fence ```` → `<pre><code>` (escaped, no highlighting)
- `[text](url)` → `<a href>` **only if** url scheme ∈ {http, https, mailto};
  otherwise rendered as plain text. Always `rel="noopener noreferrer"
  target="_blank"`.
- Math: `$$…$$` (display) and `$…$` (inline) → a placeholder
  `<span class="mp-math" data-display="0|1" data-tex="…ESCAPED…"></span>`.
  Math is extracted **first** so `*`/`_`/`` ` `` inside TeX are not mangled, and
  the TeX is **attribute-escaped** (so `</span><script>` inside math is inert).

**Safety rules (the crux — this is the first untrusted-content→`innerHTML` path
in the app, so the contract is load-bearing; AC4):**

- Every non-tag text run passes through `esc()` (`& < > " '`). Raw HTML in the
  source (`<script>`, `<img onerror=…>`) becomes visible text, never nodes.
- **Only tags this function emits ever appear**, drawn from a fixed allowlist:
  `{h1…h6, p, strong, em, code, pre, ul, ol, li, a, span}`. The only attributes
  emitted are `href`/`rel`/`target` (on `a`) and `class`/`data-display`/`data-tex`
  (on `span.mp-math`). `class`/`data-display` are **fixed literals** the renderer
  chooses (never copied from input); `data-tex` and `href` are the only
  input-derived attribute values and are attribute-escaped via `esc()`.
- **`href`/`uri` scheme check is applied to the control-stripped url** (architect
  finding 2): strip all C0 controls + space (`[\x00-\x20]`) **first** — so
  `java\tscript:`, `\x01javascript:`, ` javascript:` cannot sneak through the
  prefix test the way `.trim()` alone would let an interior control char — then
  require the scheme ∈ {http, https, mailto}. `href` is emitted **only** on a
  positive match; otherwise the link renders as plain text. `safeHref` is the
  single chokepoint, reused for **both** body links **and** resource `uri`s.

```js
// markdown.js — pure, injection-safe Markdown→HTML for plateau bodies (SPEC-0020).
// Output is SAFE HTML: all text escaped, only allowlisted tags appear, links
// scheme-whitelisted, math handed off as inert placeholders. Bodies arrive from
// untrusted synced/imported peers — this must never be an injection vector.
const SAFE_SCHEMES = /^(https?:|mailto:)/i;
export function esc(s) { return String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function safeHref(url) {
  const u = String(url).replace(/[\x00-\x20]/g, ""); // strip C0 controls + space (WHATWG-ish) BEFORE the scheme test
  return SAFE_SCHEMES.test(u) ? u : null;                // emit href only on a positive match
}
export function renderMarkdown(src) { /* extract math → block parse → inline parse, all via esc(); links via safeHref */ }
```

`markdown.test.mjs` (node, no DOM) asserts:
- headings/lists/emphasis/code/links render as expected; deterministic output;
- **structural allowlist (finding 1):** scan the output's tags + attributes and
  assert tag-names ⊆ the allowlist above and attribute-names ⊆ the allowed set —
  "safe by construction" becomes a *checked* invariant, not just example-based;
- `<script>alert(1)</script>` → escaped text, never a node;
- **`safeHref` directly:** `javascript:`, `data:`, `vbscript:`, `java\tscript:`,
  `\x01javascript:`, `&#106;avascript:` → `null` (plain text, no `href`);
  `http(s)`/`mailto` → passed through. Covers both body links and resource `uri`s
  (finding 5);
- `$E=mc^2$` → a `.mp-math` span carrying the escaped TeX; a `</span><script>`
  payload inside `$…$` stays inert **as an escaped attribute value** (not a
  sibling node) (finding 3);
- a `$…$` containing `*`, `_`, and `` ` `` round-trips into one `data-tex`
  unmangled (math extracted before inline parsing).

### 2.3 `katex.js` — vendored, lazy math typesetting

```js
// katex.js — lazy, OFFLINE math typesetting from VENDORED KaTeX (SPEC-0020).
// No CDN, no network: assets live in apps/web/vendor/katex. Loaded once, on first
// use. If the asset is somehow missing, fall back to showing the raw $tex$ text —
// never throw, never block the read view.
export async function typesetMath(root) {
  let katex;
  try { katex = (await import("../vendor/katex/katex.mjs")).default; ensureCss(); }
  catch { return; } // fallback: placeholders already hold the raw TeX as text
  for (const el of root.querySelectorAll(".mp-math")) {
    const tex = el.getAttribute("data-tex") ?? "";
    try { katex.render(tex, el, { displayMode: el.getAttribute("data-display") === "1",
                                  throwOnError: false, trust: false }); }
    catch { el.textContent = tex; } // never break the panel
  }
}
```

`ensureCss()` injects a `<link rel="stylesheet" href="vendor/katex/katex.min.css">`
once (the CSS references vendored `fonts/` by relative URL). The placeholder's
fallback text is the raw TeX, so with no KaTeX the reader still sees `E=mc^2`.

**Vendored assets** under `apps/web/vendor/katex/`: `katex.mjs` (ESM),
`katex.min.css`, and `fonts/*.woff2`. **Web-root assumption (finding 7):** the
static server serves `apps/web/` as root, so `import("../vendor/katex/katex.mjs")`
resolves relative to `apps/web/src/katex.js` → `apps/web/vendor/katex/katex.mjs`,
and `<link href="vendor/katex/katex.min.css">` (relative to `index.html` at root)
makes the CSS's relative `fonts/*.woff2` URLs resolve to
`apps/web/vendor/katex/fonts/`. **`VENDOR.md`** records the pinned KaTeX version
and that **woff2-only** is a deliberate modern-browser scope (no `.woff`/`.ttf`);
the AC5 "graceful fallback" is the raw-TeX text path, not a font fallback.

### 2.4 `plateau.js` — thread the body

`buildPlateau({ name, domain, e1, e2, e3, description })` adds `description`
(string, default `""`, not trimmed — bodies keep their formatting). Validation
unchanged otherwise. Returned spec carries `description`. **The empty body is
stored verbatim as `""`** (finding 6) — the `_No description yet._` placeholder in
§2.5 is a **render-time** substitution only, never persisted or synced.

### 2.5 `main.js` — author + read

- **Draft form:** read `#dp-body` (a textarea); pass through
  `doc.add_plateau(spec.name, spec.domain, spec.e1, spec.e2, spec.e3, spec.description)`.
  Clear `#dp-body` on submit alongside `#dp-name`. A blank textarea →
  `add_plateau(…, "")` → `with_description("")` → stored `""` (current behavior
  unchanged).
- **Read view:** the existing canvas click handler already hit-tests the nearest
  lit plateau, sets presence, and signs the traversal. Additionally, on a hit it
  **opens the detail panel** `openPlateau(p)`:
  ```js
  function openPlateau(p) {
    detailName.textContent = p.name;
    detailBody.innerHTML = renderMarkdown(p.description || "_No description yet._");
    typesetMath(detailBody);                       // lazy KaTeX, fire-and-forget
    const rs = doc.to_graph().resources().filter(r => r.plateau_id === p.id);
    renderResourceList(detailResources, rs);       // title · kind · safe link
    detail.hidden = false;
  }
  ```
  Reading does not mutate the graph/reach; it is pure presentation over the DTO.
  A close button hides the panel. The plateau's `position`/DTO already carry
  `description`.
- `renderResourceList` builds DOM with `textContent` + `safeHref` (kind as a
  small label; the uri as an `http(s)`-only link, else inert text).

### 2.6 `index.html` — textarea + detail panel

- A `#dp-body` `<textarea>` row in the Draft-plateau form (optional; placeholder
  "Notes, math with $…$ — Markdown").
- A `#plateau-detail` panel (like the existing overlays): `#detail-name` (h2),
  `#detail-body` (rendered MD), `#detail-resources` (list), a close button.
  Styled for readable prose (max-width, line-height); `.mp-math` inline vs
  display spacing. Sits beside/over the map; z-index below the tutorial.

## 3. Code outline

Rust: +1 param on one wasm fn (+ pkg rebuild). JS: `markdown.js` (~90 lines
pure) + `markdown.test.mjs`, `katex.js` (~30 lines), `plateau.js` (+1 field),
`main.js` (~40 lines: form wiring + `openPlateau`/`renderResourceList` + close),
`index.html` (textarea + panel + CSS). Vendored KaTeX assets.

## 4. Non-goals

Per R-0020 §4: no WYSIWYG; no editing existing bodies; no image-asset bundling
(inline image embeds render as a labeled placeholder); no full CommonMark; no
per-character CRDT. No GA/reachability/root-key/identity change.

## 5. Open questions (resolved here)

- Click a lit plateau → opens the read view **and** still signs the traversal
  (visiting = reading). §2.5.
- In-repo Markdown subset renderer + vendored KaTeX only for math (not a whole MD
  lib). §2.2–2.3.
- Detail panel beside/over the map, below the tutorial z-index. §2.6.

## 6. Acceptance criteria

Maps 1-to-1 to R-0020 AC:

- [x] AC1 — body authored from client, syncs via CRDT, persists across reload.
      *(`description` rides the serialized `PlateauNode` in the CRDT `plateaus`
      map; wasm test `plateau_body_round_trips_through_the_doc` proves
      add_plateau → to_graph DTO; browser: drafted body rendered after the draw.)*
- [x] AC2 — Draft form body textarea → `buildPlateau` → `add_plateau(description)`
      → `with_description`; empty body still valid. *(Browser: drafted "Pythagoras"
      with a math body; the trailhead's empty body shows the render-time
      placeholder, stored `""`.)*
- [x] AC3 — opening a lit plateau shows name + rendered MD (typeset math) +
      anchored resources; reading does not edit graph/reach. *(Browser: clicking a
      lit plateau opened the panel — h2 + bold + list + 4 typeset equations +
      resources; `openPlateau` reads the DTO, mutates nothing.)*
- [x] AC4 — `renderMarkdown` pure + unit-tested; hostile input (`<script>`,
      `javascript:` links, math-attribute breakouts) neutralized; links scheme-
      whitelisted. *(`markdown.test.mjs`, 12 cases incl. the structural
      tag/attribute allowlist + `safeHref` control-strip battery.)*
- [x] AC5 — KaTeX vendored in-repo, lazy-loaded, graceful raw-`$…$` fallback; no
      runtime CDN/network. *(`apps/web/vendor/katex` + `VENDOR.md`; browser:
      `katexRendered: 4` typeset spans, no network, no console errors.)*
- [x] AC6 — additive; no GA/root-key/reputation/identity/sync/persistence change;
      existing tests green. *(Only `WasmCrdtDoc::add_plateau` gained a param;
      root keys unchanged; 147 JS + 9 wasm green.)*
- [x] AC7 — all suites green; browser: draft a body w/ an equation, open the read
      view (rendered prose + typeset math), body syncs, no console errors.
      *(`node --test` 147, `cargo test --workspace`, `wasm-pack --node` 9, clippy
      host+wasm32, fmt; preview console error-clean.)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-08 | `renderMarkdown` returns escaped-by-construction safe HTML; math as inert `data-tex` placeholders typeset post-hoc | Cleanly splits the pure/testable MD→HTML from the impure DOM/KaTeX step; node-testable incl. XSS |
| 2026-06-08 | Only `WasmCrdtDoc::add_plateau` gains `description`; `seed_plateau` unchanged | The body is user-authored; seed plateaus have none |
| 2026-06-08 | Vendored KaTeX (`katex.mjs` + css + woff2 fonts), lazy `import()`, raw-TeX fallback | Offline-true (owner-chosen); no network; never breaks the panel |
| 2026-06-08 | Click opens the read view and still signs the traversal | Visiting a topic is reading it; preserves R-0010/R-0016 behavior |

## Changelog

- 2026-06-08 created (Draft) — pending architect review, then Accepted.
- 2026-06-08 implemented + browser-verified. New: `markdown.js` (injection-safe
  renderer) + `markdown.test.mjs` (12), `katex.js` (lazy loader), vendored
  `vendor/katex/**` + `VENDOR.md`; `WasmCrdtDoc::add_plateau` gained `description`
  (+ wasm round-trip test + 5 test-caller updates, pkg rebuilt); `plateau.js`
  threads the body; `main.js` form textarea + `openPlateau` read view; `index.html`
  textarea + detail panel + CSS. All gates green (147 JS, workspace + wasm-pack 9,
  clippy host+wasm32, fmt). Browser: KaTeX typeset 4 equations offline, console
  clean. **NB:** browser re-verification after a `pkg` rebuild needs a cache-bust
  (fresh port) — the browser otherwise reuses the old `.wasm`. **Status →
  Implemented.**
- 2026-06-08 architect design review: **APPROVE-WITH-NITS, no blocking issues**
  (data path already real+tested; +1 wasm param correct; pure/impure split clean).
  Folded: structural tag/attribute **allowlist test** (finding 1); `safeHref`
  strips C0 controls before the scheme test + is unit-tested directly and reused
  for resource `uri`s (findings 2 & 5); `data-tex`/`href` attribute-escaped, math
  payload inert as an escaped attribute (finding 3); empty body stored as `""`,
  placeholder is render-time only (finding 6); web-root assumption + woff2-only
  scope pinned, KaTeX `trust:false` (findings 4 & 7). **Status → Accepted.**
