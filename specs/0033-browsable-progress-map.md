# SPEC-0033 — Browsable progress map (ungate clicks, colour by progress, covered trail)

- **Status:** Implemented
- **Realizes:** R-0033
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-17
- **Depends on:** SPEC-0005 (render + click hit-test), SPEC-0010 (the traversal log), SPEC-0030 (`masteredTopics`/`mastery.js`, the ✓), SPEC-0024 (camera + RADIUS), SPEC-0029 (bridge click)
- **Module(s):** `apps/web/src/mastery.js` (+ `mastery.test.mjs`) — add `visitedTopics` + `TRAVERSAL_KIND`; `apps/web/src/render.js` — progress palette + covered-trail stroke + the `planLabels` priority Set; `apps/web/src/main.js` — ungate the click, derive `visited`, HUD; **copy that's now false** — `apps/web/src/tutorial.js` step 3 ("the fog is earned"), and the softer `apps/web/src/persona.js` blurbs + the author-form hint in `main.js`. **No Rust/wasm rebuild, no CRDT/reputation change.**

## 1. Motivation

R-0033: a browsable progress map. Everything is derivable from the verified log
— "studying" = traversal events, "mastered" = mastery events (R-0030) — so this
is a render + interaction change: ungate the click, recolour discs by progress,
and colour the bridges between visited topics.

## 2. Design

### 2.1 `mastery.js` — the "visited" derivation (pure)

```js
// MUST match mp_identity::KIND_TRAVERSAL (30078, shipped since R-0010). Pinned by
// a unit test (=== 30078), NOT a runtime wasm pin like MASTERY_KIND: no
// `traversal_kind()` accessor exists, adding one forces a wasm rebuild (breaking
// R-0033's JS-only scope), and 30078 is frozen since R-0010 (changing it would
// break every existing signed log). The JS assertion is an adequate drift-guard.
export const TRAVERSAL_KIND = 30078;

/** Plateau ids `pubkey` has a (verified) traversal for — i.e. "studying/visited".
 *  Pure sibling of masteredTopics. Traversal content carries an OPTIONAL
 *  `plateau` (a positional-only traversal serializes `plateau: null`); a null is
 *  safely skipped — the web app's signTraversal always passes the plateau id. */
export function visitedTopics(events = [], pubkey) {
  const out = new Set();
  for (const e of events) {
    if (!e || e.kind !== TRAVERSAL_KIND || e.pubkey !== pubkey) continue;
    try {
      const p = JSON.parse(e.content)?.plateau;
      if (p) out.add(p);
    } catch {
      /* malformed — skip */
    }
  }
  return out;
}
```

### 2.2 `main.js` — ungate the click, derive progress

- Add `let visited = visitedTopics(log.all(), myPubkey)`; refresh it wherever
  `mastered` refreshes (rename the helper to `recomputeProgress()` that sets both
  `mastered` **and** `visited`, called in `ingest` + `reset-fog`). `TRAVERSAL_KIND`
  is pinned by a `mastery.test.mjs` assertion (`=== 30078`), not a wasm call — so
  no rebuild is needed and R-0033 stays JS-only.
- **Click handler (the reframe):** drop the `clickable = reachable + trailheads`
  gate. Hit-test **all** `graph.plateaus()` within `RADIUS` (the existing
  nearest-disc loop, minus the `if (!clickable.has(p.id)) continue`). If a disc is
  hit → `announcePresence()` + `signTraversal(domain, hit)` + `openPlateau(hit)`
  (unchanged — opening = studying). If **no** disc hit → `pickBridge` → `openBridge`
  (R-0029). The old `overAnyDisc` guard is removed: with every disc a candidate,
  "over a disc" ⇔ `hit` is set, so a disc already wins precedence.
