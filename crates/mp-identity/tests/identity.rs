//! Host tests for the pure identity + recompute core (R-0010 AC8).
//!
//! Covers: keypair round-trip & secret hygiene (AC1), sign→verify and tamper
//! rejection (AC2), deterministic recompute & empty-log-reaches-nothing (AC3),
//! cross-order convergence incl. a shuffled vouch chain (AC4), and mutual-vouch
//! grade-0 collapse plus forgery rejection (AC5). No relay, no network.

use mp_domain::ga::{self, EPSILON};
use mp_domain::WizardReputation;
use mp_identity::{
    rank_by_domain, recompute, sign, verify, Keypair, PathDoc, Traversal, Vouch, KIND_PATH,
    KIND_TRAVERSAL, KIND_VOUCH,
};
use uuid::Uuid;

// ─── helpers ─────────────────────────────────────────────────

fn traversal(
    kp: &Keypair,
    domain: Uuid,
    e1: f32,
    e2: f32,
    e3: f32,
    depth: f32,
    created_at: u64,
) -> mp_identity::NostrEvent {
    let content = serde_json::to_string(&Traversal {
        domain,
        e1,
        e2,
        e3,
        depth,
        plateau: None,
    })
    .expect("serialize traversal");
    let tags = vec![vec!["d".to_string(), domain.to_string()]];
    sign(kp, KIND_TRAVERSAL, tags, &content, created_at).expect("sign traversal")
}

fn vouch(
    kp: &Keypair,
    domain: Uuid,
    vouched: &str,
    from: [f32; 3],
    to: [f32; 3],
    created_at: u64,
) -> mp_identity::NostrEvent {
    let content = serde_json::to_string(&Vouch {
        domain,
        vouched: vouched.to_string(),
        from,
        to,
    })
    .expect("serialize vouch");
    sign(kp, KIND_VOUCH, vec![], &content, created_at).expect("sign vouch")
}

fn domain_rep<'a>(
    reps: &'a std::collections::BTreeMap<String, WizardReputation>,
    pk: &str,
) -> &'a ga::Mv {
    reps.get(pk)
        .expect("wizard present")
        .domain_reps
        .values()
        .next()
        .expect("a domain rep")
}

fn assert_mv_eq(a: &ga::Mv, b: &ga::Mv) {
    for (i, (x, y)) in a.coeffs.iter().zip(b.coeffs.iter()).enumerate() {
        assert!((x - y).abs() < EPSILON, "coeff {i} differs: {x} vs {y}");
    }
}

// ─── AC1 — keypair & secret hygiene ──────────────────────────

#[test]
fn keypair_roundtrips_and_pubkey_is_stable() {
    let kp = Keypair::generate();
    let sk = kp.secret_hex();
    let pk = kp.pubkey_hex();

    assert_eq!(sk.len(), 64, "secret is 32-byte hex");
    assert_eq!(pk.len(), 64, "x-only pubkey is 32-byte hex");
    assert!(sk.chars().all(|c| c.is_ascii_hexdigit()));
    assert!(pk.chars().all(|c| c.is_ascii_hexdigit()));

    let rebuilt = Keypair::from_secret_hex(&sk).expect("rebuild from secret");
    assert_eq!(rebuilt.pubkey_hex(), pk, "same secret ⇒ same pubkey");
    assert_eq!(rebuilt.secret_hex(), sk);
}

#[test]
fn distinct_keys_have_distinct_pubkeys() {
    let a = Keypair::generate().pubkey_hex();
    let b = Keypair::generate().pubkey_hex();
    assert_ne!(a, b);
}

#[test]
fn from_secret_hex_rejects_garbage() {
    assert!(Keypair::from_secret_hex("not-hex").is_err());
    assert!(Keypair::from_secret_hex("00").is_err()); // wrong length
}

// ─── AC2 — sign / verify / tamper rejection ──────────────────

#[test]
fn signed_event_verifies() {
    let kp = Keypair::generate();
    let ev = traversal(&kp, Uuid::new_v4(), 0.9, 0.1, 0.0, 1.0, 1);
    assert!(verify(&ev), "a freshly signed event must verify");
}

#[test]
fn tampered_id_is_rejected() {
    let kp = Keypair::generate();
    let mut ev = traversal(&kp, Uuid::new_v4(), 0.9, 0.1, 0.0, 1.0, 1);
    ev.id = "0".repeat(64);
    assert!(!verify(&ev));
}

