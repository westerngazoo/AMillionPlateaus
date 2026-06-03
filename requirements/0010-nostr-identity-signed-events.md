# R-0010 — Wizard identity: Nostr-signed events and verifiable, recomputed rank

- **Status:** Accepted
- **Milestone:** Phase 8 — Nostr Identity
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-02
- **Depends on:** R-0002 (GA reputation, Sybil resistance, fog reachability), R-0004 (CRDT sync), R-0005 (web fog-world POC), R-0006 (persona seed this rank earns past)
- **Realized by:** SPEC-0010
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Give a visitor a **cryptographic wizard identity** and make their rank
**earned and verifiable** rather than seeded. A visitor holds a local Nostr
keypair; the world-actions that already move reputation — **traversing** a
plateau and **voting** — are emitted as **Nostr-signed events**. Any peer can
**verify** those signatures and **recompute the same reputation multivector**
from the verified event log, driving it through the **already-audited GA
reputation engine** (R-0002). This earned reputation **replaces** the synthetic
persona seed (R-0006): the persona still chooses *which way the lens faces*, but
*how far it reaches* now comes from signed, verifiable history.

Identities and their events are **discoverable**: a client connects to a **Nostr
relay**, publishes its own signed events, subscribes to others', and can run a
**wizard-discovery** query — for a given domain, the wizards whose verified
traversal history earns the most reach — all of which must degrade gracefully
when no relay is reachable (the world stays fully playable offline).

Two invariants from the core carry through unchanged: **reputation is never in
the CRDT** (CLAUDE.md §7) — events may travel, the *computed* reputation never
does — and **rank is geometry, not a dialed-in number** (CLAUDE.md §4) — a
**Sybil** cluster of colluding fake keys, vouching only for each other, cannot
lift its reputation above **grade 0**.

## 2. Rationale

Through R-0009 a visitor's reach is **seeded**: pick or author a persona and the
world lights from a fixed `SEED` magnitude. That proved "who you are changes what
you can see," but the magnitude is a gift, not an achievement. The project's
thesis is that **wizard rank is earned geometry** — a multivector that grows from
real traversal and is **verifiable by anyone**, not asserted by a server or a
client. Phase 8 makes the leap from *lens* to *identity*: the visitor signs what
they actually do, and any peer can independently confirm the resulting rank by
re-running the audited GA math over the signed log. Nostr gives us
keypair identity, signed events, and relay-based discovery without a custodial
server, matching "the graph is the platform" (§6) and the decentralised vision.
This is the natural successor to R-0002 (whose non-goals already named
"Nostr-signed event sourcing of reputation (Phase 8)") and the precursor to
multiplayer presence.

## 3. Acceptance criteria

- **AC1 — Local wizard keypair.** A visitor has a **Nostr-compatible keypair**
  (secp256k1 / Schnorr, the standard Nostr event-signing scheme). The keypair is
  generated/held **locally** (per browser, like the model config) and the
  **secret key is never synced, never enters the CRDT, and is never logged**.
  The public key is the wizard's stable identifier.
- **AC2 — Signed world-events.** The reputation-bearing actions — **traversing**
  a plateau and **voting** — are emitted as **Nostr events signed by the
  visitor's key**, in a well-formed, verifiable shape (valid id + signature over
  the canonical serialization). A consumer **verifies the signature and the
  event's self-consistency before the event is allowed to affect anything**; an
  event with a bad or missing signature is **rejected** and contributes nothing.
- **AC3 — Rank recomputed from the verified log (replaces the seed).**
  Reputation is **recomputed deterministically from the verified event log**
  through the **unchanged, audited GA engine** (R-0002): the same set of verified
  events always yields the **same reputation multivector**, and this earned
  reputation **replaces the synthetic persona seed** as the source of the
  visitor's reach. With **no events**, a wizard reaches nothing (no free seed).
  The persona still sets **orientation**; the event log sets **magnitude/reach**.
- **AC4 — Cross-peer convergence.** Given the **same verified event log**, two
  independent clients **compute the identical reputation multivector** for a
  wizard (component-wise within EPSILON). Reputation is a *function of the signed
  events*, not of who computed it or in what order they arrived.
- **AC5 — Sybil resistance survives real keys (CLAUDE.md §4).** A cluster of **N
  colluding fake keys** that sign events only vouching for one another **cannot
  raise its reputation above grade 0** — the grade-collapse property of R-0002
  holds when the actors are real signed identities, not just synthetic test
  fixtures. Forging another wizard's history is infeasible without their secret
  key (signatures gate authorship).
- **AC6 — Reputation still never in the CRDT (CLAUDE.md §7).** Signed **events**
  may be synced/relayed, but the **computed reputation never enters the synced
  document**: the CRDT root keys stay exactly `{bridges, plateaus, resources,
  votes}`, and **no reputation, key, signature, or rank field** is added to
  `CrdtDoc`. The secret key appears in **no** synced or persisted-shared state.
- **AC7 — Relay connectivity & discovery, offline-safe.** A client can **connect
  to a Nostr relay** (relay URL **configurable and local-only**, like the model
  config), **publish** its signed events, and **subscribe** to others'. It
  supports **wizard discovery**: for a given **domain**, query the relay and rank
  wizards by the reach their **verified** traversal history earns (top traversers
  per domain). When **no relay is reachable**, the client **degrades gracefully**
  — it keeps signing and recomputing from the local log, surfaces the offline
  state without crashing, and the single-client world stays fully playable.