- `draw()`: pass `visited` + `mastered` to `render` (drop the `reachable`/`lit`
  set from the render call — the map no longer colours by reach). Reputation is
  still recomputed (`log.reputation()`) and `reachable_plateaus` is no longer
  called *for the map*. **The companion grounding is unchanged:**
  `buildContextForTurn` still calls `graph.reachable_plateaus`/`nearest_plateaus`
  and feeds `reachableIds` to the companion (R-0010) — reach still grounds the
  guide; do NOT remove that call as "unused."
- **HUD:** `${who}${mastered.size} mastered · ${studying} studying · ${plateaus.length} topics · ${bridges.length} bridges`
  where `studying = visited \ mastered` count.

### 2.3 `render.js` — progress palette + covered trail

`render(ctx, { plateaus, bridges, view, resources, peers, focusedId, mastered, visited })`
(drop `reachable`). Per disc, state = `mastered.has(id)` → **mastered**, else
`visited.has(id)` → **studying**, else **unexplored**:

```
UNEXPLORED  fill #2f3e50, stroke #4a5d72   (clearly a clickable node, not "locked")
STUDYING    fill #e0a64a (amber), full alpha
MASTERED    fill #ffd166 (gold) + the existing LIT_RING + the R-0030 ✓
```

All discs draw at full alpha (no fog dimming — nothing is locked). The R-0030 ✓
still draws on mastered discs.

**`planLabels` (R-0024) priority Set:** `render` no longer receives `reachable`,
but `planLabels({ plateaus, points, reachable, focusedId })` uses that Set as its
middle priority tier (`labels.js`). Pass **`reachable: visited`** — so
studied/mastered topics keep label priority over untouched ones. (`labels.test.mjs`
injects its own Set, so no test churn; only the call site changes.)

**Covered trail:** a bridge whose **both** endpoints are in `visited` draws in a
**covered** stroke (`COVERED = #6fb6e0`, width 2.5) instead of the faint `BRIDGE`;
others unchanged. (Visited = studying ∪ mastered, since mastering implies a prior
traversal.)

### 2.4 No reachability gate anywhere on the map

`reachable`/trailheads no longer gate clicks or colour. Trailheads remain seeded
content (R-0022) but carry no special navigation role. Lens orientation (initial
reputation) and discovery/rank (R-0010) are untouched.

### 2.5 Copy that's now false (must rewrite — AC3/AC6)

The reframe makes "the fog is earned" language wrong (nothing is locked):
- **`tutorial.js` step 3** ("Topics you haven't earned sit in fog. Reach lights
  up as you explore…") → rewrite to the progress model, e.g. *"Colour shows your
  progress — unexplored, studying, mastered. Click any topic to study it; quiz
  yourself to master it."* (Required — it directly contradicts AC3's
  "unexplored reads clickable, not locked.")
