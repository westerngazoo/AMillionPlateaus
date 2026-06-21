# R-0036 — Persist & share a proof / solution (keep it locally, publish it deliberately)

- **Status:** Met
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-21
- **Depends on:** R-0032 (the "Prove it" proof, ephemeral until now), R-0034 (the "Solve it" answer, ephemeral until now), R-0030 (the mastery sign these accompany), R-0010 (Nostr-signed events + the verified log that carries a published proof), R-0012 (browser-durable local persistence)
- **Realized by:** SPEC-0036
- **QA:** `qa` agent — PASS on AC1–AC7 (2026-06-21)

## 1. Statement

R-0032 (a written **proof**) and R-0034 (a CAS-checked **solution**) both graded the
learner's work and then **threw it away** — each requirement explicitly deferred
persisting it as "a later, privacy-considered step." This requirement is that step,
in two layers the owner chose:

1. **Keep it locally (private, durable).** When a proof/solution earns a mastery, it
   is **saved on this device** (browser-durable, R-0012-style) keyed to the topic, so
   it survives a reload and the learner can revisit it. It is **private** — never on
   the signed log, never synced — until the learner chooses otherwise.
2. **Publish it deliberately (opt-in, verifiable).** An explicit **"Publish"** action
   signs a **new signed event** that embeds the proof/solution, so it rides the
   **verified, peer-synced log** (R-0010) with **cryptographic provenance** — anyone
   who has the wizard's events can read and attribute it. Publishing is a conscious act,
   not a default.

The new event is a **completion artifact, not reputation**: `recompute` **ignores** it
exactly as it ignores `KIND_MASTERY` (R-0030), so a published proof **never** changes
reach/rank. Reputation stays a `Multivector` from traversals/vouches only, never a
scalar, never in the CRDT.

## 2. Rationale

A proof or a verified solution is the most valuable thing a learner produces here, and
discarding it (R-0032/R-0034) was a deliberate privacy default, not a desire. The owner
wants it **kept** and, when they choose, **shared** — and in a decentralized,
server-less world "shared" means **on the signed log**, the only thing that propagates
to peers and carries provenance. Splitting it into *local-by-default* + *opt-in publish*
honors the privacy concern (nothing leaves the device implicitly) while making sharing
real (verifiable, attributable, peer-synced). It composes the existing pieces — the
R-0012 durable store, the R-0010 signed-event log, the R-0032/R-0034 grading paths — and
keeps the reputation core untouched by ignoring the new kind in `recompute`.

## 3. Acceptance criteria

- **AC1 — Local keep (private, durable).** When a proof (R-0032 PASS) or a solution
  (R-0034 correct) earns a mastery, the learner's **text is saved locally**, keyed to
  the topic, and **survives a reload**. It is shown back to the learner on that topic
  ("your saved proof/solution"). It is **never** written to the signed log or synced by
  saving alone.

- **AC2 — Opt-in publish (signed, verifiable).** A **"Publish"** control signs a **new
  signed event** (a proof/solution kind, BIP340-signed like every event, R-0010)
  embedding the topic id + the artifact + its kind (proof|solution). Publishing is
  explicit; nothing is published without the learner invoking it.

- **AC3 — Published proofs are visible + attributed.** A published proof rides the
  **verified log** (own + discovered, R-0010) and is shown on its topic, **attributed**
  to its signer (you / a short pubkey). A peer who has the event can read it; an
  unverified/forged event never appears (the existing `verify_event` gate, R-0010).

- **AC4 — Reputation untouched (the invariant).** `recompute` **ignores** the new kind —
  reputation/reach is **byte-identical** with and without any number of published-proof
  events (a host test asserts this, mirroring R-0030). **No** reputation scalar, **no**
  CRDT field; the new event is a completion artifact only.

- **AC5 — Pure parse + tested.** Reading published proofs for a topic from the event
  corpus is a **pure** function — `publishedProofs(events, plateauId) → [{pubkey, kind,
  body}]` — **unit-tested**: only the proof kind, content parsed, attributed to the
  signer, malformed skipped, deterministic. The new event kind has a Rust ↔ JS **pin**
  (like `MASTERY_KIND`).

- **AC6 — Additive, core-safe.** Reuses the R-0012 durable store, the R-0010 sign/verify
  path, the R-0030 mastery (the artifact accompanies a mastery; it does not replace it).
  The only Rust change is the **new event kind + its sign binding** (+ the `recompute`
  ignore + its test); **no CRDT field**, no change to existing event shapes
  (`KIND_TRAVERSAL`/`KIND_VOUCH`/`KIND_MASTERY` unchanged). The artifact text renders via
  the existing **safe** path (R-0020 — no innerHTML injection of proof/peer text).

- **AC7 — Green + browser-verified.** All suites green (incl. the Rust `recompute`-ignore
  test); in the browser: earn a mastery by proof/solution → it's **saved** and shown →
  reload → still there (durable) → **Publish** → it appears as a **published, attributed**
  proof on the topic and persists across reload via the log; no uncaught console errors.

## 4. Constraints & non-goals

- **Local-first, publish-explicit.** Saving never publishes; publishing is a distinct,
  deliberate action. Nothing leaves the device implicitly.
- **Artifact, not reputation.** The new event must be ignored by `recompute` (asserted).
  No reputation/CRDT change.
- **Non-goals:** editing/versioning a published proof, **unpublish/redaction** (a signed
  event, once gossiped, cannot be recalled — note this honestly in the UI; deletion is a
  separate concern); moderation/voting on proofs; rich attachments (text only this
  phase); encrypting a published proof (publishing is public-to-peers by design — the
  privacy control is the *choice* to publish, not encryption); changing R-0032/R-0034
  grading or the R-0030 gate.

## 5. Open questions

- **Event shape.** A **new kind** (e.g. `KIND_PROOF`) carrying `{ plateau, kind:
  proof|solution, body }` vs. extending `KIND_MASTERY` content. Lean: a **new kind** —
  keeps masteries small, lets `recompute` ignore one more kind trivially, and not every
  mastery has a shareable artifact. Spec fixes the kind number + content.
- **Local store shape.** A dedicated durable key (proof per topic, latest-wins) vs.
  folding into the existing snapshot. Lean: a small dedicated store keyed by topic; spec
  fixes it.
- **One artifact per topic or many.** Lean: latest-wins locally (one draft per topic);
  the log naturally keeps every *published* event (history). Spec fixes display (e.g.
  latest per signer).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-21 | **Local-keep by default + opt-in publish** (vs. always-publish, vs. local-only) | Owner choice — honors the deferred privacy concern (nothing implicit on the log) while making sharing real (signed, verifiable, peer-synced) in a server-less world |
| 2026-06-21 | Publishing signs a **new event kind**; `recompute` ignores it | A proof is a completion artifact, not reach; mirrors R-0030's mastery-is-not-reputation invariant — keeps the GA core clean |
| 2026-06-21 | Text only; no unpublish/encryption this phase | A gossiped signed event can't be recalled (stated honestly in the UI); encryption/redaction is a separate, larger concern |

## Changelog

- 2026-06-21 created (Accepted) — persist a proof/solution locally (durable, private) and
  let the learner **publish** it as a new signed, verifiable event on the log; `recompute`
  ignores the kind so reputation is untouched. Pending SPEC-0036 + architect review.
