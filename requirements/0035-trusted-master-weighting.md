# R-0035 — Trusted-master weighting (approval by earned reach, not a head-count)

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-20
- **Depends on:** R-0031 (the community-approval overlay this refines), R-0030 (the mastery sign), R-0010 (Nostr identity + rank recomputed from the verified log — the reach this weights by), R-0002 (the GA reputation engine: reputation is a `Multivector`, a Sybil collapses to grade-0)
- **Realized by:** SPEC-0035
- **QA:** `qa` agent — PASS on AC1–AC6 (2026-06-20)

## 1. Statement

R-0031 marks a topic **community-approved** when **N distinct pubkeys** have signed a
mastery for it. R-0031 itself flagged this as **Sybil-gameable**: a single actor can
mint N keypairs and sign N masteries to manufacture approval. This requirement closes
that hole by **weighting each master by their own earned reach** instead of counting
heads. A topic is community-approved when the **sum of its distinct masters' reach**
— the **grade-1 magnitude of their GA reputation in the topic's domain** (R-0002/R-0010)
— **clears a bar**. Because a Sybil cluster **collapses to grade-0** (the project's
core Sybil signature — they vouch in a ring but never escape scalar, so their grade-1
reach is ≈ 0), N fake masters contribute ≈ 0 weight and **cannot** approve a topic. A
few genuinely-reputable masters, or many modestly-reputable ones, can.

This reads the **already-computed** GA reputation (R-0010 recomputes it from the
verified event log); it adds **no new event**, **no Rust/CRDT change**, and does not
alter how reputation is computed or the rule that reputation is never a scalar and
never in the CRDT. It changes **only** the approval predicate (R-0031).

## 2. Rationale

The project's whole reputation thesis is that **rank is a multivector and Sybils
grade-collapse** (R-0002). R-0031 introduced community approval but, for POC speed,
counted raw pubkeys — leaving the GA Sybil resistance on the table. This requirement
spends that resistance where it matters: approval should mean "people who have *earned
standing in this domain* attest this topic," not "N keys exist." It is the natural,
GA-faithful refinement the owner deferred in R-0031 §4, and it composes — the reach it
weights by is exactly the `reach` already surfaced in discovery (R-0010), so no new
math and no new event are needed.

## 3. Acceptance criteria

- **AC1 — Weighted approval.** A topic is community-approved iff the **sum over its
  distinct masters** of each master's **reach in the topic's domain** is **≥ a bar**
  (replacing R-0031's raw-count ≥ threshold). The bar is a POC-calibrated reach
  magnitude.

- **AC2 — Sybil resistance (the point).** A cluster of **grade-collapsed** masters
  (a Sybil ring — reach ≈ 0 in every domain) does **not** approve a topic, **no matter
  how many** sign it. Head-count alone never clears the bar; only earned reach does.

- **AC3 — Domain-scoped, earned reach.** A master's weight is their **grade-1
  reputation magnitude in the topic's own domain** — reach earned in a *different*
  domain does **not** count toward this topic. The weight comes from the **verified
  event corpus** (own + discovered, R-0010); a master with no earned/visible reach in
  the domain lends ~0 weight (conservative).

- **AC4 — Reuses the existing reputation; core untouched.** The weight is **read** from
  the existing GA reputation (R-0002/R-0010 — `reach`/grade-1 magnitude), via the
  existing wasm bindings. **No new event kind, no Rust change, no CRDT field**;
  reputation stays a `Multivector`, **never** a scalar field and **never** in the CRDT;
  mastery events (R-0030) are unchanged and still do not feed reputation.

- **AC5 — Pure + tested.** The weighted approval is a **pure** function — the reach
  source is **injected** (a `weightOf(pubkey, domain)` + a `domainOf(topic)`), so it is
  **unit-tested** with stubs: a Sybil ring (all weights 0) is **not** approved; a few
  high-reach masters **are**; cross-domain reach does **not** count; the bar boundary
  (just-under vs at) holds; deterministic. With a unit weight it reduces to R-0031's
  count (back-compatible default).

- **AC6 — Green + browser-verified.** All suites green; in the browser, the R-0031
  bedrock/approval overlay now reflects **weighted** approval — a topic the local
  (reach-bearing) wizard masters can cross the bar, and the overlay updates as reach
  changes; no uncaught console errors.

## 4. Constraints & non-goals

- **Read reputation, don't re-derive it.** Reuse the R-0002/R-0010 reach; do not add a
  new reputation computation, event kind, or CRDT field. The Sybil resistance is the
  **existing** grade-collapse, merely *applied* to approval.
- **Approval only.** This changes the R-0031 community-approval predicate. It does
  **not** touch the R-0030 **personal** mastery (self-attested ✓ stays a head-count of
  one — your own claim), the fog/reach mechanic, or rank/discovery.
- **Non-goals:** a new anti-Sybil mechanism (we lean on grade-collapse, not add to it);
  weighting personal mastery or traversals; a configurable/per-domain bar (one
  POC-calibrated bar; tuning is a later step); slashing/decay of approval; storing the
  weight or approval in the CRDT or an event (approval stays a derived view).

## 5. Open questions

- **The bar.** A reach-magnitude threshold to be **calibrated** against real
  traversal-earned reach so a few genuine masteries approve while a Sybil ring does
  not. Spec fixes a default + how it's verified (browser).
- **Reach source binding.** Reuse `rank_wizards(events, domain, K)` (reach per pubkey
  per domain, one call per domain) vs. `recompute_reputation(events, pubkey)` per
  master. Spec picks; lean `rank_wizards` (already returns the grade-1 reach, efficient).
- **Newcomer fairness.** Pure reach-weighting gives a brand-new legitimate master ~0
  weight until they earn reach. Accepted for the POC (conservative > gameable); noted
  as a known tradeoff, not solved here.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | Approve by **weighted reach sum ≥ bar** (vs. trusted-count, vs. raw-count-minus-Sybils) | Owner choice — most faithful to "trusted-master weighting" and the GA thesis (reputation magnitude is the weight); a Sybil's grade-0 collapse makes its weight ~0 automatically |
| 2026-06-20 | Weight = **grade-1 reach in the topic's domain**, from the verified corpus | Domain-scoped standing is what should attest a domain's topic; reuses the exact `reach` discovery already shows (R-0010) |
| 2026-06-20 | **Read** existing reputation; no new event/Rust/CRDT | The Sybil resistance already exists (grade-collapse, R-0002) — this only applies it to approval; keeps the core invariants |
| 2026-06-20 | Pure approval fn with an **injected** reach source | Keeps `mastery.js` pure/node-testable (the wasm-backed reach is the app's concern), mirroring the project's DI-for-purity pattern |

## Changelog

- 2026-06-20 created (Accepted) — refine R-0031: community approval weighted by each
  master's earned domain reach (grade-1 reputation magnitude), so a Sybil ring (grade-0,
  reach ≈ 0) cannot manufacture approval. Reads existing reputation; no new event/Rust/CRDT.
  Pending SPEC-0035 + architect review.
