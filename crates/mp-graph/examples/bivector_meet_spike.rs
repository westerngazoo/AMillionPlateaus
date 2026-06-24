//! Spike: "a domain is a bivector (a plane), not a dimension."
//!
//! Explores the model proposed in conversation — represent a knowledge domain
//! as an oriented PLANE (a grade-2 bivector) in the existing Cl(3,0,0), rather
//! than as its own axis. Then:
//!   * a topic (grade-1 vector `v`) BELONGS to a domain (plane `B`) iff `v ∧ B = 0`
//!     (the wedge / join is zero exactly when `v` lies in the plane), and
//!   * two domains OVERLAP along a LINE given by the meet `B₁ ∨ B₂`
//!     (garust's regressive product) — the "grounded island" of shared topics.
//!
//! The whole point of the proposal: this adds NO dimensions. Grade-2 of Cl(3)
//! is itself 3-D, so there are infinitely many domain-planes inside the same
//! 8-coefficient multivector. A broad domain ("philosophy") is one bivector —
//! three numbers — that simply has a non-zero meet (a shared line) with every
//! other domain. It reuses the space; it does not grow it.
//!
//! Everything here goes through garust (the only math layer, CLAUDE.md §1):
//! `Multivector::wedge` (∧) and `Multivector::regressive` (∨, the meet). No new
//! math is invented — the spike only *arranges* garust primitives to test the
//! model before any RFC commits to it.
//!
//! Run:  cargo run -p mp-graph --example bivector_meet_spike

use mp_graph::ga::{self, Mv};

const EPS: f32 = 1e-4;

// Blade layout (Cl(3,0,0)):  [1, e1, e2, e12, e3, e13, e23, e123]
//                             0   1   2   3    4   5    6    7
fn wedge(a: &Mv, b: &Mv) -> Mv {
    a.wedge(b)
}
fn meet(a: &Mv, b: &Mv) -> Mv {
    a.regressive(b)
}

/// Pretty-print the non-negligible blades of a multivector.
fn show(m: &Mv) -> String {
    const NAMES: [&str; 8] = ["1", "e1", "e2", "e12", "e3", "e13", "e23", "e123"];
    let parts: Vec<String> = m
        .coeffs
        .iter()
        .enumerate()
        .filter(|(_, c)| c.abs() > EPS)
        .map(|(i, c)| format!("{:+.3}·{}", c, NAMES[i]))
        .collect();
    if parts.is_empty() {
        "0".to_string()
    } else {
        parts.join(" ")
    }
}

/// How far a vector lies OUT of a plane, as a fraction in [0,1]: the grade-3
/// part of `v ∧ B` (the triple-product volume) normalized by `|v|·|B|`. Zero
/// means `v` lies exactly in the plane `B`; 1 means it is orthogonal to it.
fn out_of_plane(v: &Mv, b: &Mv) -> f32 {
    let vol = ga::grade_magnitude(&wedge(v, b), 3);
    let denom = ga::grade_magnitude(v, 1) * ga::grade_magnitude(b, 2);
    if denom > EPS {
        vol / denom
    } else {
        0.0
    }
}