#[test]
fn tampered_signature_is_rejected() {
    let kp = Keypair::generate();
    let mut ev = traversal(&kp, Uuid::new_v4(), 0.9, 0.1, 0.0, 1.0, 1);
    ev.sig = "0".repeat(128);
    assert!(!verify(&ev));
}

#[test]
fn tampered_content_is_rejected() {
    let kp = Keypair::generate();
    let mut ev = traversal(&kp, Uuid::new_v4(), 0.9, 0.1, 0.0, 1.0, 1);
    // Changing content without re-deriving id breaks self-consistency.
    ev.content = r#"{"domain":"00000000-0000-0000-0000-000000000000","e1":9.0,"e2":0.0,"e3":0.0,"depth":99.0,"plateau":null}"#.to_string();
    assert!(!verify(&ev));
}

#[test]
fn tampered_pubkey_is_rejected() {
    let kp = Keypair::generate();
    let other = Keypair::generate();
    let mut ev = traversal(&kp, Uuid::new_v4(), 0.9, 0.1, 0.0, 1.0, 1);
    ev.pubkey = other.pubkey_hex();
    assert!(!verify(&ev), "swapping in another pubkey must fail");
}

// ─── AC3 — recompute determinism & no free seed ──────────────

#[test]
fn empty_log_reaches_nothing() {
    let reps = recompute(&[]);
    assert!(reps.is_empty(), "no events ⇒ no reputation (no free seed)");
}

#[test]
fn fully_unverified_log_reaches_nothing() {
    let kp = Keypair::generate();
    let mut ev = traversal(&kp, Uuid::new_v4(), 1.0, 0.0, 0.0, 1.0, 1);
    ev.sig = "0".repeat(128); // invalidate
    let reps = recompute(&[ev]);
    assert!(reps.is_empty(), "only invalid events ⇒ empty reputation");
}

#[test]
fn single_traversal_earns_grade_one() {
    let kp = Keypair::generate();
    let domain = Uuid::new_v4();
    let ev = traversal(&kp, domain, 0.9, 0.1, 0.0, 1.0, 1);
    let reps = recompute(&[ev]);

    let rep = reps.get(&kp.pubkey_hex()).expect("wizard present");
    let mv = rep.domain_reps.get(&domain).expect("domain rep");
    assert_eq!(ga::dominant_grade(mv), 1, "traversal earns grade-1 reach");
    assert!(ga::grade_magnitude(mv, 1) > EPSILON);
}

#[test]
fn recompute_is_order_independent_for_traversals() {
    let kp = Keypair::generate();
    let domain = Uuid::new_v4();
    let a = traversal(&kp, domain, 0.9, 0.1, 0.0, 1.0, 1);
    let b = traversal(&kp, domain, 0.2, 0.7, 0.1, 2.0, 2);
    let c = traversal(&kp, domain, 0.0, 0.1, 0.9, 0.5, 3);

    let forward = recompute(&[a.clone(), b.clone(), c.clone()]);
    let shuffled = recompute(&[c, a, b]);

    assert_mv_eq(
        domain_rep(&forward, &kp.pubkey_hex()),
        domain_rep(&shuffled, &kp.pubkey_hex()),
    );
}

// ─── AC4 — cross-peer convergence incl. shuffled vouch chain ─

#[test]
fn vouch_chain_converges_under_shuffle() {
    let a = Keypair::generate();
    let b = Keypair::generate();
    let c = Keypair::generate();
    let domain = Uuid::new_v4();
    let from = [0.9, 0.1, 0.0];
    let to = [0.3, 0.4, 0.8];

    // A earns grade-1, then a chain A→B→C (created_at orders the propagation).
    let t = traversal(&a, domain, 0.9, 0.1, 0.0, 1.0, 1);
    let ab = vouch(&a, domain, &b.pubkey_hex(), from, to, 2);
    let bc = vouch(&b, domain, &c.pubkey_hex(), from, to, 3);

    let ordered = recompute(&[t.clone(), ab.clone(), bc.clone()]);
    // A different *arrival* order must still yield the identical result, because
    // recompute pins a global (created_at, id) sort over the stateful propagate.
    let shuffled = recompute(&[bc, t, ab]);

    // C only earns reach if B's A→B transfer was applied before B→C — the fixed
    // two-phase order guarantees that on every peer.
    let c_pk = c.pubkey_hex();
    assert!(
        ga::grade_magnitude(domain_rep(&ordered, &c_pk), 1) > EPSILON,
        "C earns propagated reach through the chain"
    );
    for pk in [a.pubkey_hex(), b.pubkey_hex(), c_pk] {
        assert_mv_eq(domain_rep(&ordered, &pk), domain_rep(&shuffled, &pk));
    }
}