- **`persona.js` blurbs** + the **author-form hint** in `main.js` ("the world
  stays fogged until you explore") → soften to flavour that doesn't claim gating
  (e.g. "your lens orients where you begin"). Minor, but update so nothing claims
  a mechanic that's gone.

## 3. Code outline

- `mastery.js`: `TRAVERSAL_KIND` + `visitedTopics` (~12 lines, mirrors
  `masteredTopics`).
- `mastery.test.mjs`: `TRAVERSAL_KIND === 30078`; `visitedTopics` (own
  KIND_TRAVERSAL only, dedupe, skip other kinds/pubkeys/malformed, deterministic).
- `main.js`: `visited` + `recomputeProgress`; ungated click loop; HUD; render args.
- `render.js`: progress palette consts + per-disc state colour + covered-trail
  bridge stroke; drop the `reachable`-alpha path.

## 4. Non-goals

Per R-0033 §4: no pathfinding/suggested route (covered trail only); no ordered
polyline (both-endpoints-visited subgraph); no data-model/reputation/CRDT change;
no projection/zoom/label change; community bedrock (R-0031) composes later.

## 5. Open questions (resolved here)

- Palette pinned in §2.3 (unexplored reads clickable, not disabled).
- Trail = both-endpoints-visited subgraph. §2.3.
- Reach dropped from the map this phase; stays in rank/discovery. §2.4.

## 6. Acceptance criteria

Maps to R-0033 AC:

- [ ] AC1 — any disc clickable; empty space inert; bridge click still works. *(browser)*
- [ ] AC2 — opening signs the existing traversal (studying); no new kind; mastery
      still the quiz step. *(code + browser)*
- [ ] AC3 — unexplored/studying/mastered colours from the log; unexplored reads clickable. *(browser)*
- [ ] AC4 — covered trail = bridges between visited plateaus. *(browser)*
- [ ] AC5 — `visitedTopics` pure + unit-tested; `TRAVERSAL_KIND` pinned. *(node --test)*
- [ ] AC6 — reach demoted (no gate/colour) but still computed for rank/discovery;
      HUD shows progress; traversal/mastery/presence/bridge/reset/sync intact;
      no Rust/CRDT/reputation change. *(diff + suites + browser)*
- [ ] AC7 — persists across reload; Reset my history → all unexplored + trail clears. *(browser)*
- [ ] AC8 — browser: click unexplored → studying → master → mastered ✓; trail
      lights; reload persists; reset clears; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-17 | Drop the `clickable=reachable` gate; hit-test all discs | The browsable reframe (R-0033); "over a disc" now ⇔ hit, so disc precedence over bridges still holds |
| 2026-06-17 | Colour by progress sets (visited/mastered), drop reach from render | Progress is the signal; reach stays for rank/discovery only |
| 2026-06-17 | `TRAVERSAL_KIND` hardcoded in JS + unit-pinned (no wasm rebuild) | Keeps R-0033 truly JS-only; the kind is frozen since R-0010 |
| 2026-06-17 | Covered trail = both-endpoints-visited bridges | Pure over the visited set; reads as territory walked; ordered route deferred |

## Changelog

- 2026-06-17 created (Draft) — ungate clicks, progress palette
  (unexplored/studying/mastered), covered trail; `visitedTopics` pure helper.
  Pending architect review, then `Accepted`.
- 2026-06-17 architect design review: **REQUEST-CHANGES → resolved**. The reframe
  itself verified sound (disc precedence holds → the R-0029 `overAnyDisc` guard
  becomes dead code and is removed; opening-any-plateau signs a valid traversal
  with a well-defined domain; no CRDT/reputation change; `visitedTopics` mirrors
  `masteredTopics`). Folded the must-fixes: `planLabels` now gets `reachable:
  visited` (was about to break on a dropped arg); pinned that the **companion
  grounding** (`buildContextForTurn`/`reachableIds`/`nearest_plateaus`) stays
  (reach still grounds the guide); added the **copy rewrites** (`tutorial.js`
  step 3 + `persona.js`/author-hint) since "fog is earned" now contradicts AC3;
  documented the `plateau`-optional skip and the `TRAVERSAL_KIND` JS-pin
  rationale. **Status → Accepted.**
- 2026-06-17 implemented + browser-verified. `mastery.js` `visitedTopics` +
  `TRAVERSAL_KIND` (+4 tests); `main.js` ungated click (all discs; `overAnyDisc`
  removed) + `recomputeProgress` + progress HUD; `render.js` progress palette +
  covered trail + `planLabels` `reachable: visited` (dead LIT/FOG removed); copy
  rewrites (tutorial step 3, persona blurbs, author hint). 203 JS tests; cargo
  workspace/clippy/fmt green & unchanged (no `crates/` diff). Browser: reset →
  clicked an unexplored disc → opened with no earned reach → "1 studying";
  visited all → covered trail (blue) + studying (amber) + mastered (gold ✓);
  reload persisted "1 mastered · 8 studying"; reset cleared; console clean. QA
  PASS → R-0033 **Met**. **Status → Implemented.**
