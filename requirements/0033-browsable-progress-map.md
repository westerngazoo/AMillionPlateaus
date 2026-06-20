# R-0033 — Browsable progress map: explore freely, color by progress, trace your trail

- **Status:** Met (2026-06-17)
- **Milestone:** POC — Navigation
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-17
- **Depends on:** R-0005 (render/projection + the click hit-test), R-0010 (the signed traversal log "visited" is derived from), R-0030 (mastery ✓ = the "done" state), R-0024 (camera + fixed disc hit radius), R-0029 (bridge clicking — must keep working)
- **Realized by:** SPEC-0033
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Today the map encodes one thing — **earned reach** — and **gates clicks** by it
(you cannot open a fogged plateau). This requirement turns the map into a
**browsable progress map**: **every plateau is clickable**, and a disc's colour
shows **how far you've gotten with it**, not whether you've earned reach to it.
Opening a topic records it as **studying** (it signs the existing traversal, just
no longer gated); quizzing it (R-0030) makes it **mastered**. The map shows three
progress states — **unexplored / studying / mastered** — plus the **covered
trail**: the connections between topics you've already visited, coloured as
territory you've walked. You can roam anywhere; the colours fill in as you learn.

## 2. Rationale

The owner chose a friendlier learning model: don't lock content behind earned
reach — let people explore the whole map and **show their progress** instead.
Everything needed already exists: "studying" is the **traversal** events
(R-0010), "mastered" is the **mastery** events (R-0030), and the trail is the set
of visited plateaus — all derivable from the verified log, like `masteredTopics`.
So this is a **presentation + interaction** change (recolour by progress, ungate
the click), **JS-only**, with **no core/Rust/CRDT/reputation-math change**. It
deliberately reframes the signature fog-of-war from a **gate** into a **progress
overlay**; reach/reputation stays (it still powers rank + discovery, R-0010) and
the lens still sets the starting orientation — they just no longer lock the map.

## 3. Acceptance criteria

- **AC1 — Every plateau is clickable.** The canvas click opens **any** plateau's
  read view — not only reachable ones. Clicking empty space still does nothing;
  the bridge click (R-0029) still works (a bridge opens only when the cursor is
  not over any disc). The fixed disc hit radius (R-0024) is unchanged.

- **AC2 — Opening = studying.** Opening a plateau records it as **studying** by
  signing the **existing traversal event** (R-0010) for it — exactly today's
  click behaviour, minus the reachability gate. No new event kind. Mastery
  (R-0030, the quiz) remains the separate "mastered" step; opening never marks a
  topic mastered.

- **AC3 — Progress colours.** Each disc is coloured by its state, derived from the
  **verified log**: **unexplored** (no traversal), **studying** (a traversal, no
  mastery), **mastered** (a mastery event — keeps the R-0030 ✓). The three states
  are visually distinct; unexplored discs clearly read as clickable, not "locked."

- **AC4 — Covered trail.** Bridges whose **both** endpoints are visited (studying
  or mastered) are drawn in a distinct **covered** colour — the territory you've
  walked. Uncovered bridges keep the existing faint style.

- **AC5 — Pure + tested.** A pure `visitedTopics(events, pubkey) → Set<plateauId>`
  (the traversal analogue of `masteredTopics`) is **unit-tested** (only
  `KIND_TRAVERSAL` events for that pubkey, deduped, ignores other kinds,
  deterministic). The progress-colour and covered-trail selection are pure render
  inputs.

- **AC6 — Reframe is clean, nothing else breaks.** Reach/reputation is still
  computed and still drives rank/discovery (R-0010) and the lens orientation; it
  simply no longer **gates** clicks or **colours** discs. The HUD reflects
  progress (e.g. mastered / studying / total) rather than "lit/total". Traversal,
  mastery, presence, study, resources, bridge-clicking, reset, and sync are
  unchanged. No Rust/wasm/CRDT/reputation-math change.

