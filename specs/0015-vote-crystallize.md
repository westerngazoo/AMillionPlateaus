# SPEC-0015 — Vote → Crystallize: derive resource state from the votes tally

- **Status:** Accepted
- **Realizes:** R-0015
- **Author:** Gustavo Delgadillo
- **Created:** 2026-06-04
- **Depends on:** SPEC-0014 (markers/resources + render), SPEC-0010 (wizard pubkey), SPEC-0012 (durability), SPEC-0005 (sync)
- **Module(s):** `crates/mp-crdt/src/doc.rs` (`to_graph` state derivation), `crates/mp-wasm/src/lib.rs` (expose threshold), `apps/web/src/vote.js` + `vote.test.mjs` (new), `apps/web/src/render.js`, `apps/web/index.html`, `apps/web/src/main.js`

## 1. Motivation

R-0015: place stones on a marker; crossing `CRYSTALLIZE_THRESHOLD` flips it
Floating → Crystallized. The `votes` map, `vote`/`resource_vote`, grow-only
`cast`, `weighted_sum`, and `CRYSTALLIZE_THRESHOLD = 50.0` already exist, and
`to_graph` already recomputes each resource's `vote_count` from the tally. The
work: derive `state` from that `vote_count` in the projection, add a vote UI, and
show the flip. State is **computed, never client-set** (DECENTRALIZATION.md /
CLAUDE.md §6).

## 2. Design

### 2.1 Module layout

```
crates/mp-crdt/src/doc.rs    ← EDIT  to_graph: derive r.state from r.vote_count vs threshold (+ a test)
crates/mp-wasm/src/lib.rs    ← EDIT  expose crystallize_threshold() AND wizard_id_of() to JS
apps/web/src/vote.js         ← NEW   buildVote (pure) — voter id comes from the canonical Rust wizard_id_of
apps/web/src/vote.test.mjs   ← NEW   node --test; no WASM
apps/web/src/render.js       ← EDIT  marker label shows vote total; crystallized = solid
apps/web/src/main.js         ← EDIT  Place-a-stone form: select + weight, submit → vote
apps/web/index.html          ← EDIT  the vote form markup
```

### 2.2 Rust — derive state from votes (the one core change)

`to_graph` (doc.rs) already does `r.vote_count = self.resource_vote(&r.id)?.weighted_sum()`.
Add the state derivation right after — the authoritative state is a pure function
of the tally, recomputed on every projection (so peers/reloads converge without
transmitting state):

```rust
for json in self.entries(RESOURCES)? {
    let mut r: Resource = serde_json::from_str(&json)?;
    r.vote_count = self.resource_vote(&r.id)?.weighted_sum();
    // Crystallization is DERIVED from the votes, never stored authoritatively
    // (CLAUDE.md §6). The persisted `state` is only an initial placeholder and is
    // overwritten here — a peer that synced `state: Crystallized` with zero votes
    // has it ignored and recomputed from the tally.
    r.state = if r.vote_count >= CRYSTALLIZE_THRESHOLD {
        ResourceState::Crystallized
    } else {
        ResourceState::Floating
    };
    graph.resources.insert(r.id, r);
}
```

(Adds `ResourceState` + `CRYSTALLIZE_THRESHOLD` to the existing
`use mp_domain::{…}` in doc.rs. No other core change.) **Also extend the
`to_graph` doc-comment** (doc.rs:99-104) to note that `state` — like
`vote_count` — is now recomputed from the tally and the serialized blob value is
non-authoritative (load-bearing for the CLAUDE.md §6 invariant).

**A `to_graph` test pins the "client never sets state" guarantee:** a resource
blob deserialized with `state: Crystallized` but **zero** votes must project back
as `Floating` (and crossing the threshold via `vote` projects as `Crystallized`).

Expose two free `#[wasm_bindgen]` functions in lib.rs (beside `verify_event` /
`recompute_reputation` / `rank_wizards`):

```rust
/// The weighted-vote sum at which a resource crystallizes (R-0015). Exposed so
/// the web app can show "n / threshold" without hardcoding the constant.
#[wasm_bindgen]
pub fn crystallize_threshold() -> f32 {
    mp_domain::CRYSTALLIZE_THRESHOLD
}

/// The canonical wizard id for a Nostr pubkey — the SAME `Uuid::new_v5` mapping
/// reputation and discovery already use (`mp_identity::wizard_id_of`). Exposed so
/// a vote is keyed by the wizard's real identity, not a parallel id (R-0015 AC6).
#[wasm_bindgen]
pub fn wizard_id_of(pubkey: &str) -> String {
    mp_identity::wizard_id_of(pubkey).to_string()
}
```

