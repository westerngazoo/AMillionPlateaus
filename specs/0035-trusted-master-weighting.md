# SPEC-0035 — Trusted-master weighting (approval by summed domain reach, Sybils collapse to ~0)

- **Status:** Implemented
- **Realizes:** R-0035
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-20
- **Depends on:** SPEC-0031 (`communityApproved`/`masteryCounts` + the bedrock overlay), SPEC-0010 (`rank_wizards` → per-wizard `reach` in a domain), SPEC-0002 (reputation is a `Multivector`; `reach` = grade-1 magnitude; Sybil = grade-collapse)
- **Module(s):** `apps/web/src/mastery.js` (+ `mastery.test.mjs`) — `communityApproved` becomes **weighted** with an injected reach source (pure); `apps/web/src/main.js` — `recomputeProgress` builds the wasm-backed `weightOf`/`domainOf` and a calibrated bar. **No Rust/wasm rebuild (reuses `rank_wizards`), no CRDT/reputation-shape change, no new event.**

## 1. Motivation

R-0035: replace R-0031's raw distinct-pubkey count with a **reputation-weighted** sum.
A topic is community-approved when the sum of its distinct masters' **reach** (grade-1
reputation magnitude in the topic's domain — the value discovery already shows, R-0010)
**clears a bar**. A **vouch-only** Sybil ring **grade-collapses** (R-0002 — keys that only vouch for each
other never escape grade-0) so each fake master's reach is ≈ 0 → the ring's weight is
≈ 0 → it cannot approve, no matter how many keys. This **reads** the existing GA
reputation (via the existing `rank_wizards` binding) — no new event, no Rust/CRDT change.

**Scope of the resistance (architect note):** the guarantee is against the canonical
Sybil signature — a *vouch-ring* with no earned traversals. A Sybil who *self-signs
traversals* does earn genuine grade-1 reach (cheaply, this phase: a traversal costs no
quiz/peer attestation). Defeating that is the **bar's calibration** job (and a future
cost-on-traversal step), not this model's — R-0035 §4 books it as a known POC tradeoff.
The AC2 unit test proves the vouch-ring (weight-0) case; it is not read as proving more.

## 2. Design

### 2.1 `mastery.js` — weighted approval (pure, injected reach source)

Extract the per-topic master set (shared with `masteryCounts`), then sum injected
weights:

```js
export const COMMUNITY_THRESHOLD = 3; // unchanged — the DEFAULT bar when weights are unit (head-count)

// plateauId → Set<pubkey> of (verified) masters. The shared dedup (a topic mastered
// twice by one wizard = one master). Pure.
function mastersByTopic(events = []) {
  const byTopic = new Map();
  for (const e of events) {
    if (!e || e.kind !== MASTERY_KIND) continue;
    try {
      const plateau = JSON.parse(e.content)?.plateau;
      if (!plateau) continue;
      (byTopic.get(plateau) ?? byTopic.set(plateau, new Set()).get(plateau)).add(e.pubkey);
    } catch { /* malformed — skip */ }
  }
  return byTopic;
}

// plateauId → distinct-master COUNT (unchanged R-0031 surface; kept for display).
export function masteryCounts(events = []) {
  const counts = new Map();
  for (const [plateau, who] of mastersByTopic(events)) counts.set(plateau, who.size);
  return counts;
}

/**
 * Community-approved topics, WEIGHTED by each master's earned reach (R-0035). For each
 * topic, sum `weightOf(pubkey, domainOf(topic))` over its distinct masters; approve if
 * the sum ≥ `bar`. Pure + deterministic — the reach source is INJECTED:
 *   - weightOf(pubkey, domainId) → number  (a master's grade-1 reach in that domain; default 1)
 *   - domainOf(plateauId)        → domainId (default undefined)
 * Defaults (unit weight, bar = COMMUNITY_THRESHOLD) reproduce R-0031's head-count.
 * Negative/NaN/absent weights coerce to 0 (a Sybil / unknown master never adds, never subtracts).
 */
export function communityApproved(events = [], opts = {}) {
  const { bar = COMMUNITY_THRESHOLD, weightOf = () => 1, domainOf = () => undefined } = opts;
  const out = new Set();
  for (const [plateau, who] of mastersByTopic(events)) {
    const domain = domainOf(plateau);
    let sum = 0;
    for (const pk of who) {
      const w = weightOf(pk, domain);
      if (Number.isFinite(w) && w > 0) sum += w; // clamp: never negative, NaN ⇒ 0
    }
    if (sum >= bar) out.add(plateau);
  }
  return out;
}
```

