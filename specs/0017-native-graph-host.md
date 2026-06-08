# SPEC-0017 — Native graph host: a CLI over the redb CrdtStore

- **Status:** Implemented
- **Realizes:** R-0017
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** SPEC-0004 (CrdtStore/CrdtDoc), SPEC-0008 (domain graph), SPEC-0012 (browser save-blob)
- **Module(s):** new crate `crates/mp-host` (`src/lib.rs` + `src/main.rs` + `tests/host.rs`), workspace `Cargo.toml` (add member). **No change to existing crates.**

## 1. Motivation

R-0017: wire the durable redb `CrdtStore` (built + tested, used by no app) into a
real process. `mp-host` is a thin synchronous CLI over `CrdtStore`/`CrdtDoc`:
`seed` a canonical world, `stats` the persisted graph, and `merge` a browser
save-blob — making GA_DB.md's "one save-blob, two backings" concrete with no
transport. Pure Rust, fully `cargo test`-able, zero change to existing crates.

## 2. Design

### 2.1 Crate layout

```
crates/mp-host/
  Cargo.toml        deps: mp-crdt { workspace = true, features = ["storage"] },
                    mp-domain, uuid; dev-dep: tempfile
  src/lib.rs        seed() / stats() / merge() — the testable command logic
  src/main.rs       thin std::env::args dispatcher over lib; usage + exit codes
  tests/host.rs     integration tests (tempfile redb paths)
```

Add `"crates/mp-host"` to the workspace `members`. No existing crate changes.

**Dependency wiring (architect finding 9).** The *workspace* `mp-crdt` dep is
declared `default-features = false` (so the wasm consumer omits redb). `mp-host`
must therefore re-enable storage explicitly — `mp-crdt = { workspace = true,
features = ["storage"] }` — or `CrdtStore` (which is `#[cfg(feature =
"storage")]`) won't exist. Features are additive, so this opts storage back on
for the native binary without affecting the wasm build.

### 2.2 `lib.rs` — command logic (the testable surface)

```rust
use std::path::Path;
use mp_crdt::{CrdtDoc, CrdtError, CrdtStore};
use mp_domain::{Bridge, KnowledgeGraph, PlateauNode, ResourceState};
use uuid::Uuid;

// NOTE (architect finding 1): `CrdtStore::create` is redb's create-if-missing —
// it opens an existing valid store WITHOUT error and initialises a new one only
// when absent/empty. So it IS an open-or-create; there is no separate
// `open_or_create` helper and no TOCTOU `.exists()` race on the write paths.
// `CrdtStore::open` (used read-only by `stats`) requires an existing file.

/// The seed world: a small set of plateaus + bridges with FIXED ids, so
/// re-seeding is an idempotent CRDT upsert (no duplication, R-0017 AC2). A
/// reduced variant of the `seed_graph` example, kept inline so this crate is
/// self-contained (a shared `seed_graph()` builder is a future tidy, open-Q).
fn seed_graph() -> KnowledgeGraph {
    let domain = Uuid::from_u128(0x0d00);
    let p = |n: u128, name, e1, e2, e3| {
        let mut pl = PlateauNode::new(name, domain, e1, e2, e3);
        pl.id = Uuid::from_u128(n); // fixed id ⇒ idempotent seed (position set by `new`, untouched)
        pl
    };
    let la = p(0xa1, "Linear Algebra", 0.9, 0.1, 0.0);
    let dg = p(0xa2, "Differential Geometry", 0.7, 0.5, 0.1);
    let mt = p(0xc1, "Music Theory", 0.3, 0.4, 0.8);
    let sym = p(0xa3, "Symmetry", 0.5, 0.5, 0.5);
    let b = |n: u128, from: &PlateauNode, to: &PlateauNode, c| {
        let mut br = Bridge::between(from, to, c, Uuid::nil());
        br.id = Uuid::from_u128(n);
        br
    };
    let bridges = [
        b(0xb1, &la, &dg, "linear transformation"),
        b(0xb2, &la, &sym, "group representation"),
        b(0xb3, &mt, &sym, "harmonic invariance"),
    ];
    let mut g = KnowledgeGraph::new();
    for pl in [la, dg, mt, sym] {
        g.add_plateau(pl);
    }
    for br in bridges {
        // Endpoints were added immediately above — a construction-time invariant,
        // not fallible I/O (matches the seed_graph example; CLAUDE.md §5 ok in a binary).
        g.add_bridge(br).expect("seed bridge endpoints were added above");
    }
    g
}

/// `seed <db>` — persist the seed world; convergent on re-run (fixed ids).
pub fn seed(path: &Path) -> Result<(), CrdtError> {
    let store = CrdtStore::create(path)?; // create-if-missing (opens existing)
    let mut doc = store.load()?.unwrap_or(CrdtDoc::new()?); // load-or-new
    let g = seed_graph();
    for p in g.plateaus() {
        doc.add_plateau(p)?; // idempotent upsert keyed by fixed id
    }
    for b in g.bridges() {
        doc.add_bridge(b)?;
    }
    store.persist(&mut doc)?;
    Ok(())
}

pub struct Stats {
    pub plateaus: usize,
    pub bridges: usize,
    pub resources: usize,
    pub voted: usize,
    pub crystallized: usize,
}

impl Stats {
    fn zero() -> Self {
        Stats { plateaus: 0, bridges: 0, resources: 0, voted: 0, crystallized: 0 }
    }
}

/// `stats <db>` — counts derived from the persisted CRDT via `to_graph`, never a
/// side table. Read-only: an absent store reports all-zero WITHOUT creating a
/// file (so `stats` never materialises an empty db — architect finding 5).
pub fn stats(path: &Path) -> Result<Stats, CrdtError> {
    if !path.exists() {
        return Ok(Stats::zero());
    }
    let store = CrdtStore::open(path)?;
    let Some(doc) = store.load()? else {
        return Ok(Stats::zero());
    };
    let g = doc.to_graph()?;
    let resources: Vec<_> = g.resources.values().collect();
    Ok(Stats {
        plateaus: g.plateaus().count(),
        bridges: g.bridges().count(),
        resources: resources.len(),
        voted: resources.iter().filter(|r| r.vote_count > 0.0).count(),
        crystallized: resources
            .iter()
            .filter(|r| matches!(r.state, ResourceState::Crystallized))
            .count(),
    })
}

/// `merge <db> <snapshot>` — merge an Automerge save-blob (a browser
/// `WasmCrdtDoc.save()` / IndexedDB snapshot) into the durable store. Convergent
/// + idempotent (R-0004). The browser↔native bridge, no transport. A corrupt /
/// non-Automerge blob errors via `CrdtDoc::load` (CrdtError::Automerge), never panics.
pub fn merge(path: &Path, snapshot: &[u8]) -> Result<(), CrdtError> {
    let store = CrdtStore::create(path)?;
    let mut doc = store.load()?.unwrap_or(CrdtDoc::new()?);
    let mut incoming = CrdtDoc::load(snapshot)?;
    doc.merge(&mut incoming)?;
    store.persist(&mut doc)?;
    Ok(())
}
```