- **AC7 — Earned + resettable.** Progress is the signed log, so it **persists**
  across reload and **Reset my history** returns every topic to **unexplored**
  (and the trail clears) — exactly like reach/mastery. A tampered/unsigned
  localStorage entry never colours a topic.

- **AC8 — Green + browser-verified.** All suites green; in the browser a visitor
  clicks an **unexplored** topic (any, fogged or not), it opens and turns
  **studying**, masters it → **mastered ✓**, the **covered trail** lights between
  visited topics, reload persists it, reset clears it — no uncaught console
  errors.

## 4. Constraints & non-goals

- **Presentation + interaction only.** Recolour + ungate the click + derive
  "visited"; no data-model, reputation, or CRDT change. Opening reuses the
  existing traversal sign.
- **Reach is demoted, not deleted.** The reachability computation stays for
  rank/discovery and orientation; it stops gating/colouring the map. (A faint
  "in your orientation" cue is an optional spec detail, not required.)
- **Non-goals:** suggested-route **pathfinding** (the deferred "illuminate a route
  to X" — a separate, larger feature; this requirement is the **covered** trail
  only); an ordered polyline through exact visit-order (the covered subgraph —
  bridges between visited plateaus — is the trail this phase); community-approval
  bedrock (R-0031, composes later); changing the projection/zoom/labels.

## 5. Open questions

- **Palette.** Distinct, accessible colours for unexplored / studying / mastered
  (+ the covered-trail stroke) on the dark map. Spec fixes them; unexplored must
  not read as "disabled."
- **Trail definition.** Covered = a bridge with **both** endpoints visited (lean,
  simple) vs. a time-ordered route. Lean: both-endpoints-visited subgraph. Spec
  confirms.
- **Reach's residual visual role.** Drop reach from the map entirely vs. keep a
  faint orientation cue. Lean: drop from the map this phase (progress is the
  signal); reach stays in rank/discovery. Spec decides.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-17 | Map colour = **progress** (unexplored/studying/mastered), not earned reach; clicks **ungated** | Owner chose a browsable learning map over a fog gate; friendlier, and progress is the meaningful signal once mastery exists (R-0030) |
| 2026-06-17 | **Opening signs the existing traversal** (= studying); no new event/peek state | "Studying/covered" must be recorded + verifiable + on the trail; the traversal already means "I visited here" — reuse it, just ungated |
| 2026-06-17 | Covered trail = bridges between two **visited** plateaus | Derivable from the visited set; reads as "territory walked"; an ordered polyline is deferred |

## Changelog

- 2026-06-17 created (Accepted) — the owner's browsable-map idea: click anything,
  colour by progress (unexplored/studying/mastered), trace the covered trail;
  fog reframed from gate to progress overlay. Pending SPEC-0033 + architect.
- 2026-06-17 QA sign-off — **PASS**, Status → Met (see QA report below).

