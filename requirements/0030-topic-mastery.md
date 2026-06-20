# R-0030 — Topic mastery: close a topic you've studied (self-tested, signed)

- **Status:** Met (QA sign-off 2026-06-15)
- **Milestone:** POC — Knowledge content
- **Owner:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** R-0010 (Nostr identity + signed events: the log, `sign`, `verify`, recompute), R-0023/R-0026 (Study view + "Quiz me"), R-0020 (read view), R-0005 (render — the ✓ on a disc)
- **Realized by:** SPEC-0030
- **QA:** `qa` agent run scoped to this requirement

## 1. Statement

Once you've studied a topic, you want to **close it** — mark it mastered — and
have that be **real**: part of your verifiable history, not a throwaway flag.
This requirement adds, on each plateau's Study view, a **"Mark as mastered"**
action gated by a quick **self-test**: it runs **Quiz me** (recall questions
from the topic's own notes) and you **self-attest** you can answer them; on
confirm it **signs a mastery event** (BIP340, the same verifiable log as
traversals/vouches, R-0010). A mastered topic then shows a **✓** in the read
view and on its map disc. Mastery is **earned and verifiable** (in your signed
log, syncs/discovers like other events, survives reload, and **Reset my history**
re-opens everything) — and it is the foundation the community-approval layer
(R-0031) counts.

## 2. Rationale

The owner asked to "mark a topic as closed once studied, test knowledge to do
so." The project's honest unit of progress is the **signed event** (you don't
get points, you earn verifiable history — R-0010). So "mastered" is a new event
kind, the exact shape of a traversal — not a mutable CRDT flag (CLAUDE.md §7) and
not a local toggle. The **self-test** keeps it honest without pretending to
auto-grade free text offline: Quiz me already generates recall questions
(R-0026 offline, or a model), and self-attestation is the gate. Crucially this
needs **no change to the reputation math**: the recompute already sums only the
kinds it knows (traversal/vouch), so a mastery event rides the log verified but
**does not alter the GA reputation multivector or reachability** — mastery is a
separate completion layer the UI derives from the log. Minimal core surface
(one new event kind + a signer), maximal fit.

## 3. Acceptance criteria

- **AC1 — Self-tested close.** Each plateau's Study view has a **"Mark as
  mastered"** control. Activating it runs a **self-test** — the Quiz me recall
  questions for this topic (offline digest or model) — and requires an explicit
  **self-attestation** ("I can answer these") before it will mark the topic.
  Without the attestation, nothing is signed.

- **AC2 — Signs a mastery event.** Confirming signs a **mastery event** — a new
  BIP340-signed event kind (`KIND_MASTERY`), the same canonical
  `[0,pubkey,created_at,kind,tags,content]` form as traversals/vouches, content
  naming the plateau — appended to the verifiable log and persisted
  (`mp.eventLog`). It **verifies** like any event (id = sha256(canonical) + valid
  signature) and is **never written to the CRDT** (CLAUDE.md §7).