`masteredTopics`/`visitedTopics` (R-0030/R-0033) are unchanged. The **signature change**
(second arg: number → options) updates the one call site (main.js) and the R-0031 tests.

### 2.2 `main.js` — the wasm-backed reach source (in `recomputeProgress`)

`recomputeProgress` already recomputes `community` from `log.all()`. It now also builds
the weight source from the **already-verified** corpus, reusing `rank_wizards` (one call
per domain that has masteries — `reach` per pubkey in that domain):

```js
const APPROVAL_REACH = 1.5; // POC-calibrated bar (a reach magnitude). Tuned + browser-verified (§6).
const MASTER_K = 256;       // rank_wizards top-K — large enough to include every master this phase

// NOTE: re-derives reputation once per mastery-bearing domain (the same `recompute`
// the fog path already pays) — fine for the POC log size; not a cheap call.
function reachWeights(events) {
  const logJson = JSON.stringify(events);
  // domains that actually have masteries (skip the rest — no wasm call needed)
  const domains = new Set();
  for (const e of events) {
    if (e?.kind !== MASTERY_KIND) continue;
    try {
      const plateau = JSON.parse(e.content)?.plateau;
      const d = plateau && DOMAIN_OF.get(plateau);
      if (d) domains.add(d);
    } catch { /* skip */ }
  }
  const byDomain = new Map(); // domainId → Map<pubkey, reach>
  for (const domain of domains) {
    try {
      const rows = rank_wizards(logJson, domain, MASTER_K); // [{pubkey, reach}]
      byDomain.set(domain, new Map(rows.map((r) => [r.pubkey, r.reach])));
    } catch (err) { console.error("[mp] rank_wizards (weighting) failed:", err); }
  }
  return byDomain;
}

function recomputeProgress() {
  mastered = masteredTopics(log.all(), myPubkey);
  visited = visitedTopics(log.all(), myPubkey);
  const byDomain = reachWeights(log.all());
  community = communityApproved(log.all(), {
    bar: APPROVAL_REACH,
    domainOf: (plateau) => DOMAIN_OF.get(plateau),
    weightOf: (pk, domain) => byDomain.get(domain)?.get(pk) ?? 0,
  });
}
```

`DOMAIN_OF` (plateau→domain) and `rank_wizards`'s `domain` are the **same** id space
(both flow from the seed/DTO `domain_id`; discovery already calls
`rank_wizards(log, domain, K)` with a faced-domain id). The local wizard is included in
`rank_wizards` (discovery shows "you"), so a reach-bearing local master counts. A master
with no earned/visible reach in the domain → absent from the rows → weight 0 (AC3,
conservative).

### 2.3 Render / overlay — no change

The R-0031 bedrock/approval overlay already renders from the `community` set passed to
`render(...)`. Only the *contents* of that set change (now weighted), so there is **no
markup/CSS/render change** — the overlay simply reflects weighted approval (AC6).

## 3. Code outline

- `mastery.js`: `mastersByTopic` (shared dedup), `masteryCounts` (unchanged surface),
  `communityApproved` (weighted, injected `weightOf`/`domainOf`, clamp negatives/NaN→0,
  unit-weight default == R-0031).
- `mastery.test.mjs`: update the R-0031 `communityApproved` tests to the options API
  (`{ bar: 3 }`, default unit weight → head-count unchanged); add weighted tests — a
  Sybil ring (5 masters, all weight 0) is **not** approved; few high-reach masters
  **are** (e.g. 2 masters × 0.8 = 1.6 ≥ 1.5); **cross-domain** reach does not count
  (weightOf returns 0 for the wrong domain); bar boundary (just-under vs at); negative/NaN
  weight ⇒ 0; deterministic.
- `main.js`: `APPROVAL_REACH`, `MASTER_K`, `reachWeights`, and the `recomputeProgress`
  rewrite (the only call site of `communityApproved`).

## 4. Non-goals

