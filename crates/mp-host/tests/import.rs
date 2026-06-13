//! Integration tests for the Obsidian importer (R-0021 / SPEC-0021). Covers the
//! pure mapping (parse / position / build) and the end-to-end `import` over a
//! fixture vault on disk, plus idempotency. Run: `cargo test -p mp-host`.

use std::path::Path;

use mp_crdt::CrdtDoc;
use mp_host::import::{
    build_graph, note_id, parse_note, position_for, Media, RawNote, MATH_DOMAIN, MUSIC_DOMAIN,
    PHYSICS_DOMAIN,
};

fn vault() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vault")
}

fn raw(rel: &str, stem: &str, body: &str) -> RawNote {
    RawNote {
        rel_path: rel.into(),
        stem: stem.into(),
        body: body.into(),
    }
}

// ── Pure: parsing ───────────────────────────────────────────────────────────

#[test]
fn parse_note_extracts_links_and_media_but_not_embeds() {
    let n = parse_note(&raw(
        "T.md",
        "T",
        "Link [[Alpha]] and [[Beta|the beta]] and an embed ![[pic.png]].\n\
         A [paper](https://ex.com/file.pdf), a [clip](https://youtube.com/watch?v=z), \
         and a bare https://bare.example/x url.",
    ));

    // [[Alpha]] / [[Beta|label]] become links; the image embed does NOT.
    let targets: Vec<&str> = n.links.iter().map(|l| l.target_stem.as_str()).collect();
    assert_eq!(
        targets,
        vec!["alpha", "beta"],
        "wikilinks → links, embed excluded"
    );
    assert_eq!(n.links[1].label, "the beta", "alias becomes the label");

    // Media: a pdf, a youtube video, and a bare external link (the image is NOT media).
    assert_eq!(n.media.len(), 3, "pdf + youtube + bare url");
    assert!(matches!(&n.media[0], Media::Pdf { uri, .. } if uri == "https://ex.com/file.pdf"));
    assert!(
        matches!(&n.media[1], Media::External { uri, .. } if uri.contains("youtube.com")),
        "youtube → external (classified Video at build time)"
    );
    assert!(matches!(&n.media[2], Media::External { uri, .. } if uri == "https://bare.example/x"));
}

#[test]
fn pdf_wikilink_is_media_not_a_bridge() {
    let n = parse_note(&raw("T.md", "T", "See [[handout.pdf]] and [[RealNote]]."));
    assert_eq!(n.links.len(), 1, "only the real note is a link");
    assert_eq!(n.links[0].target_stem, "realnote");
    assert!(matches!(&n.media[0], Media::Pdf { uri, .. } if uri == "handout.pdf"));
}

// ── Pure: positioning ─────────────────────────────────────────────────────────

#[test]
fn position_for_picks_the_dominant_axis() {
    let (f1, f2, f3) = position_for("derivative integral theorem function algebra");
    assert!(f1 > f2 && f1 > f3, "formal text → e1 dominant");

    let (p1, p2, p3) = position_for("force energy mass motion physics");
    assert!(p2 > p1 && p2 > p3, "physical text → e2 dominant");

    let (c1, c2, c3) = position_for("music melody harmony chord sound");
    assert!(c3 > c1 && c3 > c2, "creative text → e3 dominant");

    // No signal → the formal axis (1,0,0), a valid non-zero Grade-1 vector.
    assert_eq!(position_for("just a placeholder"), (1.0, 0.0, 0.0));

    // The returned vector is unit length (normalised).
    let n = (f1 * f1 + f2 * f2 + f3 * f3).sqrt();
    assert!((n - 1.0).abs() < 1e-5, "position is normalised");
}

// ── Pure: deterministic ids ───────────────────────────────────────────────────

#[test]
fn domain_ids_match_the_web_app_literals() {
    // Cross-crate contract (R-0022): apps/web/src/persona.js pins these same
    // literals in persona.test.mjs. Either side drifting fails its own suite.
    assert_eq!(
        MATH_DOMAIN.to_string(),
        "11111111-1111-1111-1111-111111111111"
    );
    assert_eq!(
        MUSIC_DOMAIN.to_string(),
        "22222222-2222-2222-2222-222222222222"
    );
    assert_eq!(
        PHYSICS_DOMAIN.to_string(),
        "33333333-3333-3333-3333-333333333333"
    );
}

#[test]
fn note_id_is_deterministic_and_path_keyed() {
    assert_eq!(
        note_id("Calculus.md"),
        note_id("calculus.md"),
        "case-insensitive, stable"
    );
    assert_ne!(
        note_id("Calculus.md"),
        note_id("sub/Calculus.md"),
        "duplicate stems in different folders are DISTINCT plateaus"
    );
}

