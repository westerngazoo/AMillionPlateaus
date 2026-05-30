# GARUST INTEGRATION — A Million Plateaus

## Overview

`garust` is the geometric algebra library (G(3,0,0), bitmask/XOR blade representation, const generics, named accessors) developed by the project author. It is the mathematical backbone of the entire knowledge graph — not an add-on, but the foundation.

This document specifies exactly how garust types and operations map to graph concepts.

---

## 1. Knowledge Space Geometry

The knowledge space is modeled as G(3,0,0) — 3D Euclidean geometric algebra. The three basis vectors map to three orthogonal **meta-domains**:

```
e1 → Formal / Mathematical  (logic, proof, structure)
e2 → Physical / Empirical   (science, measurement, observation)
e3 → Creative / Expressive  (art, music, language, design)
```

Every plateau and every wizard has a position/orientation in this space. This is not just aesthetic — the geometry determines reachability, bridge type, and reputation propagation.

---

## 2. Plateau Positioning

```rust
use garust::Multivector;

pub struct PlateauNode {
    pub id:       Uuid,
    pub name:     String,
    pub position: Multivector,  // Grade-1: vector in knowledge space
    pub domain:   DomainId,
}
```

**Example positions:**
```rust
// Pure math plateau — strongly e1
let linear_algebra = Multivector::vector(0.9, 0.1, 0.0);

// Physics plateau — e1 + e2 blend
let classical_mechanics = Multivector::vector(0.5, 0.8, 0.0);

// Music theory — all three
let harmony = Multivector::vector(0.3, 0.4, 0.8);
```

The **scalar part** of a position multivector is always 0 for plateaus — plateaus are pure vectors (Grade 1). This is enforced at construction.

---

## 3. Bridge Encoding

A bridge is not a scalar weight. It is a **rotor** — an element of G(3,0,0) that encodes both the *magnitude* of connection and its *orientation* in knowledge space.

```rust
pub struct Bridge {
    pub rotor:                Multivector,  // Grade-0 + Grade-2 element (even subalgebra)
    pub concept_label:        String,       // "linear transformation", "eigenfunctions", etc.
    pub dominant_grade:       u8,           // 1, 2, or 3 — bridge type
    pub bidirectional:        bool,
}
```

**Bridge grades and meaning:**

| Grade | Type | Geometric meaning | Example |
|---|---|---|---|
| 1 | Prerequisite | Directed vector — one-way dependency | Calculus → Differential Equations |
| 2 | Lateral | Bivector plane — peer intersection | Linear Algebra ↔ Geometry |
| 3 | Deep synthesis | Trivector — volumetric overlap | Physics + Math + Art at Symmetry |

**Constructing a bridge rotor:**
```rust
// Bridge from Linear Algebra to Differential Geometry
// Intersection concept: "linear transformation"
// This is a lateral (grade-2) bridge

let la_pos  = linear_algebra.position;
let dg_pos  = diff_geometry.position;

// The bridge rotor is the geometric product normalized to even grade
let bridge_rotor = (la_pos * dg_pos).even_grade().normalize();

let bridge = Bridge {
    rotor: bridge_rotor,
    concept_label: "linear transformation".to_string(),
    dominant_grade: bridge_rotor.dominant_grade(),
    bidirectional: true,
};
```

---

## 4. Wizard Reputation as Multivector

This is the key innovation. Scalar reputation (one number) is Sybil-attackable. Multivector reputation in G(3,0,0) is not.

```rust
pub struct WizardReputation {
    // Domain-scoped: reputation means different things in different domains
    pub domain_reps: HashMap<DomainId, Multivector>,
    // Cross-domain synthesis — only grows via genuine multi-plateau contribution
    pub synthesis:   Multivector,  // bivector + trivector components
}
```

**Grade interpretation of reputation:**
```
Grade 0 (scalar)   → raw activity count (easily faked)
Grade 1 (vector)   → domain-specific depth (harder to fake)
Grade 2 (bivector) → cross-domain synthesis (very hard to fake)
Grade 3 (trivector)→ Grand Wizard — all three meta-domains synthesized
```

A Sybil cluster of fake accounts all vouching for each other produces only scalar reputation — Grade 0 components that cancel in the geometric product. They cannot produce bivector or trivector components without genuine cross-domain traversal.

---

## 5. Reputation Propagation — GA Eigentrust

Standard Eigentrust: `t_j = Σ_i (c_ij * t_i)` — scalar multiplication, vulnerable to collusion.

GA Eigentrust: voucher's reputation **rotates** the vouched reputation via the bridge rotor:

```rust
impl WizardReputation {
    pub fn propagate(
        voucher: &WizardReputation,
        bridge: &Bridge,
        vouched: &mut WizardReputation,
        domain: &DomainId,
    ) {
        let r = &bridge.rotor;
        let r_rev = r.reverse();

        if let Some(voucher_rep) = voucher.domain_reps.get(domain) {
            // Rotor sandwich: R * reputation * R†
            // This rotates the reputation vector in knowledge space
            // Sybil clusters produce rotations that cancel — grade collapse
            let transferred = r * voucher_rep * r_rev;

            vouched.domain_reps
                .entry(*domain)
                .and_modify(|rep| *rep = rep.add(&transferred.scale(TRUST_DECAY)))
                .or_insert(transferred.scale(TRUST_DECAY));
        }
    }
}
```

