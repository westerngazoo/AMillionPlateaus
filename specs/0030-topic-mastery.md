# SPEC-0030 — Topic mastery (a self-tested signed mastery event + ✓)

- **Status:** Implemented
- **Realizes:** R-0030
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-15
- **Depends on:** SPEC-0010 (events: `sign`, `verify`, the `KIND_*` range, `recompute`, the JS `makeLog`), SPEC-0023/0026 (Study view + Quiz me / offline digest), SPEC-0005 (render — the disc)
- **Module(s):** `crates/mp-identity/src/event.rs` (`KIND_MASTERY` + `Mastery` payload), `crates/mp-wasm/src/{convert.rs,lib.rs}` (`sign_mastery` + `mastery_kind()`) + a `wasm-pack` test; NEW `apps/web/src/mastery.js` (+ `mastery.test.mjs`, pure); `apps/web/src/{main.js,render.js,index.html}` (UI + ✓). **`recompute` UNCHANGED; no CRDT/reputation-math change.**

## 1. Motivation

R-0030: close a studied topic as a verifiable, self-tested signed event. The
event model (SPEC-0010) already signs/verifies arbitrary kinds and `recompute`
sums only traversal/vouch — so a new `KIND_MASTERY` rides the log verified yet
leaves reputation untouched. The "mastered" set is a pure derivation over the
verified log.

## 2. Design

### 2.1 `mp-identity` — the mastery event (core-minimal)

```rust
// event.rs — next free app-data kind after traversal (30078) / vouch (30079).
pub const KIND_MASTERY: u32 = 30080;

/// Mastery content payload — names the topic; self-contained. Not read by
/// `recompute` (mastery does not feed reputation, R-0030 AC4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mastery {
    pub plateau: Uuid,
}
```

`recompute` is **unchanged** — it iterates only `KIND_TRAVERSAL`/`KIND_VOUCH`
(recompute.rs:46,63), so a `KIND_MASTERY` event is verified-and-ignored: the
reputation multivector is byte-identical with or without it. `sign` is already
generic over `kind`, so mastery uses the same canonical/BIP340 path.

### 2.2 `mp-wasm` — sign + expose the kind

```rust
// convert.rs (mirror sign_traversal_json): build the Mastery content + sign.
pub fn sign_mastery_json(kp: &Keypair, plateau_id: &str, created_at: u64) -> Result<String, EventError> {
    let plateau = Uuid::parse_str(plateau_id)?;
    let content = serde_json::to_string(&Mastery { plateau })?;
    let event = mp_identity::sign(kp, KIND_MASTERY, vec![], &content, created_at)?;
    Ok(serde_json::to_string(&event)?)
}

// lib.rs — on WasmIdentity, beside sign_traversal/sign_vouch:
pub fn sign_mastery(&self, plateau_id: &str) -> Result<String, JsError> {
    Ok(convert::sign_mastery_json(&self.inner, plateau_id, now_secs())?)
}
// free fn (like crystallize_threshold) so JS can pin the constant:
#[wasm_bindgen] pub fn mastery_kind() -> u32 { mp_identity::KIND_MASTERY }
```

**Host test (`convert.rs` `#[cfg(test)]`, run by `cargo test --workspace` — the
real gate; mirror `sign_traversal_then_recompute_lights_a_domain`):** sign a
mastery event → `verify` accepts it; decode → `kind == 30080`, content
`{plateau}`; and over a log of **{one traversal + one vouch}**,
`recompute_reputation_json(with_mastery) == recompute_reputation_json(without)`
(reputation byte-identical, AC4). Including the vouch exercises recompute's
order-sensitive vouch phase — the only place an extra event could have leaked.

### 2.3 `mastery.js` — the pure derived set

