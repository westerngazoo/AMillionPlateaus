# GA_DB — the geometric-algebra persistence layer

> **Status (2026-06-02):** the GA stores are **built and tested in Rust, but not
> wired into any running app.** The only app today is `apps/web` (WASM), which
> cannot link redb. In the browser, graph state is in-memory + cross-tab only;
> nothing geometric is durable across a reload. See [§6](#6-where-it-runs-today).

This doc describes what is actually stored, in what byte format, and where the
math comes from. Companion to [`GRAPH_SCHEMA.md`](GRAPH_SCHEMA.md) (the Rust
types) and [`GARUST_INTEGRATION.md`](GARUST_INTEGRATION.md) (the GA mapping).

---

## 1. Are we using garust? Yes.

garust is a real path dependency (`Cargo.toml`: `garust = { path = "../garust" }`,
the directory exists) and it is the **only** geometry math layer — no `glam`,
no `nalgebra` (CLAUDE.md §1, verified by grep: zero occurrences).

The concrete garust type is **`garust::Vga3f`** — the 3-D Euclidean geometric
algebra Cl(3,0,0) over `f32`, an 8-coefficient multivector. The design docs call
it "Multivector"; the code aliases it as `Mv`:

```rust
// crates/mp-graph/src/ga.rs — the SINGLE garust touchpoint
use garust::Vga3f;
pub type Mv = Vga3f;
```

**Blade layout (fixed, golden-tested):**

```
index   0    1    2    3     4    5     6     7
blade   1    e1   e2   e12   e3   e13   e23   e123
                                  ^ e3 is at index 4, not 3 (interleaved)
axis         Formal Empirical    Creative
```

Everything else in the workspace is built **on top of** garust primitives
(`grade`, `norm_squared`, the geometric product `*`, `inner`, `scalar_part`).
`ga.rs` is a thin adapter providing derived conveniences the design assumes
(`vector`, `dominant_grade`, `even_grade`, `norm`, `normalize`, `project`,
`reverse`, `sandwich`) — each a pure composition of garust ops. One example that
matters for Sybil-resistance:

```rust
// Fog projection uses the Hestenes INNER product, not scalar_product:
// the two differ exactly on scalar inputs, and that difference is the
// resistance — a scalar-only (Sybil) reputation projects to 0 → sees only fog.
pub fn project(rep: &Mv, position: &Mv) -> f32 {
    rep.inner(position).scalar_part()
}
```

So: **garust is load-bearing, concentrated in one adapter module**, and the rest
of the code (`types.rs`, `graph.rs`, `reputation.rs`) speaks in `Mv` / `ga::*`.

---

## 2. The two stores

Both are redb-backed and live behind the `storage` Cargo feature (default-on for
native, opted-out by `mp-wasm`).

| Store | Crate | Stores | Format | Granularity |
|-------|-------|--------|--------|-------------|
| `GraphDb` | `mp-graph` (`db.rs`) | nodes + edges | **bincode** rows | per-entity |
| `CrdtStore` | `mp-crdt` (`store.rs`) | one Automerge doc | **opaque save blob** | whole-doc snapshot |

- **`GraphDb`** is the per-entity geometric store: each `PlateauNode` / `Bridge`
  is bincode-serialized and keyed by its UUID. On `load` every record is
  re-validated against its GA invariant (positions must be Grade-1, rotors
  even-grade). Tables are named `"plateaus"` / `"bridges"` (kept verbatim for
  on-disk compatibility — they're opaque strings, not domain vocabulary, since
  SPEC-0008 generalized the store).
- **`CrdtStore`** persists the mergeable world as a single Automerge snapshot
  blob in a `"crdt_doc"` table. Cycle: `load → merge(incoming) → persist`.

**What is NOT in either store:** reputation. It is never persisted — it is
recomputed from the signed event log (CLAUDE.md §7, R-0010).

---

## 3. Schema (on disk)

```
GraphDb  (redb file, e.g. graph.redb)
├── table "plateaus" :  key = UUID bytes      → value = bincode(PlateauNode)
└── table "bridges"  :  key = UUID bytes      → value = bincode(Bridge)

CrdtStore (redb file, e.g. world.redb)
└── table "crdt_doc" :  key = "snapshot"       → value = Automerge.save() blob
```

`PlateauNode` serde shape (flat, golden-pinned — 7 keys):
`{ id, name, description, domain_id, position[8], fog, created_at }`

`Bridge` serde shape (flat, golden-pinned — 8 keys):
`{ id, from, to, concept_label, rotor[8], dominant_grade, bidirectional, created_by }`

---

## 4. Sample — the JSON wire shape

A real `PlateauNode` ("Linear Algebra", position `0.9·e1 + 0.1·e2`) as the JSON
that `mp-crdt` stores per entity:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear Algebra",
  "description": "vector spaces",
  "domain_id": "00000000-0000-0000-0000-000000000000",
  "position": [0.0, 0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0],
  "fog": true,
  "created_at": 0
}
```

`position` is the 8-coeff blade array: `0.9` at index 1 (e1/Formal), `0.1` at
index 2 (e2/Empirical) — a pure Grade-1 vector.

---

## 5. Sample — the actual bytes on disk

Reproduce with `cargo run -p mp-domain --example dump_db`. The bincode row for
the Linear Algebra node (132 value bytes), byte-identical to the golden in
`crates/mp-domain/tests/persistence.rs`:

```
"plateaus" row  key = 00000000-0000-0000-0000-000000000000 (132 bytes):
  0000  10 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ........(id: len16 + 16 nil)
  0010  00 00 00 00 00 00 00 00 0e 00 00 00 00 00 00 00   ........(name: len14)
  0020  4c 69 6e 65 61 72 20 41 6c 67 65 62 72 61 0d 00   Linear Algebra..
  0030  00 00 00 00 00 00 76 65 63 74 6f 72 20 73 70 61   ......vector spa
  0040  63 65 73 10 00 00 00 00 00 00 00 00 00 00 00 00   ces.....(domain_id len16)
  0050  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 66   ...............f
  0060  66 66 3f cd cc cc 3d 00 00 00 00 00 00 00 00 00   ff?...=.(position 8×f32 LE)
  0070  00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00   ........(fog=01, created_at)
  0080  00 00 00 00                                       ....