(`KnowledgeGraph::plateaus()/bridges()` yield `&PlateauNode`/`&Bridge`;
`CrdtDoc::add_plateau`/`add_bridge` take refs (doc.rs:143/147), so iterating one
owned `g` and feeding `&mut doc` is borrow-clean. `CrdtDoc::new()` is fallible;
`unwrap_or(CrdtDoc::new()?)` propagates its error before `unwrap_or` runs.)

### 2.3 `main.rs` — thin dispatcher

`main` returns `Result<(), Box<dyn Error>>` (a binary — simplest non-panicking
path; the lib fns return typed `CrdtError`, and `std::fs::read`'s `io::Error`
boxes via `?`). Bad args print usage and exit 2; any error exits non-zero with a
message (no `unwrap` on fallible paths, CLAUDE.md §5).

```rust
use std::error::Error;
use std::path::Path;
use std::process::exit;

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("seed") if args.len() == 3 => {
            mp_host::seed(Path::new(&args[2]))?;
            println!("seeded {}", &args[2]);
        }
        Some("stats") if args.len() == 3 => {
            let s = mp_host::stats(Path::new(&args[2]))?;
            println!(
                "{} plateaus · {} bridges · {} resources ({} voted, {} crystallized)",
                s.plateaus, s.bridges, s.resources, s.voted, s.crystallized
            );
        }
        Some("merge") if args.len() == 4 => {
            let bytes = std::fs::read(&args[3])?; // io::Error → Box<dyn Error>
            mp_host::merge(Path::new(&args[2]), &bytes)?;
            println!("merged {} into {}", &args[3], &args[2]);
        }
        _ => {
            eprintln!("usage: mp-host <seed|stats|merge> <db.redb> [snapshot]");
            exit(2);
        }
    }
    Ok(())
}
```

### 2.4 Why this honours CLAUDE.md §6/§7 (AC6)

