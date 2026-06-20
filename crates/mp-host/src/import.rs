//! Pure Obsidian-vault → knowledge-graph mapping (SPEC-0021 / R-0021).
//!
//! NO I/O lives here — `import.rs` takes already-read `RawNote`s and returns a
//! [`KnowledgeGraph`]; the filesystem walk + blob write are in `lib.rs`. Each
//! note becomes a plateau (name = stem, body = its Markdown, R-0020); each
//! `[[wikilink]]` that resolves to another note becomes a bridge; PDFs / external
//! links become resources; the note's GA position is a deterministic keyword
//! reading of its text. Ids are UUIDv5 over stable keys, so re-importing the same
//! vault yields identical ids (idempotent/convergent merge — R-0004).

use std::collections::HashMap;

use mp_domain::{Bridge, KnowledgeGraph, PlateauNode, Resource, ResourceKind};
use uuid::Uuid;

// Domain ids shared with the web app (apps/web/src/persona.js): e1 = Mathematics,
// e3 = Music, e2 = Physics (NEW — tagged here; first-class faced Physics domain is
// a later add, R-0022). The fog scorer is domain-agnostic (it projects against
// position), so the domain id is a grouping/orientation hint, not a reach gate.
pub const MATH_DOMAIN: Uuid = Uuid::from_u128(0x1111_1111_1111_1111_1111_1111_1111_1111);
pub const MUSIC_DOMAIN: Uuid = Uuid::from_u128(0x2222_2222_2222_2222_2222_2222_2222_2222);
pub const PHYSICS_DOMAIN: Uuid = Uuid::from_u128(0x3333_3333_3333_3333_3333_3333_3333_3333);

// Fixed namespace for all import-derived UUIDv5 ids.
const NS: Uuid = Uuid::from_u128(0x4d50_494d_504f_5254_0000_0000_0000_0001);

// Bilingual (ES/EN) keyword signal per concept-space axis. Substring match,
// case-insensitive — a deliberately simple, deterministic v1 heuristic (AI-assisted
// classification is R-0022). Tuned-later; the fixture pins the scoring.
const FORMAL: &[&str] = &[
    "algebra",
    "álgebra",
    "calcul",
    "cálculo",
    "theorem",
    "teorema",
    "proof",
    "demostrac",
    "matrix",
    "matriz",
    "vector",
    "function",
    "función",
    "integral",
    "derivative",
    "derivada",
    "conjunto",
    "logic",
    "lógic",
    "geometr",
    "linear",
    "lineal",
    "polynom",
    "polinom",
    "número",
    "monomio",
    "factoriz",
    "trigonom",
];
const PHYSICAL: &[&str] = &[
    "physic",
    "físic",
    "mechanic",
    "mecánic",
    "force",
    "fuerza",
    "energy",
    "energía",
    "motion",
    "movimiento",
    "mass",
    "masa",
    "quantum",
    "cuántic",
    "wave",
    "onda",
    "field",
    "campo",
    "momentum",
    "magnitud",
    "dimension",
    "dimensión",
    "velocity",
    "velocidad",
    "particle",
];
const CREATIVE: &[&str] = &[
    "music",
    "músic",
    "rhythm",
    "ritmo",
    "melody",
    "melodía",
    "harmony",
    "armonía",
    "chord",
    "acorde",
    "sound",
    "sonido",
    " art",
    "arte",
    "design",
    "diseño",
    "composition",
    "composic",
];

/// A note as read from disk: its path under the vault root, filename stem, and body.
#[derive(Debug, Clone)]
pub struct RawNote {
    pub rel_path: String,
    pub stem: String,
    pub body: String,
}

/// A wikilink target + label (`[[Target]]` / `[[Target|label]]`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Link {
    pub target_stem: String, // lowercased final-name stem, for name resolution
    pub label: String,
}

/// A media reference → a resource.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Media {
    Pdf { uri: String, title: String },
    External { uri: String, title: String },
}

/// A parsed note: its identity (rel_path/stem), title, body, and extracted
/// note-links + media. Pure output of [`parse_note`].
#[derive(Debug, Clone)]
pub struct ParsedNote {
    pub rel_path: String,
    pub stem: String,
    pub title: String,
    pub body: String,
    pub links: Vec<Link>,
    pub media: Vec<Media>,
}

/// Plateau identity = the note's RELATIVE PATH (lowercased, `.md` stripped,
/// separators normalised to `/`). Path-keyed so duplicate filenames across
/// folders never collapse into one plateau (SPEC-0021 §2.4, finding 2).
pub fn note_id(rel_path: &str) -> Uuid {
    Uuid::new_v5(&NS, path_key(rel_path).as_bytes())
}
fn bridge_id(from: Uuid, to: Uuid, label: &str) -> Uuid {
    Uuid::new_v5(&NS, format!("{from}|{to}|{label}").as_bytes())
}
fn resource_id(plateau: Uuid, uri: &str) -> Uuid {
    Uuid::new_v5(&NS, format!("{plateau}|{uri}").as_bytes())
}