```

Decoding the `position` block (8 little-endian f32):
`00000000`→0.0, `6666663f`→**0.9**, `cdcccc3d`→**0.1**, then five `00000000`→0.0.
That is `0.9·e1 + 0.1·e2`, exactly the Grade-1 vector we stored.

> Note: bincode prefixes each UUID with a `u64` length (16) before the 16 raw
> bytes, so a UUID costs 24 bytes on disk. The redb *file* is ~1.5 MB because
> redb pre-allocates pages; the actual row is these 132 bytes.

### A bridge rotor is a real geometric product

The `dump_db` example also prints the Linear Algebra ↔ Symmetry rotor —
`(la.position * sym.position).even_grade().normalize()` computed by garust:

```
rotor coeffs [1,e1,e2,e12,e3,e13,e23,e123]
            = [0.638, 0, 0, 0.510, 0, 0.574, 0.064, 0]
dominant grade 2   (even-grade; |R| = 1.000)
```

Scalar (0.638) + bivector (e12, e13, e23) parts, unit norm — a rotor, not a
scalar weight. This is the whole premise: relationships are geometry.

### The seed world

`cargo run -p mp-domain --example seed_graph` — 5 plateaus, 4 bridges:

```
Plateaus (5):
  • Linear Algebra         grade 1  |position| 0.906
  • Differential Geometry  grade 1  |position| 0.866
  • Classical Mechanics    grade 1  |position| 0.943
  • Music Theory           grade 1  |position| 0.943
  • Symmetry               grade 1  |position| 0.866
Bridges (4):
  • Linear Algebra        <-> Differential Geometry  grade 0  [linear transformation]
  • Differential Geometry <-> Classical Mechanics    grade 0  [geodesic motion]
  • Linear Algebra        <-> Symmetry               grade 2  [group representation]
  • Music Theory          <-> Symmetry               grade 0  [harmonic invariance]
```

Different bridges have different dominant grades — nearly-parallel concepts
yield a scalar-heavy (grade-0) rotor; concepts at an angle yield a real grade-2
bivector. garust is doing the work.

---

## 6. Where it runs today

```
L4 Identity    Nostr        ✅ live (R-0010): keypair, signed events
L3 Content     IPFS         ✗  not started
L2 Graph Sync  Automerge    ✅ live, but in-memory + cross-tab BroadcastChannel only
L1 Local Store redb          ⚠️ GraphDb + CrdtStore built + tested, NOT wired to any app
L0 In-Memory   mp-graph     ✅ live; re-seeded fresh every page load
```

The browser (`apps/web`) cannot link redb (`mp-wasm` sets
`mp-crdt = { default-features = false }` — *"redb does not build for wasm32"*),
and `WasmCrdtDoc` does not expose `save()`/`load()` to JS (the core `CrdtDoc`
has them at `doc.rs:232/237`, just unbridged). What persists in the browser is
via **localStorage**, not redb: the secret key, the signed event log, the
authored persona, model config, relay URL. **The graph itself is ephemeral.**

This is why R-0011's "Draft DB" is not yet durable across a reload, and the
honest next step is one of:

1. **Browser durability** — expose `WasmCrdtDoc.save()/load()`, persist the
   Automerge snapshot to **IndexedDB** (redb can't run in WASM). Makes the Draft
   DB an actual db in the only app that exists.
2. **Native host** — stand up `apps/server` that uses the real `GraphDb` /
   `CrdtStore` as written, with the browser syncing to it.

---

## 7. Reproduce everything

```bash
cargo run -p mp-domain --example seed_graph   # the 5-plateau world + GA grades
cargo run -p mp-domain --example dump_db      # write a real .redb + hexdump a row
cargo test -p mp-domain --test persistence    # the golden byte/JSON contract
```
