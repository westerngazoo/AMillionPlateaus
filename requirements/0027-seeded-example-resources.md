# R-0027 — Seeded example resources: the world ships with things to read

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-14
- **Depends on:** R-0014 (resources/markers + `add_resource`), R-0015 (votes/stones → ranking/state), R-0023 (Study view + "what to read first"), R-0026 (offline digest), R-0004 (deterministic convergent seed: `seed_plateau`/`seed_bridge`)
- **Realized by:** SPEC-0027
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

The seeded world ships plateaus + bridges but **no resources**, so opening a
seeded topic shows "No resources pinned here yet" and **What to read first**
has nothing to rank. This requirement seeds a **handful of real example
resources** on a few seeded topics (e.g. Calculus, Algebra, Harmony) so the
Study view's ranked list and the digest's reading order have real content on
first run — without the visitor having to add anything. The seed must be
**deterministic and convergent** like the plateau/bridge seed: fixed ids,
idempotent on reload, and identical across independently-started replicas (two
tabs/peers converge to the same resources, never duplicates).

## 2. Rationale

R-0023/R-0026 make studying a topic useful, but only if the topic *has*
materials; the empty seed makes the headline loop ("travel there, see what to
read, study") fall flat on the default world. Resources today only get **random
ids** via `add_resource`, so they cannot be seeded the way plateaus/bridges are
(`add_resource` on every load would duplicate, and two fresh replicas would
generate different ids for "the same" resource and never converge — violating
R-0004 AC4). The missing primitive is a **fixed-id `seed_resource`**, the exact
sibling of `seed_plateau`/`seed_bridge`; with it, a small `SEED_RESOURCES` table
gives the world real content for free. Reachability/GA/reputation are untouched
(resources are markers, not geometry).

## 3. Acceptance criteria

- **AC1 — A few topics ship with resources.** On a fresh load, at least three
  seeded topics (incl. **Harmony**) each show one or more example resources in
  the Study view's "ranked by stones" list, and **What to read first** lists them
  (best-first) instead of the empty suggestion. Each resource has a sensible
  kind (Article/Video/Interactive/…), a real title, and a working link.

- **AC2 — Deterministic + convergent + idempotent.** The seeded resources have
  **fixed ids** (a distinct id namespace from plateaus/bridges); seeding runs on
  every load as an **idempotent upsert** (reload does not duplicate them), and
  two independently-started replicas converge to the **same** resource set
  (R-0004 AC4) — exactly like `seed_plateau`/`seed_bridge`.

- **AC3 — Votes/state preserved.** Re-seeding on reload must **not** reset a
  resource's stones or crystallized state — votes live in the separate `votes`
  map keyed by resource id and the count/state are derived in `to_graph`, so a
  fixed-id resource upsert leaves the tally intact. A stone placed on a seeded
  resource survives reload.

- **AC4 — `seed_resource` binding, core-clean.** A `WasmCrdtDoc.seed_resource(id,
  plateau_id, title, kind, uri)` mirrors `seed_plateau`: it validates the ids and
  the plateau exists, builds a `Resource` with the **given** id, and upserts it
  into the `resources` map. No reputation/GA/CRDT-shape change; the doc still
  holds exactly `{bridges, plateaus, resources, votes}`. Unknown plateau or
  malformed id is a thrown error.

- **AC5 — Pure seed data + tested.** `SEED_RESOURCES` is pure data in `seeds.js`
  (id, plateau ref via `P`, title, kind, uri). Unit tests assert: every resource
  id is **unique across all seed ids** (plateaus + bridges + resources); every
  `plateau` ref resolves to a real seeded plateau; kinds are from the known set.
  A `wasm-pack` test asserts `seed_resource` is idempotent (seed twice → one
  resource at that id) and rejects an unknown plateau.

- **AC6 — Additive; existing behaviour intact.** Authored/imported resources
  (random ids) are untouched; the resource UI, ranking, voting, and the offline
  digest are unchanged (they just have data now). Existing suites stay green;
  links are rendered through the existing `safeHref` chokepoint (no injection),
  and resource content is **not** fetched (R-0023 boundary).

- **AC7 — Green + browser-verified.** All suites green; in the browser, opening
  **Harmony** (and another seeded topic) shows the example resources ranked, and
  **What to read first** lists them — with no uncaught console errors; a reload
  does not duplicate them.

## 4. Constraints & non-goals

- **Mirror the existing seed.** Reuse the `seed_plateau`/`seed_bridge` pattern
  and the per-load idempotent-upsert seeding in `main.js`; `SEED_RESOURCES` lives
  beside `SEED_PLATEAUS`/`SEED_BRIDGES` in `seeds.js`.
- **Real but few.** A small, curated set (a handful), not a catalogue; pick
  well-known, free, legitimate educational links.
- **No fetching.** Seeds carry title/kind/uri only; nothing is fetched or
  scraped (same boundary as R-0023).
- **Non-goals:** seeding **votes/stones** (resources seed un-stoned; the visitor
  stones them); editing/deleting resources; per-resource descriptions; changing
  reachability, the projection, or the resource kinds.

## 5. Open questions

- **Which topics + how many.** Lean: Calculus + Algebra + Harmony, ~2 each
  (~5–6 total). Spec fixes the list.
- **Id namespace.** Lean: a fresh 2-char suffix prefix (`…f1`, `…f2`, …) distinct
  from plateaus (`a/c/d`) and bridges (`b`). Spec fixes it; the uniqueness test
  guards it.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-14 | Add a fixed-id `seed_resource` rather than seed via `add_resource` | `add_resource` makes random ids → reload duplicates + replicas never converge (breaks R-0004 AC4); a fixed-id upsert is the only convergent path |
| 2026-06-14 | Re-seed every load (idempotent upsert); never seed votes | Matches `seed_plateau`/`seed_bridge`; votes live in a separate id-keyed map, so re-seeding the resource leaves stones intact (AC3) |
| 2026-06-14 | Curated real links, no fetching | Honest demo content; respects the R-0023 no-network boundary |

## Changelog

- 2026-06-14 created (Accepted) — give the default world real reading material so
  the Study view + "what to read first" aren't empty; needs the `seed_resource`
  sibling binding. Pending SPEC-0027 + architect review.
- 2026-06-15 **Status → Met** — QA sign-off (verdict PASS). All seven acceptance
  criteria have passing tests; every gate green. See the QA sign-off below.

## QA sign-off — R-0027 (2026-06-15)

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) / evidence | Result |
|----|--------------------|--------|
| AC1 | `seeds.test.mjs` "every seed resource anchors to a seeded plateau and uses a known kind" (≥3 distinct topics incl. Harmony, https links, known kinds); browser: The Composer shows 5 markers, Calculus/Algebra/Harmony each show ranked seeded resources, Harmony digest lists them best-first | PASS |
| AC2 | `web.rs::seed_resource_is_idempotent_and_convergent` parts (a) local double-seed → 1 entry + (b) two-replica merge → 1 entry; id namespaces verified disjoint (plateaus `a/c/d`, bridges `b`, resources `f`; 24/24 distinct ids); browser reload kept 5 markers | PASS |
| AC3 | CRDT design verified in `mp-crdt/src/doc.rs`: `to_graph` (L110–135) re-derives `vote_count` from `resource_vote` (the separate `votes` map keyed by `resource/wizard/actor`) and derives `state` from that tally — the resource blob's stored count/state are ignored. `add_resource` writes only `resources[id]`, never the votes map, so a fixed-id upsert cannot touch a stone. Covered by `doc.rs::resource_state_is_derived_from_votes_not_the_blob`; browser: stone survived reload | PASS |
| AC4 | `web.rs::seed_resource_is_idempotent_and_convergent` part (c) unknown plateau → `Err`; validates id + plateau-exists and upserts into `resources`; root-keys assert `["bridges","plateaus","resources","votes"]` holds post-merge (same test) and in existing suites. No reputation/GA/CRDT-shape change | PASS |
| AC5 | `seeds.test.mjs` id-uniqueness across plateaus+bridges+resources; plateau-ref resolution; kinds ∈ exact-match set `{Article,Video,Interactive,Paper,Tool}` matching `convert.rs::parse_resource_kind` (`Note` is the `_` fallback). `web.rs` wasm idempotency + unknown-plateau test | PASS |
| AC6 | `git diff --stat` scope = `crates/mp-wasm/{src/lib.rs,tests/web.rs}`, `apps/web/{src/seeds.js,src/seeds.test.mjs,src/main.js}`, `Cargo.lock`, R-0027/SPEC-0027 docs (pkg is git-ignored build artifact, rebuilt with the binding present). No change to `mp-graph`/`mp-domain`/`mp-reputation`/`mp-crdt`. Resource URI rendered via `safeHref(r.uri)` (main.js:930 — http(s)/mailto only, else inert), identical to authored resources; nothing fetched (only `fetch` is the companion API) | PASS |
| AC7 | All suites green (Node 185/185, cargo workspace, wasm-pack 10/10); fmt + clippy (workspace + wasm target) clean; browser evidence recorded (accepted as manual): 9/9 plateaus lit · 10 bridges · 5 markers, seeded resources ranked, Harmony digest lists them, console error-clean, reload kept 5 markers | PASS |

### Suites

- Node (`node --test apps/web/src/*.test.mjs`): **185 pass / 0 fail**.
- Cargo (`cargo test --workspace`): **green** (mp-crdt 13+6, mp-domain 16, mp-graph 16, mp-host 6+9, mp-identity 1+16, mp-reputation 11+1, mp-wasm 18 host-side; web.rs wasm32-gated).
- wasm-pack (`wasm-pack test --node crates/mp-wasm`): **10 pass / 0 fail**, incl. `seed_resource_is_idempotent_and_convergent`.
- Lint/format: `cargo fmt --all --check` clean; `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo clippy -p mp-wasm --target wasm32-unknown-unknown --all-targets -- -D warnings` clean.

### Gaps / failures

None. All seven acceptance criteria are demonstrably met by passing tests; the
browser portion of AC1/AC2/AC3/AC7 is accepted as the recorded manual evidence.