`mp-host` persists **only** `CrdtDoc` bytes — the four data maps. It stores no
reputation (recomputed from the event log, never here) and computes nothing
authoritative: `stats` *derives* counts via `to_graph` (crystallization included,
R-0015), so the host is a durable holder of the graph, not a second authority.
`mp-crdt` already depends on neither `mp-reputation` nor `mp-identity`
(`crate_does_not_depend_on_mp_reputation`), so no reputation can leak in.

## 3. Code outline

See §2 — one ~70-line `lib.rs`, a ~20-line `main.rs`, a `tests/host.rs`, and one
workspace-member line. No existing crate changes.

## 4. Non-goals

- No transport/networking/HTTP/relay (deferred); no TS Colyseus server.
- No `GraphDb` (per-entity store) — uses `CrdtStore` to match the browser blob.
- No concurrent-writer protocol beyond redb's single-writer; no auth; no IPFS.
- No new heavy deps (no clap/tokio); std arg parsing only.

## 5. Open questions (resolved here)

- Seed: **inline** in `mp-host` (self-contained); a shared `seed_graph()` is a
  future tidy. §2.2.
- Placement: **`crates/mp-host`** (the workspace is all `crates/*`). §2.1.
- CLI: bare `std::env::args` match. §2.3.

## 6. Acceptance criteria

Maps 1-to-1 to R-0017 AC:

- [x] AC1 — `mp-host` binary with `seed`/`stats`/`merge`; bad args → usage + exit
      2; errors → message + exit 1, no panic.
- [x] AC2 — `seed <db>` persists the canonical world; re-seed converges (fixed
      ids, no duplication).
- [x] AC3 — `stats <db>` reports plateaus/bridges/resources/voted/crystallized,
      all derived via `to_graph`.
- [x] AC4 — `merge <db> <snapshot>` ingests a `WasmCrdtDoc.save()` blob; store =
      union; re-merge is a no-op (idempotent).
- [x] AC5 — durable round-trip: a fresh process `stats` reads back what was
      persisted; corrupt store → error, not panic.
- [x] AC6 — persists only the CRDT doc (four maps); no reputation; counts derived.
- [x] AC7 — pure sync Rust, lean deps; `cargo` integration tests (seed→stats,
      merge adds, durable reload across processes, idempotent re-seed/re-merge).
- [x] AC8 — `cargo test --workspace` + clippy `-D warnings` + fmt green; binary
      runs all three commands with correct output + exit codes.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | New binary crate `crates/mp-host`, additive only | Closes the GA_DB.md gap with zero churn to audited crates; consistent with the all-`crates/*` workspace |
| 2026-06-04 | Command logic in `lib.rs`, `main.rs` a thin dispatcher | Integration tests call the lib directly (no process spawn); main is just arg-parse + exit codes |
| 2026-06-04 | Fixed-id inline seed | Idempotent/convergent re-seed without a `seed_plateau`-style API; self-contained |
| 2026-06-04 | `CrdtStore` (whole-doc), `merge` is the headline | Byte-compatible with the browser's `WasmCrdtDoc.save()` blob; proves browser↔native convergence offline |

## Changelog

- 2026-06-04 created (Draft) — pending architect review, then Accepted.
- 2026-06-04 architect design review: **APPROVE-WITH-NITS** (all API usage,
  fixed-id idempotent seed, invariant preservation, derived counts, §6/§7 framing,
  and byte-compatible merge verified correct against the real code). Folded:
  **(must-fix)** dropped the `open_or_create` helper — `CrdtStore::create` is
  redb's create-if-missing, already open-or-create — `seed`/`merge` call it
  directly, `stats` is read-only via `path.exists()` (no longer materialises an
  empty file); **(must-fix)** `mp-crdt` dep uses explicit `features = ["storage"]`
  since the workspace default-features are off for wasm; **(tidy)** `main` returns
  `Box<dyn Error>` (dropped `to_crdt_err`), non-`mut` seed closures, `0x0d00`,
  `.expect` justified as a construction invariant. Seed is a *reduced variant* of
  the example (not byte-identical) — "mirrors" corrected. **Status → Accepted.**
- 2026-06-04 implemented (commit 84133d7) and **QA sign-off → PASS** (all AC1–AC8
  met; 6 mp-host integration tests + 21 workspace suites, clippy host+wasm32, fmt
  green; binary verified end-to-end incl. seed/stats/re-seed/merge/re-merge/reload
  /bad-args/corrupt-blob). Byte-compatibility, idempotency, and Grade-1-invariant
  preservation verified against real code; `cargo tree` confirms no
  reputation/identity dep. QA re-flagged the stale `CrdtStore::create` doc comment
  (pre-existing mp-crdt nit) — fixed as a separate docs commit. **Status →
  Implemented.**
