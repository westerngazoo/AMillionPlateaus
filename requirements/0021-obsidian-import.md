# R-0021 — Obsidian vault importer: turn real notes into a world

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-08
- **Depends on:** R-0017 (mp-host native CLI), R-0008 (geometric graph store), R-0020 (plateau body — the importer fills it), R-0012 (browser-durable load)
- **Realized by:** SPEC-0021 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A real Obsidian vault — a folder of Markdown notes joined by `[[wikilinks]]` —
**is** a knowledge graph already. This requirement imports one into A Million
Plateaus: each note becomes a **plateau** (its name the title, its Markdown the
body, R-0020), each `[[wikilink]]` becomes a **bridge**, and PDFs / external
media links become **resources**. Each note is placed in the GA concept-space by
a **deterministic** reading of its text (formal / physical / creative signal), so
maths notes cluster on one axis and physics notes on another, and a transversal
topic (calculus) lands between them. The importer runs in `mp-host` and emits a
CRDT save-blob; a **browser "Import a world"** control loads that blob so the
vault appears in the fog-world — the visitor's own physics curriculum, explorable
as islands and bridges.

## 2. Rationale

The owner has a real vault (~600 notes: algebra, linear algebra, calculus, the
*mecánica de Londoño* mechanics chain, plus CS) whose `[[wikilinks]]` already
encode prerequisite structure. Hand-authoring that world plateau-by-plateau is
absurd when the structure exists on disk. `mp-host` is the right home — it has
filesystem access, already builds `PlateauNode`/`Bridge`/`Resource` and persists
through `CrdtStore`, and its `merge` path already proved an
independently-built replica converges. Mapping is direct: note→plateau,
`[[link]]`→bridge, media→resource, text→position. Keeping the importer
**deterministic** (a pure function of the vault bytes, with stable UUIDs) makes
re-import **idempotent/convergent** and unit-testable — and keeps the pure crates
pure (no async, no network, no model calls; AI-assisted positioning is a later,
separate pass under R-0022).

## 3. Acceptance criteria

- **AC1 — Notes become plateaus.** `mp-host import <vault-dir> <out.bin>` walks a
  directory tree of `.md` files and produces a CRDT save-blob in which **each
  note is a plateau**: `name` = the note's title (filename without extension),
  `description` = the note's Markdown body (R-0020). Non-`.md` files are not
  plateaus.

- **AC2 — Wikilinks become bridges.** An Obsidian `[[Target]]` (or
  `[[Target|alias]]`) reference in note A whose **target resolves to another
  imported note** (by filename, Obsidian-style, case-insensitive) creates a
  **bridge** A→Target. A link whose target is not an imported note (e.g. an
  image) creates **no** bridge. Bridges use the canonical `Bridge::between`
  (rotor computed in Rust — even-grade invariant preserved).

- **AC3 — Media becomes resources.** A `.pdf` reference → a `Resource`
  (`kind = Paper`); an external `http(s)` link → a `Resource` (`Video` for
  youtube/vimeo hosts, else `Article`), anchored to the note's plateau. Inline
  image embeds (`![[img.png]]`) remain in the body as a labeled placeholder
  (image-asset bundling is out of scope).

- **AC4 — Deterministic GA positioning + domain.** Each note's position is a
  **pure function of its text**: a formal/physical/creative keyword signal →
  `normalize(f·e1 + p·e2 + c·e3)` (Grade-1 guaranteed; a no-signal note falls
  back to a default on-axis position). The dominant axis selects the note's
  domain. Where a sibling `.canvas` provides coordinates, they MAY seed position
  instead (optional). Plateau/bridge/resource **UUIDs are derived
  deterministically** from the note path (UUIDv5), so **re-importing the same
  vault yields the same graph** and merging is a no-op (idempotent/convergent).

- **AC5 — Pure + tested.** Parsing (titles, `[[links]]`, media, body),
  link-resolution, and positioning are **pure functions, unit-tested** in Rust;
  a small **fixture vault** under the crate tests the end-to-end walk
  (notes→plateaus, links→bridges, media→resources, stable ids). No async, no
  network; the only side effects (read the dir, write the blob) live in
  `mp-host`.

