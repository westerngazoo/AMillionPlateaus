# SPEC-0036 — Persist & share a proof/solution (durable local store + opt-in `KIND_PROOF` publish)

- **Status:** Implemented
- **Realizes:** R-0036
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-21
- **Depends on:** SPEC-0032 (the proof box — where a PASS now also saves), SPEC-0034 (the solve box — where a correct answer now also saves), SPEC-0030 (`signMastery`/the mastery the artifact accompanies), SPEC-0010 (`sign`/`verify_event`/the log + `ingest`), SPEC-0020 (safe `renderMarkdown`/`typesetMath` for rendering the artifact)
- **Module(s):** `crates/mp-identity` (new `KIND_PROOF` + `Proof` payload), `crates/mp-wasm` (`sign_proof`/`proof_kind` + a recompute-ignore host test, **wasm rebuild**), `apps/web/src/proofs.js` (NEW, + `proofs.test.mjs`, pure `publishedProofs`), `apps/web/src/main.js` (local store + save-on-earn + publish + the proofs view), `apps/web/index.html` (`#detail-proofs` section + CSS). **No CRDT field; `recompute` unchanged (it already sums only traversal/vouch, so the new kind is ignored by construction).**

## 1. Motivation

R-0036: keep a proof/solution locally (private, durable) and let the learner **publish**
it as a signed, verifiable event. The grading paths already produce the text (R-0032
proof, R-0034 solution); this saves it on a PASS/correct, and adds an opt-in publish that
rides the R-0010 log. A published proof is a **completion artifact, not reputation** —
`recompute` ignores its kind (it filters *in* only `KIND_TRAVERSAL`/`KIND_VOUCH`), so reach
is untouched (AC4).

## 2. Design

### 2.1 `mp-identity` — the `KIND_PROOF` event (mirrors `KIND_MASTERY`)

```rust
// event.rs
/// Proof/solution artifact kind (R-0036): a shareable completion artifact, NOT
/// reputation — `recompute` ignores it (it sums only traversal/vouch), so a
/// published proof never changes reach.
pub const KIND_PROOF: u32 = 30081;

/// Proof content payload (R-0036) — the topic, the artifact kind, and the text.
/// Self-contained; NOT read by `recompute`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    pub plateau: Uuid,
    pub kind: String, // "proof" (R-0032) | "solution" (R-0034)
    pub body: String,
}
```

**`recompute.rs` is unchanged** — it already iterates `filter(|e| e.kind == KIND_TRAVERSAL)`
and `filter(|e| e.kind == KIND_VOUCH)`; `KIND_PROOF` is ignored by construction (AC4). No
new branch, no risk to the GA core.

### 2.2 `mp-wasm` — sign binding + accessor + the invariance test (rebuild)

```rust
// convert.rs — mirrors sign_mastery_json
pub fn sign_proof_json(kp: &Keypair, plateau: &str, kind: &str, body: &str, created_at: u64)
  -> Result<String, JsError> {
    let plateau = Uuid::parse_str(plateau)?;
    let content = serde_json::to_string(&Proof { plateau, kind: kind.into(), body: body.into() })?;
    let event = mp_identity::sign(kp, KIND_PROOF, vec![], &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}
// lib.rs
impl WasmIdentity { pub fn sign_proof(&self, plateau_id, kind, body) -> Result<String, JsError> {…} }
#[wasm_bindgen] pub fn proof_kind() -> u32 { mp_identity::KIND_PROOF }
```

`sign_proof_json` **caps `body`** (e.g. ≤ 8 KB, truncate) so a pathological proof can't
bloat the gossiped log (architect note; the body is `<textarea>` text).

Host test `proof_signs_verifies_and_leaves_reputation_untouched` (mirrors the R-0030 test):
the proof event **verifies**, is kind 30081, content `{plateau, kind, body}`, **and**
`recompute_reputation` is **byte-identical (string equality)** with vs. without it **in a
log that contains a traversal AND a vouch** (so the order-sensitive Phase B is exercised,
not a trivial empty log) (AC4). Rebuild the pkg so `proof_kind`/`sign_proof` reach JS:
`wasm-pack build crates/mp-wasm --target web --out-dir ../../apps/web/pkg`. (Correction to
the architect note: `apps/web/pkg/` is **gitignored** (`.gitignore` = `*`, nothing tracked)
— it is a build artifact rebuilt from source by dev/CI, **not** committed. The committed
change is the Rust source; consumers rebuild. Build needs the rustup toolchain's
`wasm32-unknown-unknown` target — run with `~/.cargo/bin` ahead of a Homebrew `rustc` on PATH.)