**Why grade collapse detects Sybil clusters:**

If A, B, C all have only scalar reputation (Grade 0) and vouch for each other in a ring:
```
R * s * R† where s is scalar → s * R * R† = s * 1 = s   (scalar, no grade promotion)
```
The rotor sandwich of a scalar returns a scalar — no grade promotion is possible. Legitimate wizards accumulate higher grades through genuine cross-domain work, which produces non-trivial rotations that **do** promote grades.

---

## 6. Fog / Reachability Computation

```rust
impl KnowledgeGraph {
    pub fn is_reachable(
        &self,
        plateau: &PlateauNode,
        wizard: &WizardReputation,
        domain: &DomainId,
    ) -> bool {
        let Some(rep) = wizard.domain_reps.get(domain) else {
            return false;
        };
        // Inner product projects reputation onto plateau's position vector
        // Scalar part = how much wizard's knowledge "faces" this plateau
        let projection = rep.inner_product(&plateau.position);
        projection.scalar_part() > REACHABILITY_THRESHOLD
    }
}

const REACHABILITY_THRESHOLD: f32 = 0.15;
```

This elegantly encodes: a plateau in the Creative meta-domain (high e3 component) requires the wizard to have accumulated reputation with e3 components. A pure math wizard (high e1) will find creative plateaus fogged until they begin cross-domain work.

---

## 7. Alebrije Flight Path — Geodesic via Rotor Slerp

When the Alebrije guides the player between two plateaus, it flies a **geodesic** in multivector space — the shortest rotational path:

```rust
pub fn geodesic_path(
    from: &PlateauNode,
    to: &PlateauNode,
    steps: usize,
) -> Vec<Multivector> {
    // Rotor that takes `from` position to `to` position
    let r = rotor_from_to(&from.position, &to.position);

    (0..=steps)
        .map(|i| {
            let t = i as f32 / steps as f32;
            let r_t = r.slerp(t);  // garust slerp
            r_t.sandwich(&from.position)
        })
        .collect()
}
```

This produces a smooth curve through knowledge space — not a straight line, but a **rotation** — which is philosophically correct: moving between knowledge domains is a reorientation, not a translation.

---

## 8. garust API Surface Required

The following methods are required from garust. Mark as ✅ if already implemented:

| Method | Signature | Status |
|---|---|---|
| Geometric product | `Multivector * Multivector -> Multivector` | ✅ |
| Reverse | `Multivector.reverse() -> Multivector` | ✅ |
| Inner product | `Multivector.inner_product(Multivector) -> Multivector` | ✅ |
| Scalar part | `Multivector.scalar_part() -> f32` | ✅ |
| Grade filter | `Multivector.grade(u8) -> Multivector` | ✅ |
| Dominant grade | `Multivector.dominant_grade() -> u8` | ✅ |
| Even grade | `Multivector.even_grade() -> Multivector` | ✅ |
| Normalize | `Multivector.normalize() -> Multivector` | ✅ |
| Slerp | `Multivector.slerp(f32) -> Multivector` | ✅ |
| Sandwich product | `Multivector.sandwich(Multivector) -> Multivector` | ✅ |
| Scale | `Multivector.scale(f32) -> Multivector` | ✅ |
| Add | `Multivector.add(Multivector) -> Multivector` | ✅ |
| Vector constructor | `Multivector::vector(f32, f32, f32) -> Multivector` | ✅ |
| Norm / magnitude | `Multivector.norm() -> f32` | ✅ |

> **Reality check (2026-05-30, from reading `../garust` source).** The table
> above is *aspirational* — it does not match the shipped garust API. garust's
> real surface for `Cl(3,0,0)` over f32 is the concrete alias `garust::Vga3f`
> (`Multivector<f32, 3, 0, 0, 8>`), with a **public** `coeffs: [f32; 8]` array
> and these methods:
>
> | This doc assumes | garust actually provides |
> |---|---|
> | `Multivector::vector(a,b,c)` | *(none)* — build via `coeffs` / `basis()` |
> | `.inner_product(x)` | `.inner(&x)` |
> | `.dominant_grade()` | *(none)* — derive from `.grade(k)` |
> | `.even_grade()` | *(none)* — `grade(0) + grade(2)` |
> | `.normalize()`, `.norm()` | *(none)* — derive from `.norm_squared()` |
> | `.scale(s)`, `.add(x)` | `*` (scalar mul) and `+` operators |
> | `.slerp(t)` | *(none)* — build from `.exp()` of a bivector |
> | `.grade(u8)` | `.grade(usize)` ✅ |
> | `.reverse()`, `.scalar_part()`, `.sandwich(&x)`, geometric product `*` | ✅ as documented |
> | serde `Serialize`/`Deserialize` | *(not derived)* — persist `coeffs` |
>
> The gap is bridged in **`mp_graph::ga`** (a thin adapter built only from
> garust primitives — no other math lib). Phase 1 (`mp-reputation`) should reuse
> that adapter and extend it (e.g. a `slerp` for Alebrije flight paths) rather
> than assume the methods above exist on garust directly.