- **AC8 — Pure core, tested, lint-clean.** The **event-log → reputation**
  mapping is **pure and unit-tested** at the core (host/node, no relay, no
  network): deterministic output, empty log reaches nothing, Sybil cluster stays
  grade 0, and a tampered/badly-signed event is rejected. Signature
  **verification** is unit-tested (valid accepted, forged/mutated rejected).
  `cargo test --workspace`, `wasm-pack test --node`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt` stay green; the page loads, mints a key, signs a
  traversal, and recomputes rank with **no uncaught console errors**.

## 4. Constraints & non-goals

- **Reuse the audited GA engine; no new reputation math.** Recomputation drives
  the existing `mp-reputation` engine (`record_traversal` / `propagate` /
  `recompute_synthesis`). No new GA logic in JavaScript and **no math outside
  garust** (CLAUDE.md §1). Event marshalling and signature verification are the
  only new surfaces; reputation stays a `Multivector` scoped by `DomainId`
  (§4), never a scalar.
- **Secret key hygiene.** The secret key is **never** synced, relayed, persisted
  to shared state, placed in a URL/query string, or logged. (Local-only storage
  for the visitor's own convenience is a spec decision; if stored, it stays on
  that one client.)
- **`mp-crdt` stays reputation-free (CLAUDE.md §7).** Nothing about computed
  reputation, keys, signatures, or rank may enter the synced document. Whether
  signed events ride the existing CRDT/`BroadcastChannel` transport or a separate
  relay channel is a spec decision, but the **computed reputation** never does.
- **Verify before trust.** No event affects reputation, lighting, or discovery
  until its signature and self-consistency are verified. Unverified or malformed
  events are inert.
- **Non-goals:**
  - *Account recovery, key rotation, multi-device key sync, custody/backup UX.*
    A later identity-hardening task; this phase a key is a local artifact.
  - *Full NIP coverage / relay-protocol completeness / paid or authed relays.*
    We use the minimum to publish, subscribe, and discover; exhaustive NIP
    conformance is out of scope.
  - *Running our own relay, relay federation, spam/rate-limit policy.* Use an
    existing relay endpoint; operating relay infrastructure is out of scope.
  - *On-chain anything, tokens, or payments.* Out of scope, permanently for this
    milestone.
  - *Social graph / profiles / DMs / messaging.* Only the reputation-bearing
    traversal and vote events plus discovery; general Nostr social features are
    out of scope.
  - *Migrating historical synthetic-seed sessions into signed history.* Earned
    rank starts from the signed log; we do not back-date the old seed.

## 5. Open questions (to settle in SPEC-0010 / architect review)

- **Event schema & kinds.** Exact Nostr event shape for a traversal and a vote
  (kind numbers, tags, content payload — plateau id, domain, depth/position)
  such that the verified content is sufficient to drive `record_traversal` and
  the vote path deterministically.
- **Where verification + recomputation live.** In Rust via `mp-wasm` (preferred,
  keeps math/verification in the audited core) vs. a thin JS layer using
  `nostr-tools` for signing/transport with Rust doing verification+reputation.
  Which crate owns secp256k1/Schnorr verification.
- **Seed → earned transition.** Whether the persona seed is fully removed once a
  wizard has any signed events, or the orientation persists as a zero-magnitude
  lens with all magnitude earned. How an event-less but persona'd visitor sees
  the world (likely: oriented but reaching nothing until they traverse).
- **Transport for events.** Reuse the existing CRDT `BroadcastChannel`/Automerge
  transport for events vs. a dedicated relay subscription; how local recompute
  and relayed events reconcile (both must converge, AC4).
- **Discovery ranking & query.** Exact relay query (filters) for "top traversers
  per domain" and how ranking is computed client-side from verified events
  without trusting any relay-supplied ordering.
- **Relay config & default.** Default relay URL (if any) vs. visitor-supplied;
  where stored (local-only); offline/empty-relay UX.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | Phase 8 next: give wizards a Nostr keypair identity and make rank **earned + verifiable** from signed traversal/vote events, recomputed through the unchanged GA engine | Realizes the core thesis (rank is earned geometry, verifiable by anyone) and the R-0002 non-goal explicitly deferred to Phase 8; thin additive layer over audited core |
| 2026-06-02 | Transport scope = **full Nostr relay + discovery** (connect, publish/subscribe, top-traverser-per-domain discovery), **offline-safe** | Owner chose the relay-inclusive scope; decentralised discovery is the point of using Nostr, but the world must stay playable with no relay |
| 2026-06-02 | Earned reputation **replaces** the synthetic persona seed; persona keeps orientation, the signed log sets magnitude | Rank must be earned, not gifted (§4); persona stays a lens, not a stat sheet |
| 2026-06-02 | Secret key **never** synced/relayed/logged; computed reputation **never** in the CRDT (root keys stay `{bridges, plateaus, resources, votes}`) | CLAUDE.md §7 + key hygiene; events may travel, secrets and computed rank do not |

## Changelog

- 2026-06-02 created (Draft) — pending SPEC-0010 + architect design review, then acceptance.
- 2026-06-02 SPEC-0010 drafted and architect-reviewed (APPROVE-WITH-NITS; findings folded in:
  fixed two-phase recompute order for AC4 determinism, AC5 re-scoped to mutual-vouch grade-0
  with single-actor grade-3 fabrication named as an accepted POC risk, orientation-only
  persona encoding, crate-graph hygiene). **Status → Accepted**; ready for implementation.
