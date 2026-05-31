# SPEC-0002 — GA reputation engine + fog reachability

- **Status:** Implemented
- **Realizes:** R-0002
- **Author:** Claude (Phase 1)
- **Created:** 2026-05-30
- **Depends on:** SPEC-0001
- **Module(s):** `crates/mp-reputation`, `crates/mp-graph` (reachability + ga helpers)

## 1. Motivation

Realizes R-0002: multivector reputation, rotor-sandwich Eigentrust with Sybil
grade-collapse, cross-domain synthesis, and the fog reachability query.

## 2. Design

Dependency direction stays inward: `mp-graph` (base) ← `mp-reputation`.

### mp-graph additions (no new deps)

1. **`WizardReputation` constructor & helpers** (`types.rs`):
   - `WizardReputation::new(wizard_id) -> Self` — empty domain map, zero synthesis.
   - `dominant_grade(&self) -> u8` — the maximum dominant grade across all domain
     reputations and synthesis (the wizard's "rank grade": 0 raw, 1 depth,
     2 synthesis, 3 grand wizard). A fresh wizard (empty map, zero synthesis)
     reports grade 0 — `ga::dominant_grade` ties to grade 0 on the zero
     multivector, consistent with "raw".

2. **`ga` helper** (`ga.rs`):
   - `project(rep: &Mv, position: &Mv) -> f32` = `rep.inner(position).scalar_part()`.
     The fog projection. (garust's inner product is `inner`, returns a
     `Multivector`; we take its scalar part.)

3. **Reachability on `KnowledgeGraph`** (`graph.rs`), per GRAPH_SCHEMA.md §6:
   - `is_reachable(&self, plateau: &PlateauNode, wizard: &WizardReputation) -> bool`
     — `true` iff `max_d ga::project(rep_d, plateau.position) > REACHABILITY_THRESHOLD`.
     Empty reputation ⇒ no domains ⇒ `false` (all fogged).
   - `reachable_plateaus(&self, wizard: &WizardReputation) -> Vec<PlateauId>`
     — the plateaus satisfying `is_reachable`.

   Note: a scalar-only (Grade-0) reputation projects to 0 under the Hestenes
   inner product (scalars contribute nothing), so Sybil wizards see only fog —
   the fog mechanic *itself* is Sybil-resistant, for free. This is why
   `ga::project` uses garust's `inner` (Hestenes) and **not** `scalar_product`:
   the two differ precisely on scalar inputs, and that difference *is* the Sybil
   resistance. Swapping to `scalar_product` would silently break AC6 and the
   fog Sybil property — do not.

### mp-reputation (`reputation.rs`)

A `ReputationEngine` holding tunable parameters; algorithms operate on
`WizardReputation` (defined in mp-graph — no orphan-impl problem because these
are methods on `ReputationEngine`, not on the foreign type).

```rust
pub struct ReputationEngine { pub trust_decay: f32 }   // default 0.5
impl Default for ReputationEngine { /* trust_decay: 0.5 */ }

impl ReputationEngine {
    /// AC2 — genuine domain depth. Adds depth·position (Grade-1) into the
    /// wizard's reputation for `domain`.
    pub fn record_traversal(&self, w: &mut WizardReputation, domain: DomainId,
                            position: &Mv, depth: f32);

    /// AC3/AC4 — GA Eigentrust. transferred = rotor.sandwich(rep) * trust_decay,
    /// accumulated into the vouched wizard's `domain` reputation.
    /// No-op if the voucher holds no reputation in `domain` (nothing to vouch).
    pub fn propagate(&self, voucher: &WizardReputation, bridge: &Bridge,
                     vouched: &mut WizardReputation, domain: &DomainId);

    /// AC5 — synthesis = Σ_{i<j} rep_i ∧ rep_j  (+ Σ_{i<j<k} rep_i∧rep_j∧rep_k).
    /// Recomputed from current domain reps; pure higher-grade by construction.
    /// Base cases: 0 or 1 domains ⇒ no pairs ⇒ zero synthesis (empty fold, no
    /// panic). Wedge of two *parallel* Grade-1 reps is ~0, so the cross-domain
    /// signal only appears for non-collinear positions.
    pub fn recompute_synthesis(&self, w: &mut WizardReputation);
}
```

`sandwich` is garust's `Multivector::sandwich(&self, x)` = `R·x·R̃`. For a scalar
`x = s`, `R·s·R̃ = s·(R·R̃) = s` for a unit rotor — Grade-0 in, Grade-0 out
(grade collapse, AC4). Bridge rotors are unit-normalized at construction
(SPEC-0001), so `R·R̃ ≈ 1`.

**Ring-collapse closure (AC4, repeated propagation).** The single-hop property
above only proves one transfer stays Grade-0. AC4 also requires that a *ring* of
≥3 scalar-only wizards stays Grade-0 under *repeated* propagation. This holds by
closure: `propagate` accumulates via `*r = *r + transferred`; each `transferred`
is Grade-0 (single-hop property), and Grade-0 + Grade-0 = Grade-0, so the
accumulated reputation never gains a higher grade no matter how many rounds run.
The *only* source of Grade-1 is `record_traversal` — a ring that never traverses
can never escape Grade-0. The `sybil_ring_stays_grade_zero` test must therefore
run **≥2 full propagation rounds** around the ring to exercise the closure, not
just one hop.

**Float-dust tolerance.** Because rotor normalization is approximate (`R·R̃ ≈ 1`
to within ~1e-8, not exactly 1), the sandwich of a scalar leaves residual
non-scalar terms far below `ga::EPSILON` (1e-4). `is_grade_collapsed` therefore
thresholds higher-grade magnitudes against `ga::EPSILON` (matching
`ga::is_even_grade`), **not** exact equality.