### 2.3 `vote.js` — pure factory

```js
// vote.js — pure. Validates a stone (a vote). No WASM, no GA. The VOTER ID is
// NOT derived here — it is the canonical `wizard_id_of(pubkey)` from Rust
// (UUIDv5 over the full pubkey), the same id reputation/discovery key by, so a
// vote attaches to the wizard's real identity (R-0015 AC6). Do not hand-roll a
// pubkey→id mapping in JS; that would diverge from the canonical one.

// buildVote({ resource, weight }) → { resource, weight, error: null } | { error }.
// Requires a marker; weight must be a finite positive number (the slider
// guarantees this — the guard is for the pure unit).
export function buildVote({ resource, weight } = {}) {
  if (!resource) return { error: "Pick a marker to place your stone on." };
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return { error: "Weight must be positive." };
  return { resource, weight: w, error: null };
}
```

The voter id comes from the wasm export: `wizard_id_of(myPubkey)` (§2.2) — the
**only** sanctioned pubkey→`WizardId` path. Any future vote-attribution/signing
must go through it too, so the vote identity never diverges from the reputation
identity.

### 2.4 `render.js` — show the total; crystallized is solid

The marker block (R-0014) gains a vote total in the label and a solid glyph when
Crystallized (it already branches alpha on `state === "Crystallized"`):

```js
const crystallized = r.state === "Crystallized";
ctx.globalAlpha = crystallized ? 1 : 0.6;
ctx.fillStyle = crystallized ? MARKER_SOLID : MARKER; // solid gold vs faint green
ctx.beginPath();
ctx.arc(mx, my, crystallized ? 5 : 4, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = LABEL;
const n = Math.round(r.vote_count ?? 0);
ctx.fillText(n > 0 ? `${r.title} · ${n}` : r.title, mx + 8, my + 3);
```

`MARKER_SOLID` is a new constant placed with the other color consts at the top
of render.js (e.g. `#ffd166`, the lit-plateau gold) so a crystallized marker
reads as bedrock; Floating stays faint green.

### 2.5 `index.html` + `main.js` — the Place-a-stone form

A collapsible `<details id="place-stone" class="draft-plateau">` + `#place-stone-toggle`
button in `.bar` (after `#drop-marker-toggle`): a `#vs-marker` select, a
`#vs-weight` range (`min=1 max=100 step=1 value=10`) with the threshold shown in
the label, `#vs-error`, submit. Wiring mirrors the marker form:

```js
import { buildVote } from "./vote.js";
// wizard_id_of + crystallize_threshold are imported from the wasm module.
const myVoterId = wizard_id_of(myPubkey); // canonical id — same as reputation/discovery

// rebuild #vs-marker from the current graph on open (resources by title)
function refreshVoteMarkers() {
  vsMarker.replaceChildren(...doc.to_graph().resources().map((r) => {
    const o = document.createElement("option");
    o.value = r.id; o.textContent = `${r.title} (${Math.round(r.vote_count)}/${crystallize_threshold()})`;
    return o;
  }));
}
document.getElementById("place-stone-toggle").addEventListener("click", () => {
  stonePanel.hidden = !stonePanel.hidden;
  if (!stonePanel.hidden) { stonePanel.open = true; refreshVoteMarkers(); }
});
document.getElementById("place-stone-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const spec = buildVote({ resource: vsMarker.value, weight: vsWeight.value });
  const errEl = document.getElementById("vs-error");
  if (spec.error) { errEl.textContent = spec.error; errEl.hidden = false; return; }
  try { doc.vote(spec.resource, myVoterId, spec.weight); }
  catch { errEl.textContent = "Could not place stone."; errEl.hidden = false; return; }
  errEl.hidden = true;
  sync.pump(); persist(); draw(); // vote_count + crystallization re-derive in draw()
});
```

`crystallize_threshold` and `wizard_id_of` are imported from the wasm module
alongside the other exports. `draw()` already projects via `to_graph()` (now
deriving state), so the marker re-renders solid the frame its total crosses the
threshold.