fn path_key(rel_path: &str) -> String {
    rel_path
        .replace('\\', "/")
        .trim_end_matches(".md")
        .to_lowercase()
}

/// The lowercased final-name stem of a `[[target]]` (drops any folder prefix and
/// a trailing extension), for Obsidian-style by-name link resolution.
fn name_key(target: &str) -> String {
    let last = target.replace('\\', "/");
    let last = last.rsplit('/').next().unwrap_or(&last);
    let last = last.strip_suffix(".md").unwrap_or(last);
    last.trim().to_lowercase()
}

/// Parse a raw note into title/body/links/media. Pure; unit-tested directly (AC5).
pub fn parse_note(raw: &RawNote) -> ParsedNote {
    let mut links = Vec::new();
    let mut media = Vec::new();
    extract_wikilinks(&raw.body, &mut links, &mut media);
    extract_md_links(&raw.body, &mut media);
    extract_bare_urls(&raw.body, &mut media);
    ParsedNote {
        rel_path: raw.rel_path.clone(),
        stem: raw.stem.clone(),
        title: raw.stem.clone(),
        body: raw.body.clone(),
        links,
        media,
    }
}

/// `[[Target]]` / `[[Target|label]]` → a note-link, unless the target ends `.pdf`
/// (→ Pdf media) or the `[[` is an embed `![[…]]` (→ left in the body; images are
/// not resources in v1).
fn extract_wikilinks(body: &str, links: &mut Vec<Link>, media: &mut Vec<Media>) {
    let mut search = 0;
    while let Some(rel) = body[search..].find("[[") {
        let open = search + rel;
        let inner_start = open + 2;
        let Some(close_rel) = body[inner_start..].find("]]") else {
            break;
        };
        let inner = &body[inner_start..inner_start + close_rel];
        search = inner_start + close_rel + 2;

        let is_embed = open > 0 && body.as_bytes()[open - 1] == b'!';
        let (target, label) = match inner.split_once('|') {
            Some((t, l)) => (t.trim(), l.trim()),
            None => (inner.trim(), inner.trim()),
        };
        if target.to_lowercase().ends_with(".pdf") {
            media.push(Media::Pdf {
                uri: target.to_string(),
                title: if label.is_empty() {
                    target.to_string()
                } else {
                    label.to_string()
                },
            });
        } else if !is_embed {
            links.push(Link {
                target_stem: name_key(target),
                label: label.to_string(),
            });
        }
        // embedded non-pdf (`![[img.png]]`) → left in the body as-is
    }
}

/// `[text](url)` → External (http/https) or Pdf (`.pdf`). Image embeds `![](url)`
/// are skipped (left in the body). Only absolute http(s) / .pdf targets become
/// resources; relative links are body text.
fn extract_md_links(body: &str, media: &mut Vec<Media>) {
    let bytes = body.as_bytes();
    let mut search = 0;
    while let Some(rel) = body[search..].find("](") {
        let bracket = search + rel; // index of ']'
        search = bracket + 2;
        // Find the matching '[' just before, and that it's not an image embed '!['.
        let Some(open_sq) = body[..bracket].rfind('[') else {
            continue;
        };
        let is_embed = open_sq > 0 && bytes[open_sq - 1] == b'!';
        let text = &body[open_sq + 1..bracket];
        let Some(close_rel) = body[bracket + 2..].find(')') else {
            continue;
        };
        let url = body[bracket + 2..bracket + 2 + close_rel].trim();
        if is_embed {
            continue; // ![alt](img) — image, stays in body
        }
        push_media_for_url(url, text.trim(), media);
    }
}

/// Bare `http(s)://…` URLs (not already inside a markdown link) → External media.
fn extract_bare_urls(body: &str, media: &mut Vec<Media>) {
    for scheme in ["https://", "http://"] {
        let mut search = 0;
        while let Some(rel) = body[search..].find(scheme) {
            let start = search + rel;
            // Skip if immediately preceded by '(' (already captured by extract_md_links).
            let in_md_link = start > 0 && body.as_bytes()[start - 1] == b'(';
            let end = body[start..]
                .find(|c: char| c.is_whitespace() || c == ')' || c == ']')
                .map(|e| start + e)
                .unwrap_or(body.len());
            let url = &body[start..end];
            search = end;
            if !in_md_link {
                push_media_for_url(url, url, media);
            }
        }
    }
}

fn push_media_for_url(url: &str, title: &str, media: &mut Vec<Media>) {
    let lower = url.to_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return;
    }
    let title = if title.is_empty() { url } else { title };
    if lower.ends_with(".pdf") {
        media.push(Media::Pdf {
            uri: url.to_string(),
            title: title.to_string(),
        });
    } else {
        media.push(Media::External {
            uri: url.to_string(),
            title: title.to_string(),
        });
    }
}

