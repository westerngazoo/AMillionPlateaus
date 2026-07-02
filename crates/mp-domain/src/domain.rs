//! Bivector-domain geometry (RFC-0002 Phase 1): a domain is an oriented plane;
//! membership by wedge; overlap by meet. All math routes through `mp_graph::ga`.

use mp_graph::ga::{self, Mv};

/// Starting band from the bivector spike on real seed topics (26–32% off-plane).
pub const MEMBERSHIP_TOLERANCE: f32 = 0.35;

/// Grade-1 coefficients `(e1, e2, e3)` from a multivector.
fn vector_coords(m: &Mv) -> [f32; 3] {
    let c = m.coeffs;
    [c[1], c[2], c[4]]
}

/// Smallest-eigenvector normal of the topic scatter via power iteration on
/// `(trace·I − C)` where `C` is the 3×3 covariance of centered grade-1 coords.
fn best_fit_normal(topics: &[&Mv]) -> Mv {
    let n = topics.len();
    if n == 0 {
        return Mv::zero();
    }
    if n == 1 {
        return *topics[0];
    }
    if n == 2 {
        let v1 = vector_coords(topics[0]);
        let v2 = vector_coords(topics[1]);
        return ga::vector(
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        );
    }

    let nf = n as f32;
    let mut cx = 0.0;
    let mut cy = 0.0;
    let mut cz = 0.0;
    for t in topics {
        let [x, y, z] = vector_coords(t);
        cx += x;
        cy += y;
        cz += z;
    }
    cx /= nf;
    cy /= nf;
    cz /= nf;

    let mut cxx = 0.0;
    let mut cyy = 0.0;
    let mut czz = 0.0;
    let mut cxy = 0.0;
    let mut cxz = 0.0;
    let mut cyz = 0.0;
    for t in topics {
        let [x, y, z] = vector_coords(t);
        let dx = x - cx;
        let dy = y - cy;
        let dz = z - cz;
        cxx += dx * dx;
        cyy += dy * dy;
        czz += dz * dz;
        cxy += dx * dy;
        cxz += dx * dz;
        cyz += dy * dz;
    }

    let trace = cxx + cyy + czz;
    let mut v = [1.0f32, 0.0, 0.0];
    for _ in 0..24 {
        let nv = [
            trace * v[0] - (cxx * v[0] + cxy * v[1] + cxz * v[2]),
            trace * v[1] - (cxy * v[0] + cyy * v[1] + cyz * v[2]),
            trace * v[2] - (cxz * v[0] + cyz * v[1] + czz * v[2]),
        ];
        let len = (nv[0] * nv[0] + nv[1] * nv[1] + nv[2] * nv[2]).sqrt();
        if len < ga::EPSILON {
            break;
        }
        v = [nv[0] / len, nv[1] / len, nv[2] / len];
    }
    ga::vector(v[0], v[1], v[2])
}

/// Fit a domain's characteristic plane (grade-2 bivector) from member topics.
///
/// For fewer than two topics, falls back to `dual(fallback_axis)` — the R-0038
/// lens direction for sparse domains.
pub fn domain_plane(topics: &[&Mv], fallback_axis: &Mv) -> Mv {
    if topics.is_empty() {
        return Mv::zero();
    }
    if topics.len() < 2 {
        return ga::normalize(&ga::dual(fallback_axis));
    }
    let normal = best_fit_normal(topics);
    if ga::grade_magnitude(&normal, 1) < ga::EPSILON {
        return ga::normalize(&ga::dual(fallback_axis));
    }
    ga::normalize(&ga::dual(&normal))
}

/// Out-of-plane fraction for topic `v` against domain plane `b` in `[0, 1]`.
pub fn membership(v: &Mv, b: &Mv) -> f32 {
    let vol = ga::grade_magnitude(&ga::wedge(v, b), 3);
    let denom = ga::grade_magnitude(v, 1) * ga::grade_magnitude(b, 2);
    if denom > ga::EPSILON {
        vol / denom
    } else {
        0.0
    }
}

/// True when `v` lies near plane `b` within `tolerance`.
pub fn is_member(v: &Mv, b: &Mv, tolerance: f32) -> bool {
    membership(v, b) <= tolerance
}

/// Shared line (grade-1) where two domain planes overlap — the regressive meet.
/// Returns zero when planes are parallel (no meaningful overlap).
pub fn shared_line(b1: &Mv, b2: &Mv) -> Mv {
    let line = ga::meet(b1, b2);
    if ga::grade_magnitude(&line, 1) < ga::EPSILON {
        return Mv::zero();
    }
    ga::normalize(&line)
}

/// Whether two domain planes have a non-degenerate meet.
pub fn has_domain_overlap(b1: &Mv, b2: &Mv) -> bool {
    ga::grade_magnitude(&ga::meet(b1, b2), 1) > ga::EPSILON
}

#[cfg(test)]
mod tests {
    use super::*;

    fn e1() -> Mv {
        ga::vector(1.0, 0.0, 0.0)
    }
    fn e2() -> Mv {
        ga::vector(0.0, 1.0, 0.0)
    }
    fn e3() -> Mv {
        ga::vector(0.0, 0.0, 1.0)
    }

    #[test]
    fn canonical_planes_meet_on_shared_axis() {
        let math = domain_plane(&[e1(), e2()], e1());
        let phys = domain_plane(&[e2(), e3()], e2());
        let line = shared_line(&math, &phys);
        assert!(has_domain_overlap(&math, &phys));
        assert_eq!(ga::dominant_grade(&line), 1);
        assert!(line.coeffs[2].abs() > ga::EPSILON);
    }

    #[test]
    fn parallel_planes_have_no_overlap() {
        let math = domain_plane(&[e1(), e2()], e1());
        let math2 = domain_plane(
            &[&ga::vector(0.9, 0.1, 0.0), &ga::vector(0.8, 0.2, 0.0)],
            e1(),
        );
        assert!(!has_domain_overlap(&math, &math2));
        assert!(ga::grade_magnitude(&shared_line(&math, &math2), 1) < ga::EPSILON);
    }

    #[test]
    fn in_plane_topic_has_zero_membership() {
        let math = domain_plane(&[e1(), e2()], e1());
        assert!(membership(&e1(), &math) < ga::EPSILON);
        assert!(is_member(&e1(), &math, MEMBERSHIP_TOLERANCE));
    }

    #[test]
    fn orthogonal_topic_has_high_membership() {
        let math = domain_plane(&[e1(), e2()], e1());
        let m = membership(&e3(), &math);
        assert!(m > 0.5);
        assert!(!is_member(&e3(), &math, MEMBERSHIP_TOLERANCE));
    }

    #[test]
    fn seed_math_topics_are_near_the_fitted_plane() {
        let algebra = ga::vector(0.8, 0.2, 0.1);
        let geometry = ga::vector(0.7, 0.1, 0.35);
        let calculus = ga::vector(0.6, 0.3, 0.3);
        let plane = domain_plane(&[&algebra, &geometry, &calculus], e1());
        for t in [&algebra, &geometry, &calculus] {
            let m = membership(t, &plane);
            assert!(
                m <= MEMBERSHIP_TOLERANCE,
                "seed topic should be near its domain plane (got {m:.2})"
            );
        }
    }

    #[test]
    fn sparse_domain_uses_fallback_axis() {
        let plane = domain_plane(&[e1()], e1());
        assert_eq!(ga::dominant_grade(&plane), 2);
    }
}
