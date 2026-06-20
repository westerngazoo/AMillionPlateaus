# SPEC-0021 — Obsidian vault importer

- **Status:** Implemented
- **Realizes:** R-0021
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-08
- **Depends on:** SPEC-0017 (mp-host CLI + CrdtStore), SPEC-0020 (plateau body), SPEC-0008 (geometric store), SPEC-0012 (browser load)
- **Module(s):** `crates/mp-host/src/import.rs` (NEW, pure parse+build) + `tests/import.rs` + `tests/fixtures/vault/**` (NEW); `crates/mp-host/src/lib.rs` (FS walk + `import`); `crates/mp-host/src/main.rs` (`import` subcommand); `crates/mp-host/Cargo.toml` (uuid `v5`); `crates/mp-wasm/src/lib.rs` (`WasmCrdtDoc::merge_bytes`) + pkg rebuild; `apps/web/src/main.js` + `index.html` ("Import a world").

## 1. Motivation

R-0021: import an Obsidian vault — a folder of `.md` notes joined by
`[[wikilinks]]` — into A Million Plateaus. Each note → a plateau (name + Markdown
body, R-0020); each `[[link]]` → a bridge; PDFs/external links → resources. Each
note is positioned in GA concept-space by a **deterministic** keyword reading of
its text. The importer lives in `mp-host`, emits a `CrdtDoc::save()` blob, and a
browser **"Import a world"** control merges it so the vault appears in the
fog-world.

## 2. Design

### 2.1 Module layout

```
crates/mp-host/src/import.rs       ← NEW  pure: parse → position → build graph
crates/mp-host/tests/import.rs     ← NEW  fixture-vault end-to-end
crates/mp-host/tests/fixtures/vault/*.md ← NEW  tiny deterministic vault
crates/mp-host/src/lib.rs          ← EDIT pub fn import(vault_dir, out) — FS walk only
crates/mp-host/src/main.rs         ← EDIT `import <vault-dir> <out.bin>` subcommand
crates/mp-host/Cargo.toml          ← EDIT uuid features += "v5"
crates/mp-wasm/src/lib.rs          ← EDIT WasmCrdtDoc::merge_bytes(&[u8]) (+ pkg rebuild)
apps/web/src/main.js, index.html   ← EDIT "Import a world" file-picker
```

The pure core (`import.rs`) does **no I/O**: it takes already-read
`(path, contents)` pairs and returns a `KnowledgeGraph`. The only side effects —
walking the directory, reading files, writing the blob — live in `lib.rs`
(`mp-host` already owns the filesystem; the pure crates stay pure).

### 2.2 Parsing (pure)

```rust
struct RawNote { rel_path: String, stem: String, body: String } // rel_path = path under the vault root
struct ParsedNote { rel_path: String, stem: String, title: String, body: String,
                    links: Vec<Link>, media: Vec<Media> }
struct Link { target_stem: String, label: String }      // [[Target]] / [[Target|label]]
enum Media { Pdf(String /*uri*/, String /*title*/), External(String /*uri*/, String /*title*/) }

pub fn parse_note(raw: &RawNote) -> ParsedNote;          // STANDALONE pure fn — unit-tested directly (AC5)
```