## 3. Code outline

See §2 — a ~3-line state derivation in `to_graph`, a one-line wasm threshold
export, one pure `vote.js` (factory + voter-id) + test, ~6 lines of marker-render
polish, ~10 lines of markup, ~30 lines of wiring.

## 4. Non-goals

- No new CRDT field; votes use the existing `votes` map. No GA in JS.
- No signed `ResourceVote` events; votes are CRDT state this phase.
- No un-vote / negative votes (`cast` is grow-only), no `Crystallizing`/`Dissolving`
  bands, no reputation-weighted vote power, no `WizardId`↔pubkey full reconciliation.

## 5. Open questions (resolved here)

- Weight control → slider 1–100, default 10 (one high-conviction wizard can cross
  50; typical stone is modest). §2.5.
- Render feedback → running total in the label + solid gold glyph when
  crystallized. §2.4.
- Crystallizing mid-state → not this phase (binary Floating/Crystallized). §2.2.

## 6. Acceptance criteria

Maps 1-to-1 to R-0015 AC:

- [ ] AC1 — Place-a-stone form: marker select (rebuilt on open), weight slider, submit.
- [ ] AC2 — Voting casts the wizard's weight (monotonic per wizard); the marker's
      total updates same-frame.
- [ ] AC3 — `to_graph` derives state from `vote_count` vs `CRYSTALLIZE_THRESHOLD`;
      crossing it renders the marker solid; client never sets state.
- [ ] AC4 — votes sync + persist; state re-derives identically on every peer/reload
      (nothing but votes on the wire).
- [ ] AC5 — grow-only `cast` ⇒ one wizard can't crystallize by count; sum is across
      distinct wizards (unit-proven in mp-crdt; surfaced here).
- [ ] AC6 — voter id is the canonical `wizard_id_of(pubkey)` (UUIDv5 over the
      full pubkey, host-tested in mp-identity; exposed to JS), identical to the
      reputation/discovery id — no parallel/truncated mapping. `buildVote`
      validates marker + positive weight (pure JS unit).
- [ ] AC7 — only `to_graph` state derivation + threshold export; root keys stay
      `{bridges, plateaus, resources, votes}`; no reputation in CRDT.
- [ ] AC8 — all suites green (incl. the `to_graph` state-derivation test and a
      wasm vote→crystallize round-trip); vote to crystallization + reload stays
      crystallized, no uncaught console errors.

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Derive `state` in `to_graph` from the recomputed `vote_count` | One authoritative place; convergent across peers with no state on the wire (CLAUDE.md §6) |
| 2026-06-04 | Expose `crystallize_threshold()` to JS rather than hardcode 50 | Single source of truth for the UI progress hint |
| 2026-06-04 | Voter id = the canonical `wizard_id_of(pubkey)` exposed to JS, NOT a hand-rolled JS mapping | Architect finding 1: a truncated JS derivation diverges from the reputation/discovery id and risks 16-byte-prefix collisions (weakening the AC5 distinct-wizard property). Reuse the one canonical UUIDv5-over-full-pubkey mapping; it is the only sanctioned pubkey→WizardId path |
| 2026-06-04 | Weight slider 1–100, default 10 | Demoable single-origin crystallization while keeping a typical stone modest; Sybil resistance is the grow-only cast, not the weight cap |

## Changelog

- 2026-06-04 created (Draft) — pending architect review, then Accepted.
- 2026-06-04 architect design review: **REQUEST CHANGES → resolved**. Blocking
  finding: the original `voterIdFromPubkey` (first 16 bytes of the pubkey → UUID)
  invented a parallel, collision-prone identity divergent from the canonical
  `mp_identity::wizard_id_of` (UUIDv5 over the full pubkey) used by
  reputation/discovery. **Fixed**: dropped the JS derivation; expose
  `wizard_id_of()` to JS and key votes by it (the only sanctioned pubkey→WizardId
  path). Minor findings folded: extend the `to_graph` doc-comment (state now
  derived); add a `to_graph` test (stored `state:Crystallized` + zero votes →
  `Floating`); `MARKER_SOLID` with the other color consts. AC5 single-wizard
  disclosure, the threshold export, and the deferred-events seam confirmed sound.
  **Status → Accepted**; ready to implement.
