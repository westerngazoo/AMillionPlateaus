# SPEC-0028 — Cross-cutting resources (thread a book across topics by URL)

- **Status:** Implemented
- **Realizes:** R-0028
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** SPEC-0023 (`renderStudyResources` + `study.js`), SPEC-0027 (`seed_resource`), SPEC-0014 (`add_resource`), SPEC-0019 (`openPlateau`)
- **Module(s):** `apps/web/src/study.js` (+ `study.test.mjs`) — pure `normalizeUrl`/`crossLinks`; `apps/web/src/main.js` — "Also covers" rows + multi-pin on the add form; `apps/web/index.html` — the multi-pin control; `apps/web/src/seeds.js` (+ `seeds.test.mjs`) — one example book on two topics. **No Rust/wasm/CRDT/GA change; resources stay single-anchor.**

## 1. Motivation

R-0028: a book that spans topics should read as one cross-cutting source.
Resources are single-anchor; thread them by **shared URL** in presentation, plus
a small multi-pin convenience, over the existing `add_resource`/`seed_resource`.

## 2. Design

### 2.1 `study.js` — pure URL threading

```js
// Normalize for "same book" grouping: http(s) only (else "" → never groups);
// lowercase scheme+host, strip trailing slashes, keep path+query. Pure.
export function normalizeUrl(uri = "") {
  const s = String(uri).trim();
  if (!/^https?:\/\//i.test(s)) return "";
  try {
    const u = new URL(s);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return "";
  }
}

// Other plateaus whose resources share this URL (the "Also covers" set).
// Deterministic: excludes currentPlateauId, sorted by topic name, one row per
// plateau (max vote_count kept for an optional ●N). Empty/unsafe URL → [].
export function crossLinks({ resources = [], plateaus = [], uri, currentPlateauId } = {}) {
  const key = normalizeUrl(uri);
  if (!key) return [];
  const nameOf = new Map(plateaus.map((p) => [p.id, p.name]));
  const best = new Map(); // plateauId -> max vote_count
  for (const r of resources) {
    if (normalizeUrl(r.uri) !== key || r.plateau_id === currentPlateauId) continue;
    if (!nameOf.has(r.plateau_id)) continue;
    const prev = best.get(r.plateau_id);
    if (prev === undefined || r.vote_count > prev) best.set(r.plateau_id, r.vote_count);
  }
  return [...best.entries()]
    .map(([id, count]) => ({ id, name: nameOf.get(id), count }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```

Threading is **exact modulo scheme/host-case + trailing slash**: the query string
is part of the key (so `…/x` and `…/x?utm=1` are different books) and the hash is
dropped. No query canonicalization this phase. `●count` is the **strongest marker
on that topic** (max `vote_count`), not a sum — display-only; it never merges the
independent per-marker counts (AC4).

### 2.2 `main.js` — "Also covers" cross-links in the resource row

`renderStudyResources` already filters `doc.to_graph().resources()` to the open
plateau. Fetch the **full** list + plateaus once: `const g = doc.to_graph();
const all = g.resources(); const plats = g.plateaus();` (filter `all` for the
current rows). For each rendered row, compute
`crossLinks({ resources: all, plateaus: plats, uri: r.uri, currentPlateauId: studyPlateau.id })`;
if non-empty, append an **"Also covers:"** line whose entries are `<button>`/`<a>`
controls (text = name + optional `●count`) that call `openPlateau(plats.find(p => p.id === id))`.
Names via `textContent` (inert). No change to ranking/stoning.

### 2.3 `main.js` + `index.html` — multi-pin on the add form (AC3)

Add a collapsed control to `#detail-add-form`:
`<details class="detail-add-also"><summary>Also pin to other topics</summary>
<div id="detail-add-also-list"></div></details>`. `openPlateau` repopulates the
list with a checkbox per **other** plateau (sorted by name, in a `max-height`
scroll box). On submit: build/validate once (the current-plateau pin may surface
`spec.error`), `add_resource` to the current plateau (unchanged), then for each
checked id `add_resource(id, title, kind, uri)` (same URL → they thread by §2.2).
Each extra pin is **best-effort, wrapped in its own try/catch** (parity with the
stone path at `main.js:952` — a stale checkbox id after a sync must not abort the
loop or the post-submit pump/persist/draw). Clear the checks after. Empty
selection = the current single-topic behaviour, untouched.

### 2.4 `seeds.js` — one example book on the Calculus↔Motion thread (AC5)

Two `SEED_RESOURCES` rows, **same URL**, ids `…f6`/`…f7`:

```js
{ id:"…f6", plateau: P.Calculus, kind:"Article", title:"The Feynman Lectures on Physics, Vol. I",
  uri:"https://www.feynmanlectures.caltech.edu/I_toc.html" },
{ id:"…f7", plateau: P.Motion,   kind:"Article", title:"The Feynman Lectures on Physics, Vol. I",
  uri:"https://www.feynmanlectures.caltech.edu/I_toc.html" },
```

So Calculus shows "Also covers: Motion" and vice-versa, and it is the
cross-cutting book the R-0029 "equations of motion" connection will surface.

## 3. Code outline

- `study.js`: `normalizeUrl`, `crossLinks` (~25 lines pure).
- `study.test.mjs`: normalize (http-only, host-lowercased, trailing-slash, query
  kept, junk→""); crossLinks (shares-by-url, excludes current, sorted by name,
  empty/unsafe→[], deterministic).
- `main.js`: full-list fetch + the "Also covers" row; the multi-pin populate (in
  `openPlateau`) + submit loop.
- `index.html`: the `<details>` multi-pin block + CSS (scroll box).
- `seeds.js` (+ `seeds.test.mjs`): the two `…f6/f7` rows (uniqueness test already
  covers them; same-URL is intentional and not an id collision).

## 4. Non-goals

Per R-0028 §4: no schema change (single-anchor); no merged counts; no library
view; no post-hoc topic editing; no fetching. The multi-pin checklist lists the
current plateaus; a huge imported vault makes a long (scrollable) list — that is
acceptable this phase (no search/filter).

## 5. Open questions (resolved here)

- Normalization = http(s)-only + lowercase scheme/host + strip trailing slash +
  keep query (no full canonicalization). §2.1.
- "Also covers" shows a per-topic `●count`. §2.2.
- Multi-pin = a collapsed `<details>` checklist of other plateaus, repopulated on
  open. §2.3.

## 6. Acceptance criteria

Maps to R-0028 AC:

- [ ] AC1 — "Also covers" cross-links open the other topic. *(browser)*
- [ ] AC2 — threaded by normalized URL; pure + deterministic. *(study.test.mjs)*
- [ ] AC3 — multi-pin adds the link to current + selected topics. *(browser)*
- [ ] AC4 — per-topic stone counts independent (one marker per topic). *(by design;
      browser: stone on one topic doesn't change the other)*
- [ ] AC5 — seeded Feynman book on Calculus + Motion threads. *(browser)*
- [ ] AC6 — `crossLinks`/`normalizeUrl` pure + unit-tested. *(node --test)*
- [ ] AC7 — additive JS-only; links via `safeHref`; no fetch; suites green. *(diff
      + suites)*
- [ ] AC8 — browser: Calculus shows "Also covers: Motion", click → Motion. *(browser)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Group by **normalized URL**, pure in `study.js` | One "same book" rule, browser-free + testable; reuses the resource list the view already has |
| 2026-06-15 | Multi-pin = N `add_resource` calls sharing the URL | No schema change; each topic owns its marker/stones; threads via §2.2 |
| 2026-06-15 | Seed the Feynman text on Calculus + Motion | Demonstrates threading on first run + feeds the R-0029 connection view |

## Changelog

- 2026-06-15 created (Draft) — pure URL threading + "Also covers" links + multi-pin
  + a seeded cross-cutting book. Pending architect review, then `Accepted`.
- 2026-06-15 architect design review: **APPROVE-WITH-NITS** (no core change, per-topic
  stoning preserved, `normalizeUrl` pure/safe in node+browser, seed ids `…f6/f7`
  free, injection-safe all confirmed). Folded: `crossLinks` sort gains an **id
  tiebreak** (determinism); the multi-pin loop is **best-effort per-id try/catch**
  (parity with the stone path); clarified threading is exact-modulo-(scheme/host-
  case+trailing-slash) with query part of the key, and `●count` is the strongest
  marker (not a sum). **Status → Accepted.**
- 2026-06-15 implemented + browser-verified. `study.js` `normalizeUrl`/`crossLinks`
  (+ tests); `main.js` "Also covers" rows + the multi-pin checklist/submit;
  `index.html` control + CSS; seeds `…f6/f7` (Feynman on Calculus + Motion). 194
  JS tests; cargo/clippy/fmt green & unchanged (no `crates/` diff). Browser: 7
  markers, Calculus's Feynman row showed "Also covers: Motion" → opened Motion;
  multi-pin had 8 topic checkboxes; console clean. QA PASS → R-0028 **Met**.
  **Status → Implemented.**