/// Keyword-signal → a UNIT Grade-1 direction. The all-zero case short-circuits to
/// the formal axis `(1,0,0)` BEFORE any normalisation — a zero vector would
/// violate the Grade-1 invariant (SPEC-0021 §2.3, finding 1).
pub fn position_for(text: &str) -> (f32, f32, f32) {
    let lower = text.to_lowercase();
    let f = count_hits(&lower, FORMAL) as f32;
    let p = count_hits(&lower, PHYSICAL) as f32;
    let c = count_hits(&lower, CREATIVE) as f32;
    let len = (f * f + p * p + c * c).sqrt();
    if len < f32::EPSILON {
        return (1.0, 0.0, 0.0); // no signal → formal axis (non-zero, Grade-1)
    }
    (f / len, p / len, c / len)
}

fn count_hits(haystack: &str, keywords: &[&str]) -> usize {
    keywords.iter().map(|k| haystack.matches(k).count()).sum()
}

/// Dominant axis → domain id. Ties favour formal, then physical (deterministic).
pub fn domain_for(e1: f32, e2: f32, e3: f32) -> Uuid {
    if e1 >= e2 && e1 >= e3 {
        MATH_DOMAIN
    } else if e2 >= e3 {
        PHYSICS_DOMAIN
    } else {
        MUSIC_DOMAIN
    }
}

/// Build the knowledge graph from raw notes (pure). Notes → plateaus,
/// resolved `[[links]]` → bridges, media → resources. No I/O.
pub fn build_graph(notes: &[RawNote]) -> KnowledgeGraph {
    let parsed: Vec<ParsedNote> = notes.iter().map(parse_note).collect();

    // Plateau ids by relative path; a name→[id] map (path-sorted) for link
    // resolution by Obsidian-style note name.
    let mut by_name: HashMap<String, Vec<(String, Uuid)>> = HashMap::new();
    for n in &parsed {
        let id = note_id(&n.rel_path);
        by_name
            .entry(name_key(&n.stem))
            .or_default()
            .push((n.rel_path.clone(), id));
    }
    for v in by_name.values_mut() {
        v.sort(); // path-sorted → deterministic "first match" resolution
    }
    let resolve = |stem: &str| -> Option<Uuid> {
        by_name
            .get(&name_key(stem))
            .and_then(|v| v.first().map(|(_, id)| *id))
    };

    let mut g = KnowledgeGraph::new();

    // Plateaus.
    for n in &parsed {
        let (e1, e2, e3) = position_for(&format!("{} {}", n.title, n.body));
        let mut pl = PlateauNode::new(&n.title, domain_for(e1, e2, e3), e1, e2, e3)
            .with_description(&n.body);
        pl.id = note_id(&n.rel_path); // id override never touches the Grade-1 position
        g.add_plateau(pl);
    }

    // Bridges (resolved note-links only; skip self-links).
    for n in &parsed {
        let from = note_id(&n.rel_path);
        // Endpoints must exist; look up the constructed nodes for Bridge::between.
        for link in &n.links {
            let Some(to) = resolve(&link.target_stem) else {
                continue; // unresolved (e.g. an image) → no bridge
            };
            if to == from {
                continue; // self-link
            }
            let (Some(a), Some(b)) = (clone_node(&g, from), clone_node(&g, to)) else {
                continue;
            };
            let label = if link.label.is_empty() {
                &link.target_stem
            } else {
                &link.label
            };
            let mut br = Bridge::between(&a, &b, label, Uuid::nil());
            br.id = bridge_id(from, to, label);
            // Endpoints were added above; a construction-time invariant.
            let _ = g.add_bridge(br);
        }
    }

    // Resources (media), into the public `resources` map. Same plateau|uri dedups.
    for n in &parsed {
        let plateau = note_id(&n.rel_path);
        for m in &n.media {
            let (kind, uri, title) = match m {
                Media::Pdf { uri, title } => (ResourceKind::Paper, uri, title),
                Media::External { uri, title } => (kind_for_external(uri), uri, title),
            };
            let mut r = Resource::new(plateau, title, kind, uri, Uuid::nil());
            r.id = resource_id(plateau, uri);
            g.resources.insert(r.id, r); // dedups same (plateau, uri)
        }
    }

    g
}

fn kind_for_external(uri: &str) -> ResourceKind {
    let l = uri.to_lowercase();
    if l.contains("youtube.com") || l.contains("youtu.be") || l.contains("vimeo.com") {
        ResourceKind::Video
    } else {
        ResourceKind::Article
    }
}

/// Clone a plateau out of the graph by id (Bridge::between needs &PlateauNode for
/// both endpoints; the graph owns them).
fn clone_node(g: &KnowledgeGraph, id: Uuid) -> Option<PlateauNode> {
    g.plateaus().find(|p| p.id == id).cloned()
}