```js
// MUST match mp_identity::KIND_MASTERY. Pinned at runtime by a
// `console.assert(mastery_kind() === MASTERY_KIND)` in main.js after init()
// (mirrors the doc-root-keys assert, main.js:189–191) — mastery.test.mjs is
// node-only and can't load wasm, so the cross-language pin lives in main.js.
export const MASTERY_KIND = 30080;

/** Plateau ids the given pubkey has signed a (verified) mastery event for.
 *  Pure: scans already-verified events; parses content.plateau; dedupes. */
export function masteredTopics(events = [], pubkey) {
  const out = new Set();
  for (const e of events) {
    if (!e || e.kind !== MASTERY_KIND || e.pubkey !== pubkey) continue;
    try {
      const p = JSON.parse(e.content)?.plateau;
      if (p) out.add(p);
    } catch {
      /* malformed content — skip */
    }
  }
  return out;
}
```

`events` is `log.all()` (already BIP340-verified by `makeLog`), so `masteredTopics`
trusts them and just filters/parses. Pure, deterministic, node-tested.

### 2.4 `main.js` — sign, derive, render

- `let mastered = masteredTopics(log.all(), myPubkey)` computed after identity is
  ready, refreshed after each `ingest` and on `clear()` (Reset my history → empty).
- `function signMastery(p) { ingest(identity.sign_mastery(p.id)); mastered = masteredTopics(log.all(), myPubkey); persist?(); draw(); }`
  (`ingest` = `log.add`, which verify-gates + dedupes + persists the log mirror;
  no CRDT write). Re-mastering is idempotent (dedup by event id, set by plateau id).
- **Self-test gate (AC1)** in the detail drawer: a **"Mark as mastered"** control.
  Click → run the **Quiz me** action (existing `studyAction` for the `quiz` key —
  offline digest or model) so the recall questions render, and reveal a confirm
  **"✓ I can answer these — mark mastered"**. Confirm → `signMastery(studyPlateau)`.
  If already in `mastered`, the control shows a static **"✓ Mastered"** (no re-sign
  needed; idempotent if pressed).
- Pass `mastered` into `render(...)`; in `openPlateau`, show a ✓ in the drawer
  when `mastered.has(p.id)`.

### 2.5 `render.js` — ✓ on a mastered disc

`render` takes a new `mastered = new Set()` arg. After drawing a plateau disc
(unchanged radius/hit-test, R-0024), if `mastered.has(p.id)` draw a small ✓ glyph
at the disc's upper-right (canvas `fillText("✓", …)`, a calm green). Purely
additive; discs, labels, fog, bridges unchanged.

### 2.6 `index.html`

A `#detail-mastery` row in `#plateau-detail` (near the study actions): the
"Mark as mastered" button, the confirm button (hidden until the self-test runs),
and the "✓ Mastered" static state + CSS. **`#detail-mastery` must be added to the
bridge-mode hide-list** (the `#plateau-detail[data-mode="bridge"] …{display:none}`
selector in index.html, currently `#detail-body, .detail-res-title, #detail-study,
#detail-reply, #detail-resources, #detail-add-form`) so it never leaks into the
R-0029 connection view.

## 3. Code outline

- `event.rs`: `KIND_MASTERY` + `Mastery` (+ `pub use` in lib.rs). `recompute` untouched.
- `convert.rs`: `sign_mastery_json`. `lib.rs`: `WasmIdentity::sign_mastery` + `mastery_kind()`.
- `convert.rs` `#[cfg(test)]`: mastery signs+verifies, kind 30080,
  reputation-unchanged over {traversal+vouch} (host `cargo test`, mirrors
  `sign_traversal_then_recompute_lights_a_domain`).
- `mastery.js` + `mastery.test.mjs`: `masteredTopics` (only own KIND_MASTERY,
  dedupe, ignore other kinds/pubkeys/malformed, deterministic; `MASTERY_KIND === 30080`).
- `main.js`: `mastered` set + `signMastery` + the self-test UI + render wiring.
- `render.js`: the `mastered` ✓ glyph. `index.html`: `#detail-mastery` + CSS.
- Rebuild `apps/web/pkg` (`wasm-pack build … --target web`).

## 4. Non-goals

