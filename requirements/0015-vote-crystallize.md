# R-0015 — Vote → Crystallize: community votes solidify a marker into terrain

- **Status:** Met
- **Milestone:** POC — Draft DB (curation)
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** R-0014 (trail markers / resources), R-0010 (wizard identity), R-0012 (durability), R-0005 (sync)
- **Realized by:** SPEC-0015 (pending)
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

A wizard can drop a marker (R-0014), but it starts as **Floating** debris and
nothing yet promotes it. This requirement adds the **spatial voting mechanic**:
a wizard **places a stone** on a marker (casts a weight), and when a marker's
**weighted vote sum crosses `CRYSTALLIZE_THRESHOLD`**, it **crystallizes** —
its state flips Floating → Crystallized and it renders as solid terrain instead
of faint debris.

Crucially, the crystallized state is **computed from the votes, never set by the
client** (DECENTRALIZATION.md: "ResourceState — computed from votes"; CLAUDE.md
§6: no authoritative state that isn't derivable from the graph). This is the
resource analogue of reputation-from-events: votes are the authoritative input,
state is a deterministic projection. Votes live in the existing `votes` CRDT
map, so they sync (R-0005) and persist (R-0012) like any graph state.

## 2. Rationale

This closes the contribute → curate loop and is the VISION's signature
mechanic: "You do not click a thumbs-up. You place a glowing stone … enough
stones → the resource crystallizes into the plateau's bedrock." It makes the
social process legible as geography. It is also a thin increment: the `votes`
map, `vote`/`resource_vote`, grow-only `cast`, `weighted_sum`, and
`CRYSTALLIZE_THRESHOLD = 50` all already exist, and `to_graph` already
recomputes each resource's `vote_count` from the tally. What is missing is (a) a
UI to cast a vote and (b) deriving `state` from that recomputed `vote_count`.

## 3. Acceptance criteria

- **AC1 — Place-a-stone form.** A **"Place a stone" form** offers: a **marker**
  select (every resource, by title, rebuilt from the current graph on open), a
  **weight** control (a slider — the wizard's conviction), and a submit button.

- **AC2 — Voting accrues, same-frame.** On submit, the wizard's weight is cast on
  the marker via the existing `votes` CRDT path, and the marker's displayed vote
  total updates in the same frame. A wizard's repeated votes are **monotonic**
  (grow-only per wizard — casting again sets the max, never stacks), so the total
  reflects distinct wizards' weights, not click-count.

- **AC3 — Crystallization is computed, not client-set.** When a marker's
  weighted vote sum reaches `CRYSTALLIZE_THRESHOLD`, its projected state is
  **Crystallized**; below it, **Floating**. This is derived in the Rust
  projection (`to_graph`) from the authoritative vote tally on **every** read —
  the web app never sends or chooses a state. A crystallized marker renders as
  solid terrain (vs. the faint Floating glyph, R-0014); the flip is visible the
  frame the threshold is crossed.

- **AC4 — Votes sync, persist, and re-derive identically.** Votes propagate to
  other open tabs (R-0005) and are in the IndexedDB snapshot (R-0012). Because
  state is a deterministic function of the tally, every peer and every reload
  computes the **same** crystallization independently — no state is transmitted,
  only votes. Convergent (R-0004).

- **AC5 — Sybil-resistant by construction.** A single wizard cannot crystallize a
  marker by spamming votes: `cast` is monotonic per wizard, so one identity
  contributes at most its single (grow-only) weight to the sum. The threshold is
  crossed by the **weighted sum across distinct wizards** (or one wizard's
  genuine high-conviction weight) — count alone does nothing. This mirrors the GA
  Sybil resistance: collusion of low-weight duplicates cannot manufacture
  crystallization.

- **AC6 — Voter identity derives from the wizard key.** The voter id is derived
  **deterministically from the wizard's Nostr pubkey** (R-0010) by a pure, tested
  helper, so a wizard's votes are stably attributed to their real identity across
  sessions without inventing a parallel id. (The `WizardId`/pubkey reconciliation
  remains the deferred attribution work; this is a deterministic bridge, not a
  new identity.)

- **AC7 — Additive change; the four root keys are unchanged.** The only core
  change is deriving `state` from the already-recomputed `vote_count` against
  `CRYSTALLIZE_THRESHOLD` in `to_graph` (plus exposing the threshold to the UI).
  `votes` was always a root key; the synced doc's root keys stay
  `{bridges, plateaus, resources, votes}`; no reputation enters the CRDT
  (CLAUDE.md §7).

- **AC8 — Green across all suites.** `cargo test --workspace`, `wasm-pack test
  --node`, `node --test apps/web/src/*.test.mjs`, clippy `-D warnings` (host +
  `wasm32`), and `cargo fmt --all --check` all green; the page votes a marker to
  crystallization, reloads, and shows it still crystallized, with no uncaught
  console errors.

## 4. Constraints & non-goals

- **State is derived, never stored authoritatively.** `to_graph` recomputes both
  `vote_count` and `state` from the `votes` tally on every projection; the stored
  `Resource.state` is only an initial placeholder. No client path sets state.
- **Reuse the existing vote core.** `vote`/`resource_vote`/`cast`/`weighted_sum`/
  `CRYSTALLIZE_THRESHOLD` are unchanged; voting writes to the existing `votes`
  map. No new CRDT field, no GA in JS.
- **Votes are CRDT state**, like markers/bridges — not (yet) signed
  `ResourceVote` events (DECENTRALIZATION.md Kind 30001). Signed, attributable
  votes converge on the event-sourced model later (the same seam noted for
  bridges/markers).
- **Non-goals:** the intermediate `Crystallizing` band and `Dissolving`/decay of
  under-voted resources (future tuning); un-voting / negative votes (`cast` is
  grow-only by design); terrain mesh / 3-D bedrock (Phase 6); signed vote events
  & full `WizardId`↔pubkey reconciliation (future); per-domain or
  reputation-weighted vote power (future — votes are flat-weighted this phase).

## 5. Open questions

- **Weight control range/default.** A slider 1–100 (default ~10) lets one
  high-conviction wizard cross 50 alone (demoable single-origin) while keeping
  the typical stone modest; capping weight below the threshold to *force*
  multi-wizard crystallization is a tuning knob. Spec decides the range.
- **Vote feedback in the render.** Show the running total (e.g. `title · 30`),
  a progress ring toward the threshold, or just the Floating→solid flip. Spec
  decides; cosmetic.
- **Crystallizing mid-state.** Whether to surface `Crystallizing` as a near-
  threshold band (e.g. ≥ 50% of threshold) or keep a binary Floating/Crystallized
  this phase. Leans binary.

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Crystallized state is computed in `to_graph` from the votes tally, never client-set | DECENTRALIZATION.md / CLAUDE.md §6 — derived state; mirrors reputation-from-events; convergent across peers with no state on the wire |
| 2026-06-04 | Reuse grow-only `cast` + `CRYSTALLIZE_THRESHOLD` unchanged | Sybil resistance is the monotonic-per-wizard cast; the machinery already exists |
| 2026-06-04 | Voter id derived deterministically from the wizard pubkey | Ties votes to the real identity without a parallel id; full reconciliation deferred |

## Changelog

- 2026-06-04 created (Draft) — pending SPEC-0015 + architect design review, then acceptance.
- 2026-06-04 SPEC-0015 drafted + architect-reviewed (REQUEST CHANGES → resolved:
  voter id now uses the canonical `wizard_id_of`, not a parallel JS mapping; +
  to_graph doc/test, palette nit). **Status → Accepted.**
- 2026-06-04 implemented (commit 5ea2b28) and **QA sign-off → PASS** (all AC1–AC8
  met; every gate green; browser-verified vote→crystallize→reload). **Status → Met.**
