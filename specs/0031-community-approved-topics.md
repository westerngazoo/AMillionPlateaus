# SPEC-0031 — Community-approved topics (crystallize a topic from crowd mastery)

- **Status:** Implemented
- **Realizes:** R-0031
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-17
- **Depends on:** SPEC-0030 (the `KIND_MASTERY` events + `mastery.js`), SPEC-0010 (the verified corpus: own log + discovered peers), SPEC-0015 (the crystallization pattern), SPEC-0033 (the progress render the bedrock overlay sits on)
- **Module(s):** `apps/web/src/mastery.js` (+ `mastery.test.mjs`) — `communityApproved` + `COMMUNITY_THRESHOLD`; `apps/web/src/main.js` — derive `community`, HUD; `apps/web/src/render.js` — the bedrock overlay ring. **No Rust/wasm rebuild, no CRDT/reputation change.**

## 1. Motivation

R-0031: a topic many wizards have mastered is community-approved (canonical). The
mastery events (R-0030) are already signed + discoverable (R-0010), so this is a
**pure count over the verified corpus** (distinct mastering pubkeys per topic) +
a render overlay — mirroring resource crystallization (R-0015), lifted to topics.

## 2. Design

### 2.1 `mastery.js` — the distinct-wizard count (pure)

```js
// Distinct wizards a topic needs before it's community-approved (canonical).
// A small POC count, like R-0015's crystallize threshold (which is a vote-weight
// sum in Rust; this is a wizard COUNT, so it lives in JS).
export const COMMUNITY_THRESHOLD = 3;

/** plateauId → number of DISTINCT pubkeys with a (verified) mastery event for it.
 *  Pure; pubkey-agnostic (counts the whole corpus, unlike masteredTopics). */
export function masteryCounts(events = []) {
  const byTopic = new Map(); // plateauId → Set<pubkey>
  for (const e of events) {
    if (!e || e.kind !== MASTERY_KIND) continue;
    try {
      const p = JSON.parse(e.content)?.plateau;
      if (!p) continue;
      let who = byTopic.get(p); // explicit form (house style: no clever one-liner)
      if (!who) byTopic.set(p, (who = new Set()));
      who.add(e.pubkey);
    } catch {
      /* malformed — skip */
    }
  }
  const counts = new Map();
  for (const [p, who] of byTopic) counts.set(p, who.size);
  return counts;
}

/** Topics with ≥ `threshold` distinct masters — community-approved. Deterministic. */
export function communityApproved(events = [], threshold = COMMUNITY_THRESHOLD) {
  const out = new Set();
  for (const [p, n] of masteryCounts(events)) if (n >= threshold) out.add(p);
  return out;
}
```

`events` is `log.all()` — own log **plus** discovered peers' mastery events
(R-0010 relay/discovery), all BIP340-verified by `makeLog`. So the count reflects
exactly the verified masteries this client has seen (no global authority — the
same trust model as reputation). A wizard mastering twice counts once (Set of
pubkeys). `masteredTopics` stays single-pubkey (R-0030); this is the separate
pubkey-agnostic counter the R-0030 review asked for.

### 2.2 `main.js` — derive + HUD

- `let community = communityApproved(log.all())`; set it in `recomputeProgress()`
  (beside `mastered`/`visited`), so own + discovered masteries refresh it.
- Pass `community` into `render(...)`.
- HUD: append `· ${community.size} canonical` when `community.size > 0` (the
  progress HUD from R-0033 gains the crowd dimension; otherwise unchanged).

### 2.3 `render.js` — the bedrock overlay

A community-approved disc gets a distinct **outer "bedrock" ring** drawn at
`RADIUS + 4` (a 2px stroke in `CANONICAL = "#bfe3ff"`), **on top of** the personal
progress fill (unexplored/studying/mastered, R-0033) — so the three personal
states still read, and the bedrock ring says "the community vouches for this."
Drawn at `RADIUS + 4` (between the disc edge and the `RADIUS+7` travel focus ring,
no collision) it never changes the hit radius (`RADIUS`, R-0024). **Draw order:**
after the disc fill/stroke and label, before the markers/peers pass — so the ring
sits outside the disc and under the ✓ glyph (the "both" state reads gold + ✓ +
ring). Four distinguishable cases: *you* mastered (gold + ✓), the *crowd* approved
(progress fill + bedrock ring), both (gold + ✓ + ring), neither (plain).

```js
if (community.has(p.id)) {
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, RADIUS + 4, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CANONICAL;
  ctx.stroke();
}
```

## 3. Code outline

- `mastery.js`: `COMMUNITY_THRESHOLD`, `masteryCounts`, `communityApproved` (~16
  lines pure).