Per R-0035 §4: no new reputation computation/event/CRDT field (reputation stays a
`Multivector`, never scalar, never in the CRDT); no change to R-0030 personal mastery,
fog/reach, or rank/discovery; one POC bar (no per-domain/config bar); no decay/slashing;
the approval stays a derived view (never stored).

## 5. Open questions (resolved here)

- **Reach source** = reuse `rank_wizards(events, domain, MASTER_K)` (one call per
  mastery-bearing domain), not per-pubkey `recompute_reputation` — fewer calls, and it
  returns exactly the grade-1 `reach`. §2.2.
- **Bar** = `APPROVAL_REACH` (a reach magnitude), POC-calibrated and **browser-verified**
  (§6) so a realistically-active master can approve while a Sybil ring (≈0) cannot. §2.2.
- **Purity** = `communityApproved` stays pure via injected `weightOf`/`domainOf`; the
  wasm-backed source lives in `main.js`. §2.1/§2.2.

## 6. Acceptance criteria

Maps to R-0035 AC:

- [x] AC1 — approval = summed domain reach ≥ bar (replaces raw count). *(communityApproved tests + browser)*
- [x] AC2 — a Sybil ring (many masters, all reach ≈ 0) is NOT approved. *(unit test: 5 × weight 0 ⇒ not approved)*
- [x] AC3 — weight is domain-scoped earned reach; cross-domain reach doesn't count; absent ⇒ 0. *(unit tests)*
- [x] AC4 — reuses existing reputation/`rank_wizards`; no new event, no Rust/CRDT/reputation-shape change. *(diff)*
- [x] AC5 — `communityApproved` pure + unit-tested (Sybil-0, high-reach approve, domain-scope, bar boundary, NaN/neg→0, unit-weight==count). *(node --test)*
- [x] AC6 — suites green; browser: the bedrock overlay reflects weighted approval (a reach-bearing master's topic can cross the bar; updates as reach changes); console clean. *(browser)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | Sum injected `weightOf(pubkey, domain)` over distinct masters; approve ≥ `bar` | Owner-chosen weighted-reach rule; keeps `mastery.js` pure (the wasm reach is the app's concern) |
| 2026-06-20 | Reuse `rank_wizards` for per-pubkey domain reach | It already returns the grade-1 `reach`; one call per domain; no Rust change |
| 2026-06-20 | Unit-weight default + `bar = COMMUNITY_THRESHOLD` reproduces R-0031 | Back-compatible; the weighting is a strict, opt-in refinement at the call site |
| 2026-06-20 | Clamp weight to ≥ 0 (NaN/absent ⇒ 0) | A Sybil/unknown can never add OR subtract; approval is monotonic in real reach |

## Changelog

- 2026-06-20 implemented + QA **PASS** (AC1–AC6). `mastery.js` — `communityApproved` now
  weighted (injected `weightOf`/`domainOf`, clamp NaN/neg/absent → 0, unit-weight default ==
  R-0031), shared `mastersByTopic`; +6 mastery tests (Sybil ring, high-reach approve,
  cross-domain, bar boundary, clamp, back-compat). `main.js` — `recomputeProgress` →
  `approvedTopics()` builds `reachWeights` (one `rank_wizards` per mastery-bearing domain) and
  calls weighted `communityApproved` with `APPROVAL_REACH=2.5`. **No Rust/wasm/CRDT/event
  change.** Suite 250 green. Browser-verified offline: HUD "4 mastered · 4 canonical" at bar
  2.5 (Mathematics reach 6.46 ≥ bar); **gating proof** — bar 100 → 0 canonical, bar 2.5 → 4
  canonical (the summed reach is genuinely compared to the bar); console clean. **Status →
  Implemented.**
- 2026-06-20 architect design review: **APPROVE** (two non-blocking notes folded in — the
  Sybil resistance is against vouch-ring grade-collapse; the bar is POC-calibrated; the
  domain id-space match was verified end-to-end as no silent-0 path).
- 2026-06-20 created (Draft) — weight R-0031 community approval by each master's earned
  domain reach (grade-1 reputation magnitude via `rank_wizards`); a Sybil ring collapses
  to ~0 weight and cannot approve. Pure injected reach source; no new event/Rust/CRDT.
  Pending architect review, then `Accepted`.