### Sybil grade-collapse (`sybil.rs`)

- `pub fn max_grade(rep: &WizardReputation) -> u8` (or reuse
  `WizardReputation::dominant_grade`).
- `pub fn is_grade_collapsed(rep: &WizardReputation) -> bool` — true iff every
  domain reputation and the synthesis are Grade-0 only. Used by the Sybil test:
  after ring-propagation among scalar-seeded wizards, all remain collapsed.

### Example `fog_demo` (`mp-reputation/examples/fog_demo.rs`)

Build the seed graph (reuse the 5-plateau set), a fresh wizard (all fogged),
print `reachable_plateaus` (empty); record traversals on 2–3 plateaus; reprint
(now includes aligned neighbours). Demonstrates AC7.

Since open question 5 chose *not* to normalize `position`, the traversal `depth`
directly scales the projected magnitude that must clear `REACHABILITY_THRESHOLD`
(0.15). The example uses a fixed depth large enough that an aligned neighbour
provably clears the threshold, and the `fog_lifts_after_traversal` integration
test **asserts** the previously-fogged plateau becomes reachable (so AC7 cannot
fail silently on an under-tuned depth).

## 3. Code outline

```rust
// mp-graph/src/graph.rs
pub fn is_reachable(&self, plateau: &PlateauNode, w: &WizardReputation) -> bool {
    w.domain_reps.values()
        .map(|rep| ga::project(rep, plateau.position()))
        .fold(f32::NEG_INFINITY, f32::max) > REACHABILITY_THRESHOLD
}

// mp-reputation/src/reputation.rs
pub fn propagate(&self, voucher: &WizardReputation, bridge: &Bridge,
                 vouched: &mut WizardReputation, domain: &DomainId) {
    if let Some(rep) = voucher.domain_reps.get(domain) {
        let transferred = bridge.rotor().sandwich(rep) * self.trust_decay;
        vouched.domain_reps.entry(*domain)
            .and_modify(|r| *r = *r + transferred)
            .or_insert(transferred);
    }
}
```

This requires `Bridge::rotor()` to be reachable from mp-reputation — it is a
`pub fn` getter (SPEC-0001). No new public field exposure.

## 4. Non-goals

- Nostr signed-event sourcing (Phase 8); reputation persistence; WASM (Phase 2).
- Alebrije geodesic slerp flight path.
- Decay/aging of reputation over time.
- Path-based (BFS over bridges) reachability — fog is a per-plateau projection.

## 5. Open questions

- `TRUST_DECAY` default 0.5 — confirm acceptable for the seed scenario.
- Should `record_traversal` normalize `position` first? Decision: no — depth
  scales raw position; magnitude carries "how much" depth.

## 6. Acceptance criteria

- [x] AC1 → `fresh_reputation_is_empty_and_grade_zero` + `scalar_reputation_is_grade_zero_regardless_of_magnitude` (map + synthesis, no scalar field; magnitude never promotes grade)
- [x] AC2 → `record_traversal_adds_grade_one`
- [x] AC3 → `propagate_uses_rotor_sandwich` (transferred matches `rotor.sandwich(rep)*decay`) + `propagate_without_voucher_domain_is_noop`
- [x] AC4 → `scalar_propagation_stays_scalar` + `sybil_ring_stays_grade_zero` (3-wizard ring, 3 rounds, asserts mass actually moved)
- [x] AC5 → `cross_domain_accumulates_bivector` + `single_domain_has_no_bivector` + `three_domains_yield_trivector` + `parallel_domains_have_no_bivector`
- [x] AC6 → `is_reachable_threshold` (strong/faint/empty/scalar-Sybil) + `reachable_plateaus_matches`
- [x] AC7 → `fog_lifts_after_traversal` (integration) + `fog_demo` example
- [x] AC8 → `cargo test -p mp-reputation` green (11 unit + 1 integration); `cargo run -p mp-reputation --example fog_demo` prints 0 → 4 → 5

## 7. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-30 | Reachability on `KnowledgeGraph` (mp-graph); engine in mp-reputation | GRAPH_SCHEMA.md placement + clean dep direction (R-0002 decision log) |
| 2026-05-30 | `ReputationEngine` methods, not impls on `WizardReputation` | Orphan rule — `WizardReputation` is defined in mp-graph |
| 2026-05-30 | Accumulate via `*r += transferred` (garust `AddAssign`); scale via `* f32` | garust exposes `+`/`+=` and scalar `*`, not `.add()`/`.scale()`; clippy `assign_op_pattern` prefers `+=` and garust implements `AddAssign` |
| 2026-05-30 | Spec accepted after architect review (APPROVE WITH CHANGES). Folded in: AC4 ring-collapse closure argument + ≥2-round Sybil test; `is_grade_collapsed` uses `ga::EPSILON` not exact equality; `dominant_grade`/`recompute_synthesis` empty-base cases stated; AC5 test must use non-collinear positions; `propagate` no-op documented; `ga::project` must use `inner` not `scalar_product`; AC7 depth asserted in test/example | All GA claims empirically confirmed against real garust (`products.rs:87` `inner` skips grade-0; `transform.rs:68` `sandwich`); changes are correctness-guarding, no design change |

## Changelog

- 2026-05-30 created
- 2026-05-30 accepted after architect design review; folded in correctness-guarding clarifications (see decision log)
- 2026-05-30 Implemented — all AC1–AC8 tests green; `qa` signed off, R-0002 → Met