fn main() {
    let e1 = ga::vector(1.0, 0.0, 0.0);
    let e2 = ga::vector(0.0, 1.0, 0.0);
    let e3 = ga::vector(0.0, 0.0, 1.0);

    println!("=== Bivector-domain spike — Cl(3,0,0), all 8 coeffs, no new axes ===\n");

    // ── Part A — canonical mechanics (exact) ────────────────────────────────
    println!("Part A — the operators, on the coordinate planes (exact)");
    let math = wedge(&e1, &e2); // Formal–Empirical plane
    let phys = wedge(&e2, &e3); // Empirical–Creative plane
    let phil = wedge(&e1, &e3); // a third plane — stands in for a broad domain
    println!("  Math    domain  B_M  = e1∧e2  = {}", show(&math));
    println!("  Physics domain  B_P  = e2∧e3  = {}", show(&phys));
    println!("  Philos. domain  B_Φ  = e1∧e3  = {}", show(&phil));

    let m_meet_p = meet(&math, &phys);
    println!(
        "\n  meet  B_M ∨ B_P = {}   (expect a line ∝ e2 — the shared 'empirical' strand)",
        show(&m_meet_p)
    );
    // The meet of the e1e2-plane and the e2e3-plane is the e2 axis.
    assert!(ga::dominant_grade(&m_meet_p) == 1, "meet of two planes is a line (grade-1)");
    assert!(m_meet_p.coeffs[2].abs() > EPS, "shared line lies along e2");
    assert!(
        m_meet_p.coeffs[1].abs() < EPS && m_meet_p.coeffs[4].abs() < EPS,
        "shared line has no e1/e3 component"
    );
    println!("    [PASS] the meet is a pure-e2 line.");

    // Membership by the wedge: v ∧ B == 0  ⇔  v lies in plane B.
    println!("\n  membership (v ∧ B = 0 ⇔ v ∈ plane B):");
    println!("    e1 ∧ B_M = {}  → e1 ∈ Math plane", show(&wedge(&e1, &math)));
    println!("    e3 ∧ B_M = {}  → e3 ∉ Math plane", show(&wedge(&e3, &math)));
    assert!(ga::grade_magnitude(&wedge(&e1, &math), 3) < EPS, "e1 lies in the e1e2 plane");
    assert!(ga::grade_magnitude(&wedge(&e3, &math), 3) > EPS, "e3 is out of the e1e2 plane");
    println!("    [PASS] the wedge is a clean in/out-of-plane test.");

    // A broad domain reuses the space: it meets every other domain in a line,
    // and it is still just three bivector coefficients in the same Cl(3).
    let phil_meet_m = meet(&phil, &math);
    let phil_meet_p = meet(&phil, &phys);
    println!("\n  a broad domain (Philosophy) shares a LINE with each, adding no dimension:");
    println!("    B_Φ ∨ B_M = {}  (∝ e1)", show(&phil_meet_m));
    println!("    B_Φ ∨ B_P = {}  (∝ e3)", show(&phil_meet_p));
    println!(
        "    Philosophy is {} non-zero coeffs in an {}-coeff multivector — still plain Cl(3).",
        phil.coeffs.iter().filter(|c| c.abs() > EPS).count(),
        phil.coeffs.len()
    );

    // ── Part B — the REAL seed positions (apps/web/src/seeds.js) ────────────
    // Verbatim from seeds.js so this runs on the live world, not invented data.
    let algebra = ga::vector(0.8, 0.2, 0.1);
    let calculus = ga::vector(0.6, 0.3, 0.3);
    let geometry = ga::vector(0.7, 0.1, 0.35); // a THIRD Math topic
    let harmony = ga::vector(0.35, 0.1, 0.7);
    let counterpoint = ga::vector(0.3, 0.3, 0.6);
    let melody = ga::vector(0.1, 0.2, 0.8); // a THIRD Music topic

    println!("\nPart B — real seed positions (apps/web/src/seeds.js)");
    let b_math = wedge(&algebra, &calculus); // plane spanned by two Math topics
    let b_music = wedge(&harmony, &counterpoint); // plane spanned by two Music topics
    println!("  B_math  = Algebra ∧ Calculus      = {}", show(&b_math));
    println!("  B_music = Harmony ∧ Counterpoint  = {}", show(&b_music));

    let real_meet = ga::normalize(&meet(&b_math, &b_music));
    println!(
        "\n  meet  B_math ∨ B_music (unit) = {}\n    → the shared strand where the Math and Music planes cross.",
        show(&real_meet)
    );
    assert!(ga::dominant_grade(&real_meet) == 1, "the meet of two real planes is still a line");

    // The honest finding: real topics are NEAR a domain plane, not exactly in it.
    println!("\n  out-of-plane residual for a same-domain topic (0 = exactly in-plane):");
    let geo_res = out_of_plane(&geometry, &b_math);
    let mel_res = out_of_plane(&melody, &b_music);
    println!("    Geometry vs the Math plane  : {:.3}", geo_res);
    println!("    Melody   vs the Music plane : {:.3}", mel_res);
    println!(
        "    → both > 0: real topics sit {:.0}%/{:.0}% off a single plane, so domain membership\n      needs a NEAR-plane tolerance, not exact `v∧B=0`. (A finding for the RFC.)",
        geo_res * 100.0,
        mel_res * 100.0
    );

    println!("\n=== Conclusion ===");
    println!("  • meet (∨) and membership (∧) work directly on garust — no GA stubbing, no new axis.");
    println!("  • Two domain-planes intersect in a line = a computable 'grounded island'.");
    println!("  • A broad domain is 3 floats that meet every other domain in a line — it reuses Cl(3).");
    println!("  • Real topics are ~near, not in, one plane → membership needs a tolerance (RFC input).");
}
