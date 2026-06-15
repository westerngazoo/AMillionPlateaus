# R-0031 — Community-approved topics: a topic the crowd has mastered

- **Status:** Accepted
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** R-0030 (the signed mastery event this counts), R-0010 (the signed-event corpus + relay/discovery that aggregates peers' events), R-0015 (the crystallization pattern this mirrors), R-0005 (the bedrock/disc render)
- **Realized by:** SPEC-0031 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A topic that **many wizards have mastered** is community-approved — canonical
terrain rather than one person's claim. This requirement makes a plateau turn
**community-approved (bedrock/canonical)** once **N distinct wizards** have
signed a mastery event (R-0030) for it. The count is computed from the
**aggregated signed-event corpus** — your own log plus peers' mastery events
discovered over the relay (R-0010) — exactly the corpus reputation already uses,
**not** the CRDT. It mirrors resource crystallization (R-0015), lifted from a
single resource to a whole topic: a topic crystallizes when the community vouches
for it with their mastery.

## 2. Rationale

R-0030 makes mastery a verifiable, shareable signed event; the natural next step
is the social one the owner asked for — "community approved." Resources already
crystallize from community votes (R-0015); a **topic** should crystallize from
community **mastery**. Because mastery events are signed and discoverable
(R-0010), the crowd count is a **pure derivation over the event corpus** —
distinct mastering pubkeys per topic — and needs no new sync channel or CRDT
field (CLAUDE.md §7: reputation-class facts stay off the CRDT). It reuses the
crystallization mental model (a threshold flips terrain to bedrock), so the UI
language and rendering are already familiar.

## 3. Acceptance criteria

- **AC1 — Crowd-mastered ⇒ approved.** A plateau is **community-approved** once
  **≥ N distinct wizards** (distinct pubkeys) have a verified mastery event for
  it. Below the threshold it is not approved; the threshold is a single named
  constant (mirroring R-0015's crystallize threshold).

- **AC2 — Derived from the event corpus, distinct wizards.** The count comes from
  the **verified** mastery events the client has (own log + discovered peers,
  R-0010) — never the CRDT. A wizard mastering a topic **twice counts once**
  (distinct pubkeys); unsigned/invalid events never count.

- **AC3 — Bedrock render.** An approved topic is shown as **canonical/bedrock**
  (the crystallized visual language of R-0015) on its map disc and in the read
  view, distinct from a topic only *you* have mastered (your ✓, R-0030) and from
  an ordinary topic. The disc hit radius is unchanged (R-0024).

- **AC4 — Pure + tested.** The aggregation is a **pure** function —
  `communityApproved(events, threshold) → Set<plateauId>` (and/or a
  `masteryCounts(events) → Map<plateauId, count-of-distinct-pubkeys>`) —
  **unit-tested**: distinct-pubkey counting, threshold boundary (N−1 not approved,
  N approved), ignores non-mastery kinds + invalid events, deterministic.

- **AC5 — Additive + safe.** No CRDT-shape change, no reputation-math change
  (this reads mastery events, which already don't feed the multivector, R-0030
  AC4); reuses the R-0010 corpus + the R-0015 crystallization language. No
  injection (canvas/`textContent`). Existing suites stay green.

- **AC6 — Green + browser-verified.** All suites green; in the browser, a topic
  with mastery events from ≥ N distinct wizards renders as community-approved
  (bedrock) while a topic only the local wizard mastered shows just the personal
  ✓ — no uncaught console errors.

## 4. Constraints & non-goals

- **Reuse, don't reinvent.** Mirror R-0015 crystallization (threshold → bedrock)
  and the R-0010 corpus/discovery; add only a pure count + a render state.
- **Off the CRDT.** Community approval is a reputation-class fact derived from
  signed events, never a synced CRDT field (CLAUDE.md §6/§7).
- **Honest about discovery.** Approval reflects the mastery events **this client
  has seen** (own + discovered); with no peers discovered, only the local
  wizard's masteries count. (No global authority — same trust model as
  reputation.)
- **Non-goals:** de-crystallizing/decay; weighting mastery by the master's own
  reputation (a future "trusted-master" refinement); approving a *person's*
  mastery via peer vouches (that was the alternative fork, not chosen); cross-topic
  "curriculum approved" rollups.

## 5. Open questions

- **Threshold N.** A small constant (e.g. 3 distinct wizards) for the POC, like
  R-0015's. Spec fixes it; trivially tunable.
- **Local wizard counts toward N?** Lean: yes — your own mastery is a valid
  signed event; with N=3 you still need 2 others. Spec confirms.
- **Render distinction.** Personal ✓ vs. community bedrock vs. both (you mastered
  an already-approved topic). Spec fixes the three visual states.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Topic crystallizes from **distinct-wizard mastery count** over the signed corpus | Mirrors R-0015 (votes→bedrock) but for topics; reuses the R-0010 corpus; stays off the CRDT |
| 2026-06-15 | Approval reflects **events this client has seen** (own + discovered) | Same no-global-authority trust model as reputation; honest about a decentralized world |
| 2026-06-15 | Distinct pubkeys, grow-only, no decay this phase | Simplest honest count; matches the grow-only stone/traversal model |

## Changelog

- 2026-06-15 created (Accepted) — community approval as topic crystallization from
  crowd mastery (counts R-0030's events). Pending R-0030 landing + SPEC-0031 +
  architect review.
