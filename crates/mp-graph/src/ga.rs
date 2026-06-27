//! Thin adapter over garust's concrete G(3,0,0) f32 algebra.
//!
//! garust is the only math layer (CLAUDE.md §1). These are *derived*
//! conveniences the project's design docs assume as methods
//! (`vector`, `dominant_grade`, `even_grade`, `norm`, `normalize`) but which
//! garust does not yet expose — every one is built purely from garust
//! primitives (`grade`, `norm_squared`, the geometric product, scalar
//! multiplication). No other math library is introduced.
//!
//! It also provides serde glue: garust's `Multivector` does not derive
//! `Serialize`/`Deserialize`, so we (de)serialize the public `coeffs` array.

use garust::Vga3f;

/// The knowledge-space algebra: 3D Euclidean GA, Cl(3,0,0), over f32.
///
/// Blade layout: `[1, e1, e2, e12, e3, e13, e23, e123]`
///   e1 = Formal/Mathematical, e2 = Physical/Empirical, e3 = Creative/Expressive.
pub type Mv = Vga3f;

/// Coefficients below this magnitude are floating-point dust.
pub const EPSILON: f32 = 1e-4;

/// Construct a Grade-1 vector `a·e1 + b·e2 + c·e3`.
pub fn vector(a: f32, b: f32, c: f32) -> Mv {
    Mv {
        coeffs: [0.0, a, b, 0.0, c, 0.0, 0.0, 0.0],
    }
}

/// Euclidean magnitude of the grade-`k` part of `mv`.
pub fn grade_magnitude(mv: &Mv, k: usize) -> f32 {
    mv.grade(k).coeffs.iter().map(|c| c * c).sum::<f32>().sqrt()
}

/// The grade (0..=3) carrying the most "mass". Ties resolve to the lower grade.
pub fn dominant_grade(mv: &Mv) -> u8 {
    let mut best = 0u8;
    let mut best_mag = grade_magnitude(mv, 0);
    for k in 1..=3u8 {
        let mag = grade_magnitude(mv, k as usize);
        if mag > best_mag {
            best_mag = mag;
            best = k;
        }
    }
    best
}

/// Even-grade part (grade 0 + grade 2) — the rotor subalgebra.
pub fn even_grade(mv: &Mv) -> Mv {
    mv.grade(0) + mv.grade(2)
}

/// True if the odd-grade (1 and 3) parts are negligible.
pub fn is_even_grade(mv: &Mv) -> bool {
    grade_magnitude(mv, 1) < EPSILON && grade_magnitude(mv, 3) < EPSILON
}

/// Versor magnitude `√|M · ~M|`.
pub fn norm(mv: &Mv) -> f32 {
    mv.norm_squared().abs().sqrt()
}

/// Scale `mv` to unit versor norm. Returns it unchanged when its norm is
/// below tolerance (avoids divide-by-zero on the zero multivector).
pub fn normalize(mv: &Mv) -> Mv {
    let n = norm(mv);
    if n > EPSILON {
        *mv * (1.0 / n)
    } else {
        *mv
    }
}

/// Fog projection: how strongly reputation `rep` "faces" a plateau `position`.
///
/// Defined as the scalar part of the Hestenes inner product
/// `⟨rep · position⟩₀`. The Hestenes inner product contributes **nothing** for a
/// Grade-0 (scalar) operand, so a scalar-only (Sybil) reputation projects to 0
/// and sees only fog — the fog mechanic is Sybil-resistant for free. For this
/// reason `project` uses garust's `inner`, never `scalar_product`: the two
/// differ precisely on scalar inputs, and that difference *is* the resistance.
pub fn project(rep: &Mv, position: &Mv) -> f32 {
    rep.inner(position).scalar_part()
}

/// Reverse (a.k.a. dagger, `~M`) of a multivector: flips the sign of grades 2
/// and 3, leaving grades 0 and 1 unchanged — the `(-1)^{k(k-1)/2}` per-grade
/// sign. Built from garust grade projections and scalar multiplication; no new
/// math library (CLAUDE.md §1).
pub fn reverse(mv: &Mv) -> Mv {
    mv.grade(0) + mv.grade(1) + mv.grade(2) * (-1.0) + mv.grade(3) * (-1.0)
}

/// Transport `v` along a rotor by the sandwich product `R · v · ~R`. For a unit
/// rotor this rotates `v`, preserving its grade and Euclidean norm — the
/// geometry of moving a multivector across a [`crate::Rotored`] edge.
pub fn sandwich(rotor: &Mv, v: &Mv) -> Mv {
    *rotor * *v * reverse(rotor)
}

/// Outer (wedge) product a ∧ b — the subspace JOIN. v lies in plane B iff v ∧ B = 0.
pub fn wedge(a: &Mv, b: &Mv) -> Mv {
    a.wedge(b)
}