## QA — R-0033 Browsable progress map: explore freely, color by progress, trace your trail

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) / evidence | Result |
|----|--------------------|--------|
| AC1 — every plateau clickable; empty space inert; bridge click intact | `main.js` click handler hit-tests ALL `graph.plateaus()` within `RADIUS` (the `clickable=reachable+trailheads` gate and `if(!clickable.has)continue` removed); the `overAnyDisc` bridge guard removed — sound because every disc is now a candidate, so "over a disc" ⇔ `hit` is set → disc precedence over `pickBridge` holds; fixed `RADIUS` unchanged. Browser: after reset (0/0), clicked an unexplored disc → opened ("Motion"), HUD → "1 studying"; empty space inert; bridge opens only on no-disc-hit. | PASS |
| AC2 — opening = studying; no new kind; mastery still the quiz step | On a disc hit: `announcePresence()` + `signTraversal(domain, hit)` (existing `KIND_TRAVERSAL`=30078) + `openPlateau(hit)`; no mastery signed on open. `signMastery`/`renderMastery` quiz path unchanged. Browser: open signs a traversal, no CRDT write. | PASS |
| AC3 — unexplored/studying/mastered colours from the verified log; unexplored reads clickable | `render.js`: per-disc state from `mastered`/`visited` (not `reachable`): UNEXPLORED #2f3e50 + ring, STUDYING #e0a64a, MASTERED #ffd166 + LIT_RING + ✓; fog `globalAlpha=0.35` dimming removed → all full alpha. Browser: 30 grey clusters at reset; studying=amber, mastered=gold+✓. | PASS |
| AC4 — covered trail = bridges between two visited plateaus | `render.js`: `covered = visited.has(b.from) && visited.has(b.to)` → COVERED #6fb6e0 width 2.5, else faint BRIDGE. Browser: covered trail draws blue between visited topics. | PASS |
| AC5 — `visitedTopics` pure + unit-tested; `TRAVERSAL_KIND` pinned; labels intact | `mastery.test.mjs` (9 tests, +4): `TRAVERSAL_KIND===30078`; `visitedTopics` own-pubkey-only, dedupe, skip null/malformed plateau, skip other kinds/pubkeys, deterministic. `planLabels` receives `reachable: visited` (valid Set) so R-0024 priority tier intact. | PASS |
| AC6 — reach demoted (no gate/colour) but still computed; HUD = progress; nothing else breaks; no Rust/CRDT change | `reachable_plateaus`/`nearest_plateaus` called ONLY in `buildContextForTurn` (companion grounding) — removed from the draw/click paths. HUD = "N mastered · M studying · T topics · B bridges" (`studying = visited \ mastered`). `git diff --stat` shows only `apps/web/src/*` + R/SPEC docs; `git diff --stat -- crates/` empty. Traversal/mastery/presence/study/resources/bridge/reset/sync untouched. | PASS |
| AC7 — persists across reload; reset → all unexplored + trail clears; tampered never colours | `visited`/`mastered` derived from `log.all()` at init and on every `ingest`; `reset-fog` → `log.clear()` + `recomputeProgress()` + `draw()`. Log is BIP340-verify-gated (`makeLog`/`log.add`), so unsigned/tampered entries never enter → never colour. Browser: "1 mastered · 8 studying" after reload; 0/0 after reset. | PASS |
| AC8 — green + browser-verified end to end | All suites green (below). Recorded browser evidence accepted: browsable open → studying → master → mastered ✓; covered trail lights; reload persists; reset clears; console clean. | PASS |

### Suites

- **Unit (web):** `node --test apps/web/src/*.test.mjs` — **203 pass, 0 fail** (mastery.test.mjs 9/9, +4 for R-0033).
- **e2e / browser (AC8):** recorded browser evidence accepted — browsable open, progress palette, covered trail, persist, reset, console clean.
- **Rust workspace:** `cargo test --workspace` — green (all suites 0 failed; `git diff --stat -- crates/` empty — NO Rust change).
- **Lint:** `cargo clippy --workspace --all-targets -- -D warnings` — clean (exit 0).
- **Format:** `cargo fmt --all --check` — clean (exit 0).

### Gaps / failures

None blocking. Two non-blocking notes for the owner:
1. **Stale comments in `render.js`** — the file header (lines 1–3, "Lit plateaus drawn solid; fogged ones dimmed and low-alpha") and the `render` JSDoc ("`reachable` is a Set of lit plateau ids") still describe the pre-R-0033 fog model; the code no longer takes `reachable`. Comment drift only, no functional impact.
2. **Unguarded `points.get(p.id)` in the click hit-test loop** — `pt.x` is dereferenced without a null check across ALL plateaus. Safe under the current invariant (every graph mutation calls `draw()`, which repopulates `points` from the same `to_graph()`), and a pre-existing pattern (the prior gated loop did the same), so not introduced by R-0033. Worth a defensive `if (!pt) continue` in a future hardening pass.

Note: `Cargo.lock` shows a pre-existing unrelated `garust-physics` entry (present in the starting git snapshot, not part of R-0033); no `crates/` source changed.
