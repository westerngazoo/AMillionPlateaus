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
}
