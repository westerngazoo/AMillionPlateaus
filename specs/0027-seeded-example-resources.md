# SPEC-0027 — Seeded example resources (`seed_resource` + `SEED_RESOURCES`)

- **Status:** Implemented
- **Realizes:** R-0027
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-14
- **Depends on:** SPEC-0014 (`Resource`/`add_resource`), SPEC-0015 (votes → state in `to_graph`), SPEC-0022 (`seeds.js` + the per-load seed loop), SPEC-0023/0026 (Study view + offline digest that consume resources)
- **Module(s):** `crates/mp-wasm/src/lib.rs` (+ a `wasm-pack` test) — new `seed_resource`; `apps/web/src/seeds.js` (+ `seeds.test.mjs`) — `SEED_RESOURCES`; `apps/web/src/main.js` — seed loop. Rebuild `apps/web/pkg`. **No `mp-graph`/`mp-domain`/`mp-reputation`/`mp-crdt` change; no GA/reputation/CRDT-shape change.**

## 1. Motivation

R-0027: the seeded world has no resources, so the Study view + "what to read
first" are empty. Resources only get random ids via `add_resource`, which can't
be seeded convergently. Add the fixed-id sibling `seed_resource` (mirroring
`seed_plateau`/`seed_bridge`) and a small `SEED_RESOURCES` table.

## 2. Design

### 2.1 `mp-wasm` — `seed_resource` (mirror of `seed_plateau`)

```rust
/// Upsert a resource with a DETERMINISTIC id (the seed sibling of add_resource,
/// which mints a random id). Idempotent: re-seeding the same id overwrites the
/// same `resources` entry, so reload/sync converge (R-0004) and never duplicate.
/// Votes live in the separate `votes` map keyed by this id, so re-seeding leaves
/// stones/state intact (R-0027 AC3).
pub fn seed_resource(
    &mut self,
    id: &str,
    plateau_id: &str,
    title: &str,
    kind: &str,
    uri: &str,
) -> Result<(), JsError> {
    let id = Uuid::parse_str(id)?;
    let pid = Uuid::parse_str(plateau_id)?;
    self.inner
        .plateau(&pid)?
        .ok_or_else(|| JsError::new("unknown plateau"))?;
    let mut r = Resource::new(pid, title, convert::parse_resource_kind(kind), uri, Uuid::nil());
    r.id = id; // deterministic seed id (same pattern as seed_plateau's `p.id = id`)
    self.inner.add_resource(&r)?;
    Ok(())
}
```

Identical validation/shape to `add_resource` (lib.rs:289) — unknown plateau or
malformed UUID throws — except the id is supplied, not minted. `add_resource` on
the CRDT writes `resources[id] = json` (id-keyed), so a repeated fixed id is an
upsert, not a duplicate. `Resource.id` is already `pub`
(`mp-domain/src/types.rs:302`, same as `PlateauNode.id` used by `seed_plateau`),
so `r.id = id` needs **no core change**. `Resource::new` already fixes
`state = Floating`, `vote_count = 0`, `contributor = Uuid::nil()` (R-0014), so
seeded resources start un-stoned.

**Test (`crates/mp-wasm/tests/web.rs`, the `#[wasm_bindgen_test]` module):**
(a) `seed_resource` twice with the same id on one doc → `to_graph().resources()`
has exactly one entry at that id (local idempotency); (b) **two independent
replicas** that each `seed_resource` the same id, then `merge`, converge to **one**
entry at that id (the actual R-0004 AC4 property — reuse the two-replica merge
pattern at web.rs:114, not just the local upsert); (c) seeding an unknown plateau
id returns `Err`.

### 2.2 `seeds.js` — `SEED_RESOURCES` (pure data)

A new id namespace `…f1, …f2, …` (distinct from plateaus `a/c/d` and bridges
`b`). Resources reference plateaus through the existing `P` name→id map. Kinds
are from the known set (`Article | Video | Interactive | Paper | Note | Tool`).

```js
export const SEED_RESOURCES = [
  // Calculus
  { id: "00000000-0000-0000-0000-0000000000f1", plateau: P.Calculus, kind: "Video",
    title: "3Blue1Brown — Essence of Calculus",
    uri: "https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr" },
  { id: "00000000-0000-0000-0000-0000000000f2", plateau: P.Calculus, kind: "Article",
    title: "Khan Academy — Calculus 1", uri: "https://www.khanacademy.org/math/calculus-1" },
  // Algebra
  { id: "00000000-0000-0000-0000-0000000000f3", plateau: P.Algebra, kind: "Article",
    title: "Khan Academy — Algebra basics", uri: "https://www.khanacademy.org/math/algebra-basics" },
  // Harmony (the topic the owner hit)
  { id: "00000000-0000-0000-0000-0000000000f4", plateau: P.Harmony, kind: "Interactive",
    title: "musictheory.net — Lessons", uri: "https://www.musictheory.net/lessons" },
  { id: "00000000-0000-0000-0000-0000000000f5", plateau: P.Harmony, kind: "Article",
    title: "Open Music Theory", uri: "https://viva.pressbooks.pub/openmusictheory/" },
];
```

### 2.3 `main.js` — seed loop

In the existing idempotent seed block (after plateaus + bridges, lib ~166):