### 2.3 `proofs.js` — pure read of published proofs

```js
export const PROOF_KIND = 30081; // pinned to proof_kind() by a console.assert in main.js

/** Published proofs for `plateauId` from the verified corpus → [{ pubkey, kind, body }].
 *  Only KIND_PROOF, content parsed, matched to the topic; LATEST per signer (by
 *  created_at) so a re-publish supersedes; malformed skipped; sorted by pubkey
 *  (deterministic). Pure — events are already BIP340-verified by events.js. */
export function publishedProofs(events = [], plateauId) { … }
```

### 2.4 `main.js` — local store + save-on-earn + publish

- **Local store** (`mp.proofs` in localStorage, like the event log): `{ [plateauId]: { kind, body } }`,
  latest-wins. `saveProof(plateauId, kind, body)` writes; `loadProofs()` reads. Private —
  saving NEVER touches the log.
- **Save on earn:** in the R-0032 Check handler, on PASS → `saveProof(p.id, "proof", proofInput.value)`;
  in the R-0034 Check handler, on correct → `saveProof(p.id, "solution", solveInput.value)`
  (both right where `signMastery` is called). The artifact persists; reload keeps it (AC1).
- **Publish:** a `publishProof(plateauId)` signs via `identity.sign_proof(plateauId, kind, body)`
  (from the local store), `ingest`s it (→ rides the log + syncs, R-0010), and refreshes the
  proofs view. Pin: `console.assert(proof_kind() === PROOF_KIND)` at init (like `mastery_kind`).

### 2.5 `index.html` + `main.js` — the proofs view

A `#detail-proofs` block (static sibling in the drawer, after `#detail-solve`; in the
bridge-mode hide-list). `renderProofs(p)` (called from `openPlateau`) fills it:

- **Your saved <kind>** (from `loadProofs()[p.id]`, if any): the body via the **safe**
  `renderMarkdown` + `typesetMath` (R-0020 — inert), a **Publish** button, and an honest
  note: *"Publishing signs this to the shared log — it can't be unpublished."*
- **Published proofs** (from `publishedProofs(log.all(), p.id)`): one row per signer,
  **attributed** ("you" / `shortKey(pubkey)`), body via the safe renderer. Empty ⇒ hidden.

No render-signature change; `renderProofs` reads the log + local store directly (like
`renderMastery`). Bodies are **never** set via innerHTML of raw text — only through the
R-0020 sanitiser.

## 3. Code outline

- `mp-identity/event.rs`: `KIND_PROOF`, `Proof`. (recompute.rs untouched.)
- `mp-wasm/convert.rs`: `sign_proof_json` + the invariance host test; `lib.rs`: `sign_proof`, `proof_kind`. Rebuild pkg.
- `proofs.js`: `PROOF_KIND`, `publishedProofs`. `proofs.test.mjs`: only-KIND_PROOF; topic match; latest-per-signer supersede; malformed/again-kinds skipped; attribution; deterministic.
- `main.js`: `mp.proofs` store (`saveProof`/`loadProofs`), save-on-PASS (R-0032) + save-on-correct (R-0034), `publishProof`, `renderProofs`, the `proof_kind` pin, `renderProofs(p)` in `openPlateau`.
- `index.html`: `#detail-proofs` markup + CSS + bridge-mode hide line.

## 4. Non-goals

Per R-0036 §4: no edit/version/unpublish/redaction (a gossiped signed event can't be
recalled — the UI says so); no moderation/voting; text only; no encryption (publishing is
public-to-peers by design); no change to R-0032/R-0034 grading, the R-0030 gate, or
`recompute`. **Log-level abuse mitigation** (spam/flooding the shared log with proof
events) is a separate future concern, distinct from redaction — out of scope here beyond
the per-body size cap.