Per R-0030 §4: not the crowd-approval layer (R-0031); no un-master (Reset only);
no reputation/eigentrust change; no free-text grading; no XP/streaks.

## 5. Open questions (resolved here)

- `KIND_MASTERY = 30080` (next free). §2.1; pinned by the wasm test + the JS
  `MASTERY_KIND` constant.
- Self-test = run Quiz me + one "I can answer these" attestation. §2.4.
- ✓ = a small canvas glyph at the disc corner (hit-test unchanged). §2.5.

## 6. Acceptance criteria

Maps to R-0030 AC:

- [ ] AC1 — "Mark as mastered" runs Quiz me + requires the attestation. *(browser)*
- [ ] AC2 — confirm signs a `KIND_MASTERY` event into the verified log; verifies;
      not in the CRDT. *(wasm test + browser)*
- [ ] AC3 — ✓ in the drawer + on the disc, derived from the log; idempotent;
      survives reload. *(browser + `masteredTopics` test)*
- [ ] AC4 — reputation byte-identical with/without the mastery event. *(wasm test)*
- [ ] AC5 — Reset my history clears mastery (log cleared); no unsigned entry counts. *(browser)*
- [ ] AC6 — `masteredTopics` pure + tested; `recompute` unchanged; `mastery_kind()`
      pins `MASTERY_KIND`. *(node + wasm tests)*
- [ ] AC7 — additive; no CRDT/reputation change; inert render; suites green. *(diff + suites)*
- [ ] AC8 — browser: master a studied topic → ✓ (drawer+disc), survives reload,
      reset clears, reach unchanged, console clean.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | `KIND_MASTERY=30080`, content `{plateau}`, signed via the generic `sign` | Next free app-data kind; reuses the canonical/BIP340 path; self-contained content |
| 2026-06-15 | `recompute` unchanged — mastery is verified-and-ignored | It sums only traversal/vouch, so reputation is provably untouched (AC4) |
| 2026-06-15 | `mastered` set is a pure JS derivation over `log.all()` | The log is already verified; the set is presentation, browser-free + testable |

## Changelog

- 2026-06-15 created (Draft) — `KIND_MASTERY` signed event + pure `masteredTopics`
  + self-tested "Mark as mastered" + ✓; recompute untouched. Pending architect
  review, then `Accepted`.
- 2026-06-15 architect design review: **APPROVE-WITH-NITS** — AC4 (reputation
  untouched) proven from recompute.rs:46,63 (mastery is verified-and-ignored;
  recompute never counts log length); `sign`/`verify` reuse + `?`-propagated
  errors (no unwrap) + minimal `{plateau}` content + pure `masteredTopics`/`clear`
  reset all confirmed. Folded the three must-fixes: the reputation-unchanged test
  is a **host `convert.rs` test** (not wasm) over {traversal+vouch}; `#detail-mastery`
  joins the **bridge-mode hide-list**; the `MASTERY_KIND` pin is a **`console.assert`
  in main.js**. **Status → Accepted.**
- 2026-06-15 implemented + browser-verified. `KIND_MASTERY=30080` + `Mastery`
  payload (mp-identity); `sign_mastery_json` + `WasmIdentity::sign_mastery` +
  `mastery_kind()` (mp-wasm) + the host `convert.rs` reputation-unchanged test;
  pure `mastery.js` (`masteredTopics`) + 5 tests; `main.js` `mastered` set +
  `signMastery` + `renderMastery` self-test gate + the `mastery_kind()` pin;
  `render.js` ✓ glyph; `index.html` `#detail-mastery` (+ bridge-mode hide). 199
  JS + workspace cargo (incl. the byte-identical-reputation test) + clippy(host
  +wasm32) + fmt all green. Browser: Quiz-me self-test → confirm → KIND_MASTERY
  signed → "✓ Mastered" + disc ✓; persisted across reload; Reset my history
  cleared it (0 events); reach unchanged; console clean. QA PASS → R-0030
  **Met**. **Status → Implemented.**
