# R-0028 — Cross-cutting resources: a book that spans topics

- **Status:** Met (2026-06-15)
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** R-0014 (resources/markers + `add_resource`), R-0023 (Study view + resource list), R-0027 (`seed_resource` + example resources), R-0019 (`centerOn`/open-a-plateau for the cross-links)
- **Realized by:** SPEC-0028
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A real book/link often covers **several topics** (a mechanics text touches both
Calculus and Motion). Today a resource anchors to **one** plateau, so the same
book pinned on two topics looks like two unrelated markers and nothing says
"this is the same source, spanning both." This requirement makes a resource that
appears on multiple plateaus — **identified by its shared link (URL)** — read as
**one cross-cutting book**: on any topic it covers, the resource row shows
**"Also covers: \<topic\> · \<topic\>"** as links you can click to jump to those
topics. Optionally, when adding a resource you can **pin it to several topics at
once**. The plateau bodies remain the per-topic **summaries** (R-0020); the book
is the shared source threaded across the islands it covers.

## 2. Rationale

The owner asked for "a book … linked across all, just a link, and the notes are
summaries." The honest, additive way to get this **without** a risky core schema
change (and without collapsing per-topic stoning into one global count) is to
keep resources single-anchor but **thread by URL**: the same link on Calculus and
Motion is recognized as one book and cross-linked in the UI. This preserves the
decentralized model — each topic's community independently stones the book *for
that topic* — while making the spanning visible and navigable. It is pure
presentation + a small add-convenience over the existing `add_resource`/
`seed_resource` primitives; no GA/CRDT/Rust change.

## 3. Acceptance criteria

- **AC1 — "Also covers" cross-links.** In the Study view, a resource whose URL
  also appears on **other** plateaus shows an **"Also covers: …"** line listing
  those other topics by name. Each is a control that **opens that topic's** Study
  view (reusing the existing open-plateau path). A resource unique to one plateau
  shows no such line.

- **AC2 — Threaded by URL, deterministic.** Two resources are "the same book"
  iff they share a normalized non-empty URL. Grouping is **pure and
  deterministic** (case/trailing-slash-normalized; empty/unsafe URLs never group
  and never cross-link). The cross-link list excludes the current plateau and is
  sorted by topic name.

- **AC3 — Pin to several topics at once (add convenience).** The add-a-resource
  form offers an optional way to also pin the link to **other topics** (a small
  multi-select of plateaus); submitting creates the marker on the current plateau
  **and** each selected topic via the existing `add_resource` path (one marker per
  topic, sharing the URL → they thread by AC1). Leaving it empty is the current
  single-topic behaviour, unchanged.

- **AC4 — Per-topic stoning preserved.** Each topic keeps its **own** marker and
  its **own** stone count/state for the shared book — relevance to Calculus and
  relevance to Motion are stoned independently (R-0015). Nothing merges the
  counts; the "Also covers" line may show each topic's count.

- **AC5 — Seeded example.** A real cross-cutting book is seeded on **two** topics
  that share the "equations of motion" thread (Calculus **and** Motion) so the
  feature is visible on first run — the same URL on both, via `seed_resource`
  (fixed ids), so it threads and stays convergent/idempotent (R-0027).

- **AC6 — Pure + tested.** The grouping/normalization is a **pure** function —
  `crossLinks({ resources, plateaus, uri, currentPlateauId }) → [{id,name}]` (or
  similar) — **unit-tested**: shares-by-URL, normalization, excludes-current,
  empty/unsafe-URL never groups, deterministic order. No DOM/network/GA in the
  pure layer.

- **AC7 — Additive, JS-only, safe.** No Rust/wasm/CRDT/GA change (reuses
  `add_resource`/`seed_resource` + the existing resource list); the resource
  schema stays single-anchor. Cross-link labels render as **text**, the link via
  the existing `safeHref` chokepoint (no injection); nothing is fetched. Existing
  suites stay green.

- **AC8 — Green + browser-verified.** All suites green; in the browser, opening
  **Calculus** shows the seeded book with "Also covers: Motion", clicking it opens
  **Motion** (where the same book shows "Also covers: Calculus") — with no
  uncaught console errors.

## 4. Constraints & non-goals

- **Thread, don't merge.** Resources stay single-anchor; "one book across topics"
  is a URL-grouping presentation + a multi-pin convenience, not a schema change.
- **No fetching.** Same R-0023 boundary — title/kind/url only.
- **Non-goals:** a global "library" view of all books; deduping/merging stone
  counts across topics; editing a book's topic set after the fact (re-pin/add as
  needed); per-topic page ranges or notes on the book (the plateau body is the
  per-topic summary); changing the resource schema or kinds.

## 5. Open questions