## 5. Open questions (resolved here)

- **New kind** `KIND_PROOF = 30081` (not extending `KIND_MASTERY`) — keeps masteries small,
  ignored-by-construction, and not every mastery has an artifact. §2.1.
- **Local store** = dedicated `mp.proofs`, latest-wins per topic. §2.4.
- **Display** = local draft (one, private) + published (latest per signer, attributed). §2.5.

## 6. Acceptance criteria

Maps to R-0036 AC:

- [x] AC1 — earn by proof/solution → saved locally, shown back, survives reload; never on the log by saving. *(browser + store)*
- [x] AC2 — "Publish" signs a `KIND_PROOF` event (BIP340) with `{plateau, kind, body}`; explicit only. *(host test + browser)*
- [x] AC3 — published proof rides the verified log, shown attributed to its signer; unverified never shown. *(publishedProofs tests + browser)*
- [x] AC4 — `recompute` ignores `KIND_PROOF`: reputation byte-identical with/without it. *(Rust host test)*
- [x] AC5 — `publishedProofs` pure + unit-tested; `PROOF_KIND` pinned to `proof_kind()`. *(node --test + init assert)*
- [x] AC6 — additive; only-Rust change is the new kind + sign binding (recompute untouched); no CRDT field; existing event shapes unchanged; safe render. *(diff + suites)*
- [x] AC7 — green (incl. Rust invariance test); browser: earn → saved → reload persists → Publish → appears attributed + persists via the log; console clean. *(suites + browser)*

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-21 | New `KIND_PROOF` event; `recompute` ignores it (by construction) | A proof is a completion artifact, not reach — mirrors R-0030; the GA core needs no change |
| 2026-06-21 | Local `mp.proofs` store, save-on-earn; publish is a separate signed step | Honors R-0036's local-first/opt-in-publish; saving is private, publishing is deliberate |
| 2026-06-21 | Body rendered only via the R-0020 safe sanitiser | Proof/peer text is untrusted — same inert path as a plateau body |

## Changelog

- 2026-06-21 implemented + QA **PASS** (AC1–AC7). Rust: `KIND_PROOF=30081` + `Proof`
  payload (event.rs, re-exported), `sign_proof_json` (8 KB body cap) + `sign_proof`/`proof_kind`
  (mp-wasm), the `proof_signs_verifies_and_leaves_reputation_untouched` invariance test (over a
  traversal+vouch log) + `proof_body_is_capped`; `recompute.rs` untouched. wasm pkg rebuilt (via
  the rustup toolchain's wasm32 target). JS: pure `proofs.js` `publishedProofs` + 5 tests; `main.js`
  `mp.proofs` store (save-on-PASS/correct, private), `publishProof` (sign→ingest), `renderProofs`
  (safe-rendered body, textContent attribution), the `proof_kind` pin; `index.html` `#detail-proofs`
  + CSS + bridge hide. Suites: cargo workspace green (mp-wasm 21), clippy/fmt clean, node 255.
  Browser-verified offline: earn → saved private (0 proof events) → reload persists → Publish → 1
  signed `KIND_PROOF`, attributed "you · solution" → reload persists via the log; console clean.
  **Status → Implemented.**
- 2026-06-21 architect design review: **APPROVE** (two non-blocking conditions folded in).
  Confirmed `recompute` ignores `KIND_PROOF` **by construction** (it sums only the kinds it
  filters in — traversal/vouch — so no recompute change and reputation is provably
  untouched, AC4); the local `mp.proofs` store has no leak-to-log path (save and publish are
  distinct call sites); publish rides the verify-gated log (AC3); the safe-render path is the
  only acceptable route for untrusted bodies. Folded in: a **body size cap** in
  `sign_proof_json`; the invariance host test must run **over a log with a traversal + vouch**
  and assert **string-equal** recompute; the rebuilt **pkg artifacts must be committed**; and
  attribution/`kind` (peer-derived) must render via `textContent`, body via `renderMarkdown`
  only. **Status → Accepted.**
- 2026-06-21 created (Draft) — durable local proof/solution store + opt-in `KIND_PROOF`
  publish to the verified log; `recompute` ignores the kind (reputation untouched). Pending
  architect review, then `Accepted`.