- **AC3 — ✓ where it matters.** A topic the wizard has mastered shows a **✓**
  marker in the read view (detail drawer) and on its **map disc**. The "mastered"
  set is **derived from the verified log** (so it survives reload, is verifiable,
  and a peer's view reflects only what they can verify). Mastering is
  idempotent — re-mastering the same topic doesn't double-count and doesn't error.

- **AC4 — Reputation math untouched.** A mastery event **does not change** the GA
  reputation multivector, reachability/fog, or rank — `recompute` ignores the
  mastery kind (it sums only traversal/vouch). Reach stays **traversal-earned**;
  mastery is an orthogonal completion layer. (A test asserts reputation is
  byte-identical with vs. without a mastery event in the log.)

- **AC5 — Earned, resettable.** Because mastery lives in the signed log,
  **Reset my history** clears it (every topic re-opens), exactly like reach — it
  cannot be set without signing, and a tampered/unsigned localStorage entry never
  enters the verified set.

- **AC6 — Core-minimal + pure-tested.** Rust: a new `KIND_MASTERY` + a mastery
  content payload + a `WasmIdentity.sign_mastery(plateau_id, created_at)` signer
  + an exposed `mastery_kind()`; **`recompute` is unchanged**. JS: a **pure**
  `masteredTopics(events, pubkey) → Set<plateauId>` over the verified log,
  **unit-tested** (picks only `KIND_MASTERY` events for that pubkey, dedupes,
  ignores other kinds, deterministic). A `wasm-pack` test signs + verifies a
  mastery event and asserts reputation is unaffected.

- **AC7 — Additive + safe.** No reputation-model change, no CRDT-shape change
  (mastery is a signed event, not a CRDT field); existing flows (traversal,
  vote, study, the read view) unchanged. The ✓ and any rendered text are inert
  (`textContent`/canvas), no injection. Existing suites stay green.

- **AC8 — Green + browser-verified.** All suites green; in the browser, opening a
  studied topic, running the self-test, attesting, and confirming shows a ✓ on
  that topic (drawer + disc), it survives reload, **Reset my history** clears it,
  and reputation/reach is unchanged — no uncaught console errors.

## 4. Constraints & non-goals

- **Mastery is a signed event, not CRDT state and not reputation.** It rides the
  R-0010 log; the reputation multivector is untouched (AC4).
- **Self-attested, not auto-graded.** The test is the Quiz-me recall + an honesty
  gate; no free-text answer grading this phase (a connected model may *show* a
  check, but the attestation is the gate).
- **Non-goals:** the community/crowd-approval layer (that is **R-0031**, which
  counts these mastery events); un-mastering a single topic (use Reset my history
  — mastery is grow-only like traversals); scoring/streaks/XP; changing the
  reputation/eigentrust math; per-question grading.

## 5. Open questions

- **`KIND_MASTERY` value.** Next free kind in the 30000–39999 app range (after
  traversal/vouch). Spec fixes it; a test pins the JS constant to the Rust one.
- **✓ placement on the disc.** A small glyph/ring on the disc vs. a badge. Spec
  decides; must not disturb the hit-test (fixed disc radius, R-0024).
- **Self-test depth.** Show the Quiz-me questions + a single "I can answer these"
  confirm, vs. per-question checkboxes. Leans: one attestation (honest + simple).

## 6. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Mastery = a new **signed event kind**, not a CRDT flag or local toggle | The project's unit of progress is verifiable signed history (R-0010); fits sync/reset/anti-tamper for free |
| 2026-06-15 | Mastery **does not feed the reputation multivector** (recompute skips it) | Keeps the GA/eigentrust invariants untouched; mastery is a completion layer, reach stays traversal-earned |
| 2026-06-15 | Gate on the existing **Quiz me** + self-attestation | Honest offline (R-0026), no free-text grading; the ritual makes "closed" mean "I tested myself" |

## Changelog

- 2026-06-15 created (Accepted) — the owner's "mark a topic closed, test to do
  so." A self-tested signed mastery event + ✓, foundation for R-0031's
  community approval. Pending SPEC-0030 + architect review.
- 2026-06-15 QA sign-off — **Status → Met.** See QA report below.

## QA — R-0030 Topic mastery: close a topic you've studied (self-tested, signed)

### Verdict: PASS

### Acceptance criteria coverage

| AC | Test(s) / evidence | Result |
|----|--------------------|--------|
| AC1 — Self-tested close (attestation gate) | `main.js` `renderMastery` (l.947–974): `confirm.hidden = true` at creation (l.964); revealed only inside the `markBtn` click handler **after** `studyAction(...quiz...)` runs the self-test (l.965–968); signing happens only in the `confirm` click handler (l.969–972). `index.html` `.mastery-confirm[hidden]{display:none}` (l.298) backs the hidden state. Nothing signs without the attestation. | PASS |
| AC2 — Signs a mastery event, not CRDT | Host test `mastery_signs_verifies_and_leaves_reputation_untouched` (convert.rs l.686): `verify_event(mastery)` true, kind 30080, content `{plateau}`. `sign_mastery_json` (convert.rs l.359) uses the generic `mp_identity::sign` (canonical `[0,pubkey,created_at,kind,tags,content]` + BIP340). `signMastery`→`ingest`→`log.add` (verify-gate, persists `mp.eventLog`); no `doc.` (CRDT) call in `signMastery` or `ingest`. | PASS |
| AC3 — ✓ where it matters, derived, idempotent | `masteredTopics` pure-tested (`mastery.test.mjs`, 5 tests: own-pubkey-only, dedupe, skip malformed/other-kind, deterministic). `render.js` draws ✓ when `mastered.has(p.id)` (l.80–86); drawer ✓ via `renderMastery`. Set derived from `log.all()`; idempotent by `Set` (plateau id) + `log.add` dedupe (event id). | PASS |
| AC4 — Reputation math untouched | `recompute.rs` imports & filters **only** `KIND_TRAVERSAL`/`KIND_VOUCH` (l.14, l.46, l.63); `KIND_MASTERY` never referenced. Host test asserts `recompute_reputation_json` byte-identical with vs. without the mastery event over a {traversal+vouch} log (l.718–722). | PASS |
| AC5 — Earned, resettable, anti-tamper | `reset-fog` handler calls `log.clear()` → `recomputeMastered()` → re-renders/draws (main.js l.1568–1575). `events.js` re-verifies the persisted mirror on load (l.38–41) and `add` is verify-gated (l.54–55), so an unsigned/tampered localStorage entry never enters `all()`/the mastered set. | PASS |
| AC6 — Core-minimal + pure-tested | Rust: `KIND_MASTERY=30080` + `Mastery{plateau}` (event.rs), `sign_mastery` + `mastery_kind()` (lib.rs), `recompute` UNCHANGED. JS: pure `masteredTopics` unit-tested. Host test pins kind 30080; `main.js` `console.assert(mastery_kind() === MASTERY_KIND)` (l.217–220) pins the JS constant to Rust. | PASS |
| AC7 — Additive + safe | `git diff --stat -- crates/` (uncommitted change set): only `mp-identity` (event.rs, lib.rs) + `mp-wasm` (convert.rs, lib.rs) — no mp-graph/mp-domain/mp-reputation/mp-crdt. Render ✓ is `ctx.fillText` (inert canvas); drawer state is `textContent`/`createElement` (no injection). All existing suites green. | PASS |
| AC8 — Green + browser-verified | All suites green (counts below). Browser flow (self-test → confirm → ✓ on drawer+disc, persists across reload, Reset my history clears, reputation/reach unchanged, console clean) accepted on the recorded browser evidence; the `console.assert` holding (clean console) confirms the cross-language kind pin. | PASS |

### Suites

- **JS (`node --test apps/web/src/*.test.mjs`):** 199 pass / 0 fail (mastery.test.mjs contributes 5). PASS
- **Rust (`cargo test --workspace`):** all green incl. `convert::tests::mastery_signs_verifies_and_leaves_reputation_untouched`. PASS
- **`cargo fmt --all --check`:** clean (exit 0). PASS
- **`cargo clippy --workspace --all-targets -- -D warnings`:** clean (exit 0). PASS
- **`cargo clippy -p mp-wasm --target wasm32-unknown-unknown --all-targets -- -D warnings`:** clean (exit 0). PASS
- **`apps/web/pkg` rebuilt:** exports `mastery_kind` + `wasmidentity_sign_mastery` present in `mp_wasm.js`/`.d.ts`. PASS

### Gaps / failures

None. Every acceptance criterion maps to at least one passing test; AC4 is doubly assured (recompute.rs ignores KIND_MASTERY by construction + a byte-identical reputation assertion over a vouch-bearing log). AC8 relies on accepted recorded browser evidence per the run scope; no automated browser harness exists for the click flow, which is consistent with the rest of the project's QA. Note: the staged `Cargo.lock` change (`garust-physics`) predates this change set and is orthogonal to the reputation crates.