// ── Pure: building the graph ──────────────────────────────────────────────────

#[test]
fn build_graph_maps_notes_links_and_media() {
    let notes = vec![
        raw(
            "Calculus.md",
            "Calculus",
            "Derivative & integral. See [[Limits]] and [[Ghost]].",
        ),
        raw("Limits.md", "Limits", "A function and its limit."),
    ];
    let g = build_graph(&notes);

    assert_eq!(g.plateaus().count(), 2);
    // [[Limits]] resolves → a bridge; [[Ghost]] does not → no bridge.
    assert_eq!(
        g.bridges().count(),
        1,
        "only the resolvable link becomes a bridge"
    );
    let b = g.bridges().next().unwrap();
    assert_eq!(b.from, note_id("Calculus.md"));
    assert_eq!(b.to, note_id("Limits.md"));

    // The body is carried onto the plateau (R-0020 substrate).
    let calc = g
        .plateaus()
        .find(|p| p.id == note_id("Calculus.md"))
        .unwrap();
    assert!(
        calc.description.contains("Derivative"),
        "note body becomes the plateau body"
    );
}

#[test]
fn same_uri_on_a_plateau_dedups() {
    // The same URL cited twice in one note collapses to one resource (id = plateau|uri).
    let g = build_graph(&[raw(
        "N.md",
        "N",
        "[a](https://ex.com/x) and again [b](https://ex.com/x).",
    )]);
    assert_eq!(g.resources.len(), 1, "same (plateau,uri) → one resource");
}

// ── End-to-end: import the fixture vault from disk ────────────────────────────

#[test]
fn import_fixture_vault_round_trips() {
    let tmp = tempfile::tempdir().expect("tmp");
    let out = tmp.path().join("world.bin");

    let stats = mp_host::import(&vault(), &out).expect("import");
    // 6 .md notes (Calculus, Limits, Mechanics, Rhythm, Stub, sub/Calculus);
    // notes.txt + .obsidian/ are ignored.
    assert_eq!(
        stats.notes, 6,
        "only *.md become plateaus; non-md + dotdirs skipped"
    );
    // Bridges: Calculus→Limits, Calculus→Mechanics, Mechanics→Calculus.
    assert_eq!(stats.bridges, 3);
    // Resources on Calculus: handout.pdf, Khan article, youtube video.
    assert_eq!(stats.resources, 3);

    // Reload the blob and assert the graph is real.
    let bytes = std::fs::read(&out).expect("read blob");
    let g = CrdtDoc::load(&bytes)
        .expect("load")
        .to_graph()
        .expect("project");
    assert_eq!(g.plateaus().count(), 6);

    // Domains by dominant axis.
    let domain = |path: &str| {
        g.plateaus()
            .find(|p| p.id == note_id(path))
            .unwrap()
            .domain_id
    };
    assert_eq!(domain("Calculus.md"), MATH_DOMAIN, "Calculus → formal/Math");
    assert_eq!(
        domain("Mechanics.md"),
        PHYSICS_DOMAIN,
        "Mechanics → physical/Physics"
    );
    assert_eq!(domain("Rhythm.md"), MUSIC_DOMAIN, "Rhythm → creative/Music");
    assert_eq!(
        domain("Stub.md"),
        MATH_DOMAIN,
        "no-signal note → formal-axis fallback"
    );

    // The two Calculus notes are distinct plateaus (path-keyed).
    assert!(g.plateaus().any(|p| p.id == note_id("Calculus.md")));
    assert!(g.plateaus().any(|p| p.id == note_id("sub/Calculus.md")));

    // A youtube resource was classified Video.
    use mp_domain::ResourceKind;
    assert!(
        g.resources
            .values()
            .any(|r| matches!(r.kind, ResourceKind::Video)),
        "youtube link → Video resource"
    );
}

#[test]
fn import_is_idempotent_merging_twice_does_not_double() {
    let tmp = tempfile::tempdir().expect("tmp");
    let a = tmp.path().join("a.bin");
    let b = tmp.path().join("b.bin");
    mp_host::import(&vault(), &a).expect("import a");
    mp_host::import(&vault(), &b).expect("import b");

    // Merge both imports into one doc — stable v5 ids ⇒ no duplication (R-0004).
    let mut doc = CrdtDoc::load(&std::fs::read(&a).unwrap()).expect("load a");
    let mut other = CrdtDoc::load(&std::fs::read(&b).unwrap()).expect("load b");
    doc.merge(&mut other).expect("merge");

    let g = doc.to_graph().expect("project");
    assert_eq!(
        g.plateaus().count(),
        6,
        "re-import merges to the same 6 plateaus, not 12"
    );
    assert_eq!(g.bridges().count(), 3);
    assert_eq!(g.resources.len(), 3);
}