- `mastery.test.mjs`: distinct-pubkey count (twice-by-one = 1); threshold boundary
  (N−1 not approved, N approved, with distinct keys incl. a local-style one);
  **explicitly** skips non-mastery kinds, malformed content, and a null/absent
  `plateau` (mirrors `masteredTopics`'s own-test cases); empty → ∅; deterministic.
- `main.js`: `community` set in `recomputeProgress` + render arg + HUD.
- `render.js`: `CANONICAL` const + the outer ring (additive; `community = new Set()`
  default in the signature).

## 4. Non-goals

Per R-0031 §4: no de-crystallizing/decay; no Sybil-resistant weighting by the
master's reputation (raw distinct-pubkey count this phase — a noted future
"trusted-master" refinement); no person-credential vouches (the un-chosen fork);
no CRDT/reputation change; no projection/zoom change.

## 5. Open questions (resolved here)

- `COMMUNITY_THRESHOLD = 3` distinct wizards (POC; the local wizard counts). §2.1.
- Bedrock = an outer ring at `RADIUS + 4` (`#bfe3ff`), overlay on the progress
  fill; hit radius unchanged. §2.3.
- Counts the verified corpus this client has seen (own + discovered) — no global
  authority, same as reputation. §2.1.

## 6. Acceptance criteria

Maps to R-0031 AC:

- [ ] AC1 — a topic with ≥ N distinct masters renders community-approved; below N
      it does not. *(unit + browser w/ injected peers)*
- [ ] AC2 — distinct pubkeys from the verified corpus (own + discovered), not the
      CRDT; twice-by-one counts once. *(unit)*
- [ ] AC3 — bedrock overlay distinct from personal ✓ and ordinary; hit radius
      unchanged. *(browser)*
- [ ] AC4 — `masteryCounts`/`communityApproved` pure + unit-tested (distinct,
      threshold boundary, ignores junk, deterministic). *(node --test)*
- [ ] AC5 — additive; no CRDT/reputation change (reads mastery events, which
      don't feed the multivector); reuses the R-0010 corpus + R-0015 language;
      no injection; suites green. *(diff + suites)*
- [ ] AC6 — browser recipe: mint **2 extra** keypairs (`WasmIdentity.from_secret`),
      `sign_mastery(sharedPlateau)` for each + `ingest` them so 3 distinct wizards
      (the 2 + the local one who masters it) have a verified mastery → the bedrock
      ring **appears** at N=3 and is **absent** at N=2; a topic only the local
      wizard mastered shows just the ✓; console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-17 | Count distinct mastering pubkeys over the verified corpus; ≥ N ⇒ canonical | Mirrors R-0015 (votes→bedrock) for topics; reuses R-0010's corpus; stays off the CRDT (CLAUDE.md §7) |
| 2026-06-17 | Bedrock = an outer ring overlay on the R-0033 progress fill | Composes the personal (you) and community (crowd) signals without a new disc state; hit radius untouched |
| 2026-06-17 | Raw distinct-count, no reputation-weighting this phase | Simplest honest POC; Sybil-resistant "trusted-master" weighting is a noted future refinement |

## Changelog

- 2026-06-17 created (Draft) — `communityApproved` count over the mastery corpus
  + a bedrock overlay ring; threshold 3. Pending architect review, then `Accepted`.
- 2026-06-17 architect design review: **APPROVE-WITH-NITS** — pure/off-CRDT/no-
  reputation-change confirmed; the wiring is free (slots into `recomputeProgress`
  → `draw` → `render`); Sybil-deferral judged an acceptable, clearly-scoped POC
  call (raw distinct-count; "trusted-master" weighting is a noted future Rust-side
  refinement; copy must not imply Sybil-resistance). Folded the four nits:
  explicit `byTopic` form (no clever one-liner); named the null-plateau +
  non-mastery-kind skip tests; pinned the ring draw order; made AC6's browser
  recipe explicit (2 extra `from_secret` keys + local = 3). **Status → Accepted.**
- 2026-06-18 implemented + browser-verified. `mastery.js` `masteryCounts`/
  `communityApproved` + `COMMUNITY_THRESHOLD=3` (+5 tests); `main.js` `community`
  set in `recomputeProgress` + render arg + "· K canonical" HUD; `render.js`
  `CANONICAL` bedrock ring at `RADIUS+4`. 208 JS tests; cargo workspace/clippy/fmt
  green & unchanged (no `crates/` diff). Browser (AC6 recipe): injected 2 distinct
  `from_secret` Motion masteries → reload → no "canonical" (N=2); a 3rd distinct →
  reload → "· 1 canonical" + the `#bfe3ff` bedrock ring on Motion's crowd-only
  (unexplored) disc; console clean. QA PASS → R-0031 **Met**. **Status →
  Implemented.**