- **Title** = the filename stem (Obsidian's note name). **Body** = the file
  contents verbatim (rendered later by R-0020's safe renderer).
- **Wikilinks**: regex `\[\[([^\]]+)\]\]`; split on the first `|` → `(target,
  label)`; `target` keeps only the final path segment, lowercased, `.md`
  stripped, for resolution. An **embed** form `![[...]]` is treated as media
  (image/pdf), never a bridge.
- **Media**: a `[text](url)` or bare `http(s)://…` link → `External` (host
  youtube/youtu.be/vimeo ⇒ later `Video`, else `Article`); any link/target
  ending `.pdf` ⇒ `Pdf`. Inline image embeds (`![[x.png]]`, `![](x.png)`) are
  left in the body (they render as a labeled placeholder — no asset bundling).

### 2.3 Positioning (pure, deterministic)

```rust
// Keyword signal → a Grade-1 direction. Counts case-insensitive keyword hits in
// title+body for each axis, then normalises. No signal ⇒ default to the formal
// axis (most notes are maths/CS). Bilingual (the vault is ES/EN).
fn position_for(text: &str) -> (f32, f32, f32);   // returns a UNIT vector (Grade-1, non-zero)
fn domain_for(e1: f32, e2: f32, e3: f32) -> Uuid; // dominant axis → MATH | PHYSICS | MUSIC
```

- Axis keyword sets (modest, documented; tuned later / AI-assisted in R-0022):
  - **e1 Formal:** algebra/álgebra, calcul/cálculo, theorem/teorema, proof/demostración, matrix/matriz, vector/vectores, function/función, integral, derivative/derivada, set/conjunto, logic/lógica, geometr, linear/lineal, polynomial/polinomio, number/número …
  - **e2 Physical:** physic/física, mechanic/mecánica, force/fuerza, energy/energía, motion/movimiento, mass/masa, quantum/cuántica, wave/onda, field/campo, momentum, magnitude/magnitud, dimension/dimensión …
  - **e3 Creative:** music/música, rhythm/ritmo, melody/melodía, harmony/armonía, chord/acorde, sound/sonido, art/arte, design/diseño, composition/composición …
- `position = normalize(f·e1 + p·e2 + c·e3)`. **The all-zero check happens
  INSIDE `position_for`, before `normalize`** (architect finding 1): `ga::normalize`
  returns its input unchanged when `‖v‖ ≤ EPSILON`, so it does NOT floor a zero
  vector — a no-signal note must short-circuit to `(1,0,0)` (the formal axis)
  itself, guaranteeing a non-zero Grade-1 position. The fixture includes a
  no-signal note to pin this. Normalised so every plateau has comparable
  magnitude under the fog scorer.
- **`.canvas` seeding is OUT of scope for v1** (no canvas parsing) — positioning
  is keyword-signal only; canvas-coordinate seeding is a clean later add.
- **Domains** (UUIDs shared with the web app): `MATH = 111…11`, `MUSIC = 222…22`,
  and a **new** `PHYSICS = 333…33` for the e2 axis. `domain_for` = the dominant
  axis. (Making Physics a *first-class* faced domain in the persona creator is a
  later, separate add — R-0022; the importer only tags the domain id here.
  **Consequence (architect finding 9):** no persona faces `PHYSICS` and there is
  no Physics trailhead, so imported physics-dominant notes start fogged and are
  reachable only by traversing in over a cross-domain bridge — a math/music note
  must link to them, or R-0022 must add the faced domain. AC7's "explorable" is
  read against that.)

### 2.4 Deterministic ids → idempotent re-import

```rust
const NS: Uuid = Uuid::from_u128(0x_4d50_494d_504f_5254_0000_0000_0000_0001); // "MP IMPORT" namespace
fn note_id(rel_path_lower: &str) -> Uuid             = v5(NS, rel_path_lower)   // identity = RELATIVE PATH
fn bridge_id(from: Uuid, to: Uuid, label: &str)      = v5(NS, "{from}|{to}|{label}")
fn resource_id(plateau: Uuid, uri: &str)             = v5(NS, "{plateau}|{uri}")
```

**Plateau identity is the note's relative path** (lowercased, `.md` stripped,
separators normalised), NOT the bare stem (architect finding 2): a real vault has
duplicate filenames across folders (`index.md`, `Derivada.md` in both a calculus
and a mechanics folder), and keying on the stem alone would collapse two distinct
notes into one — losing a note and misrouting its bridges. Path-keyed ids keep
every file its own plateau.

**Link resolution is by name** (Obsidian semantics): build `lower(stem) →
[note_id…]` and resolve `[[Target]]` to the **first** match in path-sorted order
(deterministic). An ambiguous stem (two files, same name) resolves to that stable
pick — documented v1 limitation, not Obsidian's full shortest-unique-path. A
**self-link** (resolves to the linking note) is skipped.

UUIDv5 over these stable keys makes **re-importing the same vault yield identical
ids** → the CRDT merge is a no-op (idempotent, convergent — R-0004). Sorting
before write (§2.6) gives a deterministic *insertion order*; the saved *bytes*
still vary run-to-run (Automerge embeds per-run actor identity), but that doesn't
matter — convergence is id-keyed, not byte-keyed. `uuid` gains the `v5` feature in
`mp-host` (already used by `mp-identity`; workspace feature-unification makes this
standard).

### 2.5 Building the graph (pure)

`build_graph(notes: Vec<RawNote>) -> KnowledgeGraph`:

1. `parse_note` each (§2.2). Build `lower(stem) → [note_id…]` (path-sorted) for
   name resolution; `note_id` itself is keyed on the **relative path** (§2.4).
2. For each note: `PlateauNode::new(title, domain, e1,e2,e3).with_description(body)`,
   id overridden to `note_id(rel_path)`. (Grade-1 preserved — `new` sets position;
   the id override never touches it, exactly as `seed_graph` does.)
3. For each `Link` whose `target_stem` resolves (first path-sorted match): a
   `Bridge::between(from, to, label, Uuid::nil())` with id `bridge_id(...)`.
   Unresolved targets (e.g. images) → **no bridge**; self-links skipped.
4. For each `Media`: `Resource::new(plateau, title, kind, uri, Uuid::nil())`
   (`Pdf→Paper`, `External` youtube/vimeo`→Video` else `Article`), id
   `resource_id(plateau, uri)`, inserted into the graph's **public `resources`
   map** (`g.resources.insert(id, r)` — `KnowledgeGraph` has no `add_resource`,
   only `add_plateau`/`add_bridge`; the map is `pub`). **Same-URI-on-same-plateau
   dedups by design** (architect finding 3): the id keys only `plateau|uri`, so a
   URL cited twice in one note collapses to one resource (later title wins) — a
   deliberate, fixture-pinned dedup. Contributor is nil (import is unsigned; votes
   start at zero, state Floating — derived, R-0015).

All pure; unit-tested without the filesystem.

### 2.6 `lib.rs` — the I/O shell

```rust
pub struct ImportStats { pub notes: usize, pub bridges: usize, pub resources: usize }

/// `import <vault-dir> <out.bin>` — walk *.md under vault-dir, build the graph,
/// write a CrdtDoc save-blob (browser-loadable; compose with `merge` for redb).
pub fn import(vault_dir: &Path, out: &Path) -> Result<ImportStats, ImportError> {
    let notes = read_notes(vault_dir)?;           // recursive read_dir, *.md only — the ONLY I/O
    let g = import::build_graph(notes);
    let mut doc = CrdtDoc::new()?;
    // Sort each set by id before adding, for a DETERMINISTIC INSERTION ORDER
    // (architect finding 5): `g.resources` is a HashMap (random iteration order),
    // so without this the add order varies run-to-run. NOTE (QA): this does NOT
    // make the saved *bytes* identical — Automerge embeds per-run actor/change
    // identity — but it isn't needed to: convergence is id-keyed (re-import is a
    // no-op MERGE), which is the property that matters. Plateaus/bridges sorted
    // too for uniformity.
    for p in sorted_by_id(g.plateaus()) { doc.add_plateau(p)?; }
    for b in sorted_by_id(g.bridges())  { doc.add_bridge(b)?; }
    for r in sorted_by_id(g.resources.values()) { doc.add_resource(r)?; }
    std::fs::write(out, doc.save())?;
    Ok(ImportStats { … })
}
```

`read_notes` walks the tree (hand-rolled recursive `read_dir`; **skips dotdirs**
like `.obsidian`/`.trash`; **only `*.md`** files become notes), returning
`RawNote { rel_path, stem, body }`. A read error on one file is surfaced, not
silently dropped. No new external dep (no `walkdir`). `ImportError` wraps
`io::Error` + `CrdtError` via `thiserror` (library error style, CLAUDE.md).

`main.rs`: add `Some("import") if args.len() == 4 => import(vault, out)`, printing
the `ImportStats`. Then `mp-host merge <db> <out.bin>` persists it natively, and
`mp-host stats <db>` reflects the counts (round-trip, AC7).

### 2.7 Browser "Import a world"

- `crates/mp-wasm/src/lib.rs` — a small binding:
  ```rust
  pub fn merge_bytes(&mut self, bytes: &[u8]) -> Result<(), JsError> {
      let mut incoming = CrdtDoc::load(bytes)?;   // corrupt blob → thrown Error, never panic
      self.inner.merge(&mut incoming)?;           // CRDT union — additive, not replace
      Ok(())
  }
  ```
  Rebuild `apps/web/pkg`.
- `index.html`: an **"Import a world"** toolbar button + a hidden
  `<input type="file" accept=".bin,application/octet-stream">`.
- `main.js`: on file pick → `arrayBuffer()` → `doc.merge_bytes(new Uint8Array(buf))`
  in a try/catch (malformed → inline error, never a throw); then **rebuild
  `DOMAIN_OF`** from `doc.to_graph().plateaus()` (so imported plateaus score on
  traversal), `sync.pump()`, `pumpPeer()`, `persist()`, `draw()`. The imported
  plateaus appear (fogged until reached); clicking a lit one opens its body
  (R-0020). Merge is a **union** — it adds to the current world, never replaces.

## 3. Code outline

Pure `import.rs` (~140 lines: parse, position, build) + fixture test; ~30 lines
of `lib.rs` I/O shell; one `main.rs` arm; one wasm binding (~6 lines) + pkg
rebuild; ~25 lines of `main.js` + a button/input. One Cargo feature flag.

## 4. Non-goals

Per R-0021 §4: no AI classification (R-0022), no image-asset bundling, no
two-way/live sync, no full CommonMark. Physics as a *first-class faced domain*
(persona card + archetype) is deferred — the importer only tags the domain id.
No change to GA/reachability/root keys/reputation.

## 5. Open questions (resolved here)

- Domain set: signal axes drive position; `domain_for` = dominant axis; reuse
  MATH/MUSIC ids + a new PHYSICS id. §2.3.
- Concept label: link alias if present, else the target name. §2.2.
- Import emits a blob; `merge` persists to redb; the browser merges the blob.
  §2.6–2.7.

## 6. Acceptance criteria

Maps to R-0021 AC:

- [x] AC1 — `import <vault> <out.bin>`: each `.md` → a plateau (name=stem,
      description=body); non-`.md` ignored. *(CLI: "6 notes"; `import.rs` test +
      `notes.txt`/`.obsidian` skipped.)*
- [x] AC2 — `[[Target]]`/`[[Target|alias]]` resolving to an imported note →
      a `Bridge::between`; unresolved targets → no bridge. *("3 bridges";
      `build_graph_maps_notes_links_and_media` pins resolved vs `[[Ghost]]`.)*
- [x] AC3 — `.pdf` → Resource(Paper); external http(s) → Video(youtube/vimeo)|Article;
      image embeds stay in the body. *("3 resources"; `parse_note…` +
      `import_fixture…` assert a Video; same-URI dedup test.)*
- [x] AC4 — deterministic keyword-signal position (Grade-1, normalised; no-signal
      → e1); domain = dominant axis; UUIDv5 ids ⇒ idempotent re-import.
      *(`position_for…`, `note_id_is_deterministic…`, `import_is_idempotent…`.)*
- [x] AC5 — parsing/positioning/build are pure + unit-tested; a fixture vault
      tests the end-to-end walk; no async/network. *(`tests/import.rs`, 8 cases +
      `tests/fixtures/vault`.)*
- [x] AC6 — browser "Import a world" merges a blob (CRDT union), persists,
      redraws; malformed blob → inline error, never a crash. *(Browser: 8→14
      plateaus / 9→12 bridges / 0→3 markers, status shown; `merge_bytes` throws on
      a corrupt blob, caught inline.)*
- [x] AC7 — round-trip: fixture import → expected plateaus/bridges/resources;
      `mp-host stats` reflects counts; browser renders imported plateaus + bodies.
      *(Browser: opened an imported plateau's read view showing its Markdown body.)*
- [x] AC8 — all suites green (Rust + JS + wasm + clippy host/wasm32 + fmt); browser
      import shows the vault, no console errors. *(`cargo test --workspace` incl.
      mp-host +8; `node --test` 147; `wasm-pack --node` 9; clippy host+wasm32; fmt;
      console clean.)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-08 | Pure `import.rs` (no I/O) + `lib.rs` FS shell | Keeps parsing/positioning unit-testable; mp-host owns the only side effects |
| 2026-06-08 | Deterministic keyword-signal position + UUIDv5 ids | Pure, testable, idempotent/convergent re-import; AI positioning deferred (R-0022) |
| 2026-06-08 | `import` emits a `CrdtDoc::save()` blob; reuse `merge` + a new `merge_bytes` wasm binding for the browser | Blob composes with the audited `merge` path and the browser loader; union, not replace |
| 2026-06-08 | Reuse MATH/MUSIC domain ids + a new PHYSICS id; Physics-as-faced-domain deferred | Imported notes get a sensible home now; first-class Physics persona is separable |
| 2026-06-08 | Plateau identity = relative PATH (v5); link resolution = by name | A 600-note vault has duplicate stems across folders — path-keying loses no note; name-resolution keeps Obsidian link semantics (architect finding 2) |
| 2026-06-08 | Sort plateaus/bridges/resources by id before writing the blob | HashMap iteration is non-deterministic; sorting gives a deterministic insertion order (architect finding 5). NB (QA): the saved *bytes* still vary run-to-run — Automerge embeds per-run actor identity — but convergence is id-keyed, so re-import is a no-op merge regardless |

## Changelog

- 2026-06-08 created (Draft) — pending architect review, then Accepted.
- 2026-06-08 implemented + browser-verified. New: `mp-host/src/import.rs` (pure
  parse/position/build) + `tests/import.rs` (8) + `tests/fixtures/vault`; `lib.rs`
  `import()` + recursive `read_notes` + `ImportError`/`ImportStats`; `main.rs`
  `import` subcommand; `Cargo.toml` uuid `v5` + thiserror; `WasmCrdtDoc::merge_bytes`
  (+ pkg rebuild); `apps/web` "Import a world" button + file-input handler. Gates:
  `cargo test --workspace` (mp-host +8), `node --test` 147, `wasm-pack --node` 9,
  clippy host+wasm32, fmt — all green. Browser: `mp-host import` of the fixture →
  blob → "Import a world" merged it (8→14 plateaus / 9→12 bridges / 0→3 markers,
  union), an imported plateau's MD body rendered in the read view, console clean.
  (Same `pkg`-rebuild cache-bust note as R-0020.) **Status → Implemented.**
- 2026-06-08 architect design review: **APPROVE-WITH-NITS, no blocking issues**
  (pure/shell split clean; idempotency + `merge_bytes` union confirmed against the
  genesis-actor design). Folded: `position_for` floors all-zero to `(1,0,0)` before
  `normalize` (finding 1); plateau identity = relative path, links resolve by name,
  collision policy documented + fixture-pinned (finding 2); same-URI dedup made
  explicit (finding 3); `parse_note` exposed as a standalone pure fn (finding 4);
  writer sorts by id for reproducible blobs (finding 5); canvas seeding dropped
  from v1; Physics-fogged consequence noted (finding 9). **Status → Accepted.**