```js
for (const r of SEED_RESOURCES)
  doc.seed_resource(r.id, r.plateau, r.title, r.kind, r.uri);
```

Import `SEED_RESOURCES` alongside `SEED_PLATEAUS, SEED_BRIDGES, P`. Nothing else
changes — `renderStudyResources` (R-0023), the ranked list, the offline digest's
"what to read first", voting, and persistence all already consume whatever
resources the doc holds.

### 2.4 `seeds.test.mjs` — extend the mechanical guards

- Every `SEED_RESOURCES.id` is unique **across** all plateau + bridge + resource
  ids (extend the existing uniqueness test to include resources).
- Every `SEED_RESOURCES[*].plateau` is a value in `P` (a real seeded plateau).
- Every `kind` ∈ the **exact-match** set `{Article, Video, Interactive, Paper,
  Tool}` — i.e. the strings `parse_resource_kind` matches explicitly. `Note` is
  its `_` fallback, so a typo'd kind would silently degrade to `Note` in Rust;
  guarding against the exact-match set catches the typo in JS instead.

## 3. Code outline

- `crates/mp-wasm/src/lib.rs`: `seed_resource` (~14 lines) beside `add_resource`.
  `Resource.id` is already `pub` → no core change.
- `crates/mp-wasm/tests/…`: idempotency + unknown-plateau test.
- `apps/web/src/seeds.js`: `SEED_RESOURCES` (+ export).
- `apps/web/src/seeds.test.mjs`: uniqueness-across-all + plateau-ref + kind tests.
- `apps/web/src/main.js`: import + the seed loop.
- Rebuild: `wasm-pack build crates/mp-wasm --target web --out-dir ../../apps/web/pkg`.

## 4. Non-goals

Per R-0027 §4: no seeded votes/stones; no edit/delete; no per-resource
description; no fetching; no reachability/projection/kind-set change; not a
catalogue (a curated handful).

## 5. Open questions (resolved here)

- Topics/count: Calculus ×2, Algebra ×1, Harmony ×2 (5 total). §2.2.
- Id namespace: `…f1`–`…f5`, guarded by the uniqueness test. §2.2/§2.4.

## 6. Acceptance criteria

Maps to R-0027 AC:

- [ ] AC1 — ≥3 topics (incl. Harmony) show ranked resources; "what to read
      first" lists them. *(browser)*
- [ ] AC2 — fixed ids; reload is idempotent (no dupes); convergent.
      *(wasm idempotency test + browser reload)*
- [ ] AC3 — a stone on a seeded resource survives reload (votes in the separate
      map; re-seed doesn't reset). *(browser: stone → reload → count holds)*
- [ ] AC4 — `seed_resource` validates + upserts; doc root keys still
      `{bridges,plateaus,resources,votes}`. *(wasm test + existing root-keys assert)*
- [ ] AC5 — `SEED_RESOURCES` pure; ids unique across all seeds; plateau refs +
      kinds valid. *(seeds.test.mjs)*
- [ ] AC6 — additive; authored/imported resources, UI, ranking, voting, digest
      unchanged; links via `safeHref`, no fetch. *(diff scope + suites)*
- [ ] AC7 — all suites green; browser-verified on Harmony + one more; reload no
      dupes; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-14 | `seed_resource` mirrors `seed_plateau` (supplied id + upsert) | The only convergent way to seed; reuses the proven pattern + the id-keyed `resources` map |
| 2026-06-14 | New `…f` id namespace; uniqueness test extended to resources | Keeps seed ids collision-free (the architect caught a bridge-id collision before — guard mechanically) |
| 2026-06-14 | Seed resources un-stoned; never seed votes | Votes are earned; AC3 idempotency depends on the resource upsert not touching the separate votes map |

## Changelog

- 2026-06-14 created (Draft) — `seed_resource` + a curated `SEED_RESOURCES`
  (Calculus/Algebra/Harmony). Pending architect review, then `Accepted`.
- 2026-06-15 implemented + browser-verified. `seed_resource` (mp-wasm) + the
  idempotency/convergence wasm test; `SEED_RESOURCES` (5 rows, `…f` namespace)
  + extended `seeds.test.mjs`; `main.js` seed loop; pkg rebuilt. 185 JS + 10 wasm
  (incl. `seed_resource_is_idempotent_and_convergent`) + workspace green;
  clippy/fmt clean. Browser: The Composer → 9/9 lit · 5 markers; Calculus/Algebra/
  Harmony show their seeded resources ranked; Harmony "what to read first" lists
  both; reload kept 5 markers (idempotent); console clean. QA PASS → R-0027
  **Met**. **Status → Implemented.**
- 2026-06-14 architect design review: **APPROVE-WITH-NITS** — convergence,
  votes-survive-reseed (state/count derived in `to_graph` from the separate
  `votes` map), core-clean (`Resource.id` already `pub`), root-keys-unchanged,
  and the `…f` id namespace all verified against the code. Folded the three nits:
  the wasm test asserts **merge-convergence** across two replicas (not just local
  idempotency); the JS kind guard pins the **exact-match** set
  (`Article|Video|Interactive|Paper|Tool`, `Note` being the fallback); dropped the
  `Resource.id` "if needed" hedge. **Status → Accepted.**