- **AC6 — Bring it into the browser.** A browser **"Import a world"** control
  takes a save-blob (the importer's output, or any `WasmCrdtDoc.save()` blob),
  **merges** it into the current world (CRDT union — keeps what's already there),
  **persists** to IndexedDB, and **redraws**, so the imported plateaus appear and
  their bodies are readable (R-0020). A malformed/oversized blob → an inline
  error, **never an uncaught exception**.

- **AC7 — Round-trip demonstrated.** Importing the fixture vault yields the
  expected plateaus + bridges + resources; `mp-host stats <db>` (after a
  `merge`) reflects the counts; and in the browser, loading the blob renders the
  imported plateaus with their Markdown bodies and `[[link]]`-derived bridges —
  closing the loop with R-0020.

- **AC8 — Green across all suites.** `cargo test --workspace` (incl. the importer
  + fixture tests), `node --test apps/web/src/*.test.mjs` (incl. the import-world
  control), `wasm-pack test --node`, clippy `-D warnings` (host + `wasm32`), and
  `cargo fmt --all --check` all green; the browser import shows the vault with no
  uncaught console errors.

## 4. Constraints & non-goals

- **Deterministic, pure importer.** No model calls, no network, no async in the
  pure crates; UUIDv5 from note path for stable, convergent ids. AI-assisted
  domain/position classification is a **separate** later pass (R-0022), not this.
- **`mp-host` owns the filesystem.** The vault walk + blob write live in the
  native CLI; the graph construction uses `mp-domain` constructors; the blob is a
  standard `CrdtDoc::save()` (browser-loadable).
- **Reuse the merge path.** The browser "Import a world" performs a CRDT merge
  (the R-0018/R-0004 union), not a destructive replace — importing adds to the
  world.
- **Non-goals:** bundling/serving the vault's ~1000 images (placeholders for
  now); two-way sync back to Obsidian; live-watch/re-import on change; perfect
  CommonMark fidelity (the R-0020 safe subset is what renders); AI classification
  of domain/position (R-0022); positioning by full graph-layout (keyword-signal
  is the v1 heuristic).

## 5. Open questions

- **Domain set.** Map notes onto the existing domains (Mathematics/Music) plus a
  new **Physics** domain, or a small fixed set derived from signal axes? Leans:
  signal axes (Formal/Physical/Creative) drive position; domain = dominant axis,
  introducing Physics as the e2 domain. Spec decides.
- **Concept labels on bridges.** Use the link alias / target name / a generic
  label? Leans: alias if present else target name. Cosmetic; spec decides.
- **Import target.** `import` writes only a blob (then `merge` persists), vs
  `import` writing redb directly. Leans: blob out (composes with existing
  `merge`); spec confirms.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-08 | Importer lives in `mp-host`, emits a `CrdtDoc::save()` blob | mp-host has FS + builds domain types + persists; blob is browser-loadable and composes with `merge` |
| 2026-06-08 | note→plateau, `[[link]]`→bridge, pdf/ext-link→resource | The vault already encodes this structure; the mapping is direct |
| 2026-06-08 | Deterministic positioning (keyword signal) + UUIDv5 ids | Pure, testable, idempotent/convergent re-import; AI positioning deferred to R-0022 |
| 2026-06-08 | Browser "Import a world" = CRDT merge, not replace | Importing adds to the world; reuses the audited union path |

## Changelog

- 2026-06-08 created (Accepted) — depends on R-0020. Pending SPEC-0021 + architect review.
- 2026-06-08 **QA sign-off — PASS → Status: Met.** All eight acceptance criteria
  covered by passing tests; all merge gates green. Suites: `cargo test --workspace`
  GREEN (incl. `mp-host` = 6 host + 8 import); `node --test apps/web/src/*.test.mjs`
  = 147 pass; `wasm-pack test --node` = 9 pass; `cargo fmt --all --check` clean;
  clippy host (`--workspace --all-targets -D warnings`) and wasm32
  (`-p mp-wasm --target wasm32-unknown-unknown -D warnings`) both clean.
  CLI round-trip exercised: `import` of the fixture vault → "6 notes · 3 bridges ·
  3 resources"; `merge` + `stats` → "6 plateaus · 3 bridges · 3 resources"; merging
  two independent imports + a re-merge of the same blob keeps stats at 6/3/3
  (idempotent/convergent, R-0004). Adversarial graph inspection confirmed: 2
  distinct path-keyed `Calculus` plateaus; bridges Calculus→Limits, Calculus→
  Mechanics, Mechanics→Calculus (all even-grade rotors); `[[handout.pdf]]`→Paper
  (no bridge), Khan link→Article, youtube link→Video; domains by dominant axis
  (Calculus=MATH, Mechanics=PHYSICS, Rhythm=MUSIC, no-signal Stub=MATH via the
  `(1,0,0)` short-circuit before `normalize`). `import.rs` verified pure (no I/O);
  `merge_bytes` present in the rebuilt `apps/web/pkg`. AC7 browser half + AC8
  console-clean accepted as recorded manual evidence (SPEC-0021 §6 / changelog).
  Non-blocking note: SPEC-0021 §2.6's "byte-reproducible blob" claim overstates —
  two imports of the same vault produce non-identical Automerge bytes (per-run
  actor/change identity); convergence is id-keyed (proven), which is what AC4/AC7
  actually require. Owner holds final sign-off.
