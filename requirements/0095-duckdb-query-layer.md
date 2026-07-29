# R-0095 — DuckDB-Wasm query layer over a partitioned lens corpus

**Status:** Draft — **not built, deliberately parked.** See _When to build this_ below.
**Theme:** POC — Knowledge content
**Depends on:** [R-0093](0093-lens-bundles.md) (a lens is a portable file), [R-0094](0094-lens-registry.md) (the registry that makes lenses discoverable)

## Why

[R-0093](0093-lens-bundles.md) made a lens a portable `lenses/<id>.json` bundle and
[R-0094](0094-lens-registry.md) added `lenses/index.json` so lenses can be
*discovered* rather than only fetched by id. Both answer "what exists?" and "give me
that one." Neither can answer a question **across** lenses:

- Which lenses cover reflections at all, and how does each formulate it?
- Where do the physics lenses disagree about the order of electromagnetism?
- Which topics appear in twenty lenses but are bridged in none of them?
- What has nobody covered — the holes in the whole published corpus?

Answering those today means downloading every bundle and reducing them in JS. That
is fine for a handful of lenses and hopeless for a real corpus.

## What (the intended design, if built)

1. **Publish a queryable projection.** Alongside each `lenses/<id>.json`, export the
   corpus as **partitioned Parquet** — `lenses/parquet/plateaus/lens=<id>/*.parquet`
   and the same for `bridges` and `resources`. Columnar, partitioned by lens, so a
   query touches only the columns and partitions it needs.
2. **Query it in the browser with DuckDB-Wasm.** A new `apps/web/src/query.js` loads
   DuckDB-Wasm lazily (only when a query view is opened, never at boot) and runs SQL
   over the Parquet files via HTTP range requests — reading footers and the needed
   row groups instead of whole files.
3. **A query surface in the app.** Preset questions first (the four above), with raw
   SQL behind a disclosure for when a preset doesn't fit.

## Acceptance criteria (for whenever it is built)

1. **AC1 — cross-lens answers.** Each preset question returns correct results over a
   corpus of at least 50 lenses without fetching every bundle in full.
2. **AC2 — lazy and boot-safe.** DuckDB-Wasm is never loaded at boot; the app's cold
   start is unchanged, and the query view degrades to a clear message when the
   corpus or the wasm is unavailable.
3. **AC3 — offline-honest.** The query layer is explicitly online-only; it says so
   plainly rather than appearing broken when offline (the rest of the app stays
   offline-first).
4. **AC4 — the corpus is derived, never authoritative.** Parquet is a *projection* of
   the JSON bundles; deleting it loses nothing and it can always be rebuilt. This
   preserves the architecture rule that the graph is the platform.
5. **AC5 — bounded cost.** A preset query transfers materially less than the sum of
   the bundles it reasons over, and that saving is measured, not assumed.

## When to build this — the parking rationale

**Not until there is a corpus.** The registry today has essentially one publisher
(the owner). DuckDB-Wasm is a multi-megabyte dependency whose entire value is
scanning *many* files without fetching them; against a handful of lenses,
`lenses/index.json` is **one fetch** and already answers "what's out there"
instantly. Building it now would add a large dependency that buys nothing
measurable, and would need maintaining against a Parquet export nobody queries.

Build it when either is true:

- **Other publishers appear** in the registry — several people's lenses, so
  cross-lens questions have more than one perspective to compare, or
- **The owner's own corpus outgrows the index** — roughly hundreds of bundles, where
  "which lenses cover X?" stops being answerable from `index.json` alone.

Until then this document exists so the intent is captured and the design isn't
re-derived from scratch. Nothing in the codebase references DuckDB; there is no stub
and no dependency.

## Notes

- The two layers this sits on are built and live: `apps/web/src/lens-bundle.js`
  (`buildLensBundle`, `canonicalJson`) and `apps/web/src/lens-registry.js`
  (`REGISTRY_FILE`, `buildIndexEntry`, `parseIndex`).
- A Parquet export would hang off `buildLensBundle`'s output, so bundles stay the
  single source of truth and the projection is regenerable.
- Deliberately **not** a server: the query runs in the browser against static files,
  keeping the "no authoritative state outside the graph" rule intact.