- **URL normalization depth.** Lean: lowercase host + strip a trailing slash +
  ignore an empty/unsafe URL. Not full canonicalization (no query-param sorting).
  Spec fixes the rule.
- **Show per-topic counts in "Also covers".** Lean: yes, a small `●N` per topic
  (cheap, informative). Spec decides.
- **Multi-pin UI shape.** Lean: a compact checklist of the *other* seeded/known
  plateaus in the add form, collapsed by default. Spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Thread cross-cutting books by **shared URL**, keep resources single-anchor | Avoids a risky core/CRDT migration AND preserves per-topic stoning (relevance is topic-specific); purely additive over existing bindings |
| 2026-06-15 | "Also covers" cross-links reuse the open-a-plateau path | One navigation primitive; clicking a topic name studies it (consistent with Travel/R-0019) |
| 2026-06-15 | Multi-pin = N markers sharing a URL (one per topic) | Each topic owns its marker + stones; the URL threads them — honest to the decentralized model |

## Changelog

- 2026-06-15 created (Accepted) — the owner's "a book linked across all topics";
  threaded by URL over single-anchor resources, plus a multi-pin convenience and
  a seeded example on the Calculus↔Motion thread. Pending SPEC-0028 + architect.
- 2026-06-15 QA sign-off (below) — all 8 AC met; Status → Met.

## QA — R-0028 Cross-cutting resources: a book that spans topics

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) | Result |
|----|---------|--------|
| AC1 — "Also covers" cross-links, each opens that topic; unique resource shows no line | `main.js:1052–1076` (`crossLinks` → `res-also` line, per-entry `<button>` → `openPlateau`); manual browser (Calculus row "…Vol. I ● 0 ＋ stone Also covers: Motion", click opens Motion) | PASS |
| AC2 — threaded by normalized URL, pure + deterministic, excludes current, name-sorted, empty/unsafe never groups | `study.test.mjs`: "normalizeUrl: http(s)-only, lowercases…drops hash"; "crossLinks: other topics…excludes current, sorted by name, with max count"; "crossLinks: empty/unsafe URL never groups; unique book → []"; "crossLinks is deterministic across two calls" (4 cases) | PASS |
| AC3 — multi-pin adds current + each checked topic via `add_resource`, best-effort per-id | `main.js:1093–1112` (`renderAlsoPin` checklist of OTHER plateaus) + `main.js:1129–1138` (current pin then per-checked `add_resource` in its own try/catch); manual browser (8 other-topic checkboxes) | PASS |
| AC4 — per-topic stoning preserved; counts never merged | by design: one marker per topic via N independent `add_resource`; `crossLinks` only reads `vote_count` and keeps `max` for display, writes nothing (`study.js:100–106`) | PASS |
| AC5 — seeded Feynman book on Calculus + Motion, same URL, fixed ids, idempotent | `seeds.js:101–114` (ids `…f6`/`…f7`, `P.Calculus`/`P.Motion`, same `feynmanlectures.caltech.edu/I_toc.html`); `seeds.test.mjs` "every seed id is unique…" covers them; manual browser HUD showed 7 markers (5 prior + 2) | PASS |
| AC6 — `crossLinks`/`normalizeUrl` pure (no DOM/network/GA) + unit-tested | `study.js:79–110` (pure); `study.test.mjs` R-0028 block (normalize + 3 crossLinks cases) | PASS |
| AC7 — additive JS-only; labels as text, link via `safeHref`; no fetch; suites green | `git diff --stat -- crates/` empty; names via `textContent`/`createTextNode` (`main.js:1068,1109`); url via `safeHref` (`main.js:1016`); no `fetch` added; all suites green | PASS |
| AC8 — green + browser-verified (Calculus↔Motion, no console errors) | suites green (below); manual browser per AC1/AC8 evidence | PASS |

### Suites

- `node --test apps/web/src/*.test.mjs` — PASS: tests 194, pass 194, fail 0 (study.test.mjs R-0028 block: 4 cases green).
- `cargo test --workspace` — PASS, unchanged: all result lines `ok`, 0 failed; `git diff --stat -- crates/` empty (no Rust source change).
- `cargo fmt --all --check` — PASS (exit 0, clean).
- `cargo clippy --workspace --all-targets -- -D warnings` — PASS (exit 0, no warnings).

### Gaps / failures

None for R-0028. Note (informational, not a defect of this requirement): the working tree also carries R-0029 changes (`wayfinding.js`/`wayfinding.test.mjs`, `study.js` `bridgeResources` + its tests, and the `main.js:944–977` bridge-detail "Books that span both" block) and a pre-existing `Cargo.lock` `garust-physics` lock update; none regress any R-0028 gate (Rust source diff is empty, all suites green). Browser AC1/AC3/AC5/AC8 evidence accepted as the manual portion per the run brief.