/// Regressive product a ∨ b — the subspace MEET (line where two planes intersect).
pub fn meet(a: &Mv, b: &Mv) -> Mv {
    a.regressive(b)
}

/// Metric-independent dual (right complement). A plane is the dual of its normal vector.
pub fn dual(m: &Mv) -> Mv {
    m.right_complement()
}

/// serde glue for `Mv`, used via `#[serde(with = "crate::ga::serde_mv")]`.
/// garust's `Multivector` has a public `[f32; DIM]` coefficient array; we
/// persist exactly that.
pub mod serde_mv {
    use super::Mv;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(mv: &Mv, s: S) -> Result<S::Ok, S::Error> {
        mv.coeffs.serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Mv, D::Error> {
        let coeffs = <[f32; 8]>::deserialize(d)?;
        Ok(Mv { coeffs })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_is_grade_one() {
        assert_eq!(dominant_grade(&vector(0.9, 0.1, 0.0)), 1);
    }

    #[test]
    fn vector_norm_is_euclidean_length() {
        // |3 e1 + 4 e2| = 5
        assert!((norm(&vector(3.0, 4.0, 0.0)) - 5.0).abs() < EPSILON);
    }

    #[test]
    fn geometric_product_of_two_vectors_is_even() {
        let gp = vector(0.9, 0.1, 0.0) * vector(0.6, 0.5, 0.1);
        assert!(is_even_grade(&even_grade(&gp)));
    }

    #[test]
    fn normalize_yields_unit_norm() {
        let r = normalize(&even_grade(
            &(vector(0.9, 0.1, 0.0) * vector(0.3, 0.4, 0.8)),
        ));
        assert!((norm(&r) - 1.0).abs() < EPSILON);
    }

    #[test]
    fn reverse_is_an_involution() {
        let m = even_grade(&(vector(0.9, 0.1, 0.0) * vector(0.3, 0.4, 0.8)));
        let back = reverse(&reverse(&m));
        for (a, b) in m.coeffs.iter().zip(back.coeffs.iter()) {
            assert!((a - b).abs() < EPSILON);
        }
    }

    #[test]
    fn identity_rotor_transports_unchanged() {
        let v = vector(0.3, 0.4, 0.8);
        let out = sandwich(&Mv::scalar(1.0), &v);
        for (a, b) in v.coeffs.iter().zip(out.coeffs.iter()) {
            assert!((a - b).abs() < EPSILON);
        }
    }

    #[test]
    fn wedge_properties() {
        let e1 = vector(1.0, 0.0, 0.0);
        let e2 = vector(0.0, 1.0, 0.0);
        let e3 = vector(0.0, 0.0, 1.0);

        let e12 = wedge(&e1, &e2);
        assert!(e12.coeffs[3].abs() > EPSILON); // e12 is at index 3

        let w1 = wedge(&e1, &e12);
        assert!(grade_magnitude(&w1, 3) < EPSILON);

        let w2 = wedge(&e3, &e12);
        assert!(grade_magnitude(&w2, 3) > EPSILON);
    }

    #[test]
    fn meet_properties() {
        let e1 = vector(1.0, 0.0, 0.0);
        let e2 = vector(0.0, 1.0, 0.0);
        let e3 = vector(0.0, 0.0, 1.0);

        let p1 = wedge(&e1, &e2);
        let p2 = wedge(&e2, &e3);

        let m = meet(&p1, &p2);
        assert_eq!(dominant_grade(&m), 1);
        assert!(m.coeffs[2].abs() > EPSILON); // e2 dominant
        assert!(m.coeffs[1].abs() < EPSILON); // e1 ≈ 0
        assert!(m.coeffs[4].abs() < EPSILON); // e3 ≈ 0
    }

    #[test]
    fn dual_properties() {
        let v = vector(1.0, 2.0, 3.0);
        let d1 = dual(&v);
        assert_eq!(dominant_grade(&d1), 2);

        let d2 = dual(&d1);
        assert_eq!(dominant_grade(&d2), 1);

        // dual(dual(v)) ≈ ±v
        let mut same = true;
        let mut opp = true;
        for i in 0..8 {
            if (v.coeffs[i] - d2.coeffs[i]).abs() > EPSILON {
                same = false;
            }
            if (v.coeffs[i] + d2.coeffs[i]).abs() > EPSILON {
                opp = false;
            }
        }
        assert!(same || opp);
    }

    #[test]
    fn rotor_sandwich_preserves_grade_and_norm() {
        // A normalized even-grade rotor rotates a vector: grade-1 in, grade-1
        // out, same Euclidean length.
        let r = normalize(&even_grade(
            &(vector(1.0, 0.0, 0.0) * vector(0.0, 1.0, 0.0)),
        ));
        let v = vector(0.6, 0.0, 0.8);
        let out = sandwich(&r, &v);
        assert_eq!(dominant_grade(&out), 1);
        assert!((norm(&out) - norm(&v)).abs() < EPSILON);
    }
}