// ─── AC5 — mutual-vouch grade collapse & forgery rejection ───

#[test]
fn mutual_vouch_ring_stays_grade_zero() {
    // N fake keys that sign ONLY mutual vouches (no real traversals) cannot
    // manufacture reputation: with no traversal grade-1 to transfer, propagation
    // moves nothing and every member stays grade 0. (The single-actor grade-3
    // fabrication via self-asserted *traversals* is an accepted POC risk, out of
    // this property's scope — SPEC-0010 §2.1/§4.)
    let domain = Uuid::new_v4();
    let from = [0.9, 0.1, 0.0];
    let to = [0.3, 0.4, 0.8];
    let keys: Vec<Keypair> = (0..4).map(|_| Keypair::generate()).collect();

    let mut events = Vec::new();
    let mut t = 1u64;
    for (i, k) in keys.iter().enumerate() {
        for (j, other) in keys.iter().enumerate() {
            if i != j {
                events.push(vouch(k, domain, &other.pubkey_hex(), from, to, t));
                t += 1;
            }
        }
    }

    // Non-vacuous: every vouch event is well-formed and passes the trust gate.
    assert!(!events.is_empty());
    assert!(events.iter().all(verify), "all ring vouches must verify");

    let reps = recompute(&events);
    for k in &keys {
        let grade = reps
            .get(&k.pubkey_hex())
            .map(WizardReputation::dominant_grade)
            .unwrap_or(0);
        assert_eq!(grade, 0, "mutual-vouch ring member must stay grade 0");
    }
}

#[test]
fn forging_another_wizards_event_fails_verify() {
    // The attacker knows the victim's pubkey but not the secret. They sign with
    // their own key, then swap in the victim's pubkey — verification fails.
    let victim = Keypair::generate();
    let attacker = Keypair::generate();
    let mut forged = traversal(&attacker, Uuid::new_v4(), 1.0, 0.0, 0.0, 5.0, 1);
    forged.pubkey = victim.pubkey_hex();
    assert!(
        !verify(&forged),
        "cannot forge authorship without the secret"
    );

    // And a forged event contributes nothing to recompute.
    let reps = recompute(&[forged]);
    assert!(reps.is_empty());
}

// ─── AC7 — discovery ranking from verified events ────────────

#[test]
fn rank_by_domain_orders_by_reach() {
    let domain = Uuid::new_v4();
    let deep = Keypair::generate();
    let shallow = Keypair::generate();

    // `deep` traverses with more depth ⇒ larger grade-1 reach.
    let mut events = vec![
        traversal(&deep, domain, 1.0, 0.0, 0.0, 5.0, 1),
        traversal(&shallow, domain, 1.0, 0.0, 0.0, 1.0, 2),
    ];
    // An unrelated domain traversal must not appear in this domain's ranking.
    let other = Keypair::generate();
    events.push(traversal(&other, Uuid::new_v4(), 1.0, 0.0, 0.0, 9.0, 3));

    let ranked = rank_by_domain(&events, domain, 10);
    assert_eq!(ranked.len(), 2, "only wizards with reach in this domain");
    assert_eq!(
        ranked[0].0,
        deep.pubkey_hex(),
        "deepest traverser ranks first"
    );
    assert_eq!(ranked[1].0, shallow.pubkey_hex());
    assert!(ranked[0].1 > ranked[1].1, "reach is descending");

    // top-k truncation
    let top1 = rank_by_domain(&events, domain, 1);
    assert_eq!(top1.len(), 1);
    assert_eq!(top1[0].0, deep.pubkey_hex());
}

// ─── R-0039 — paths are content, not reputation ──────────────

#[test]
fn kind_path_leaves_reputation_untouched() {
    let kp = Keypair::generate();
    let domain = Uuid::new_v4();
    let trav = traversal(&kp, domain, 0.9, 0.1, 0.0, 1.0, 1);
    let path_id = Uuid::new_v4();
    let content = serde_json::to_string(&PathDoc {
        id: path_id,
        title: "Path".into(),
        goal: "Goal".into(),
        steps: vec![Uuid::new_v4()],
        domains: vec![domain],
    })
    .expect("serialize path");
    let path = sign(&kp, KIND_PATH, vec![], &content, 2).expect("sign path");

    let without = recompute(&[trav.clone()]);
    let with = recompute(&[trav, path]);
    assert_eq!(without, with, "KIND_PATH must not change reputation");
}
