// lens-bundle.js — a lens as a portable, publishable subgraph (R-0093). Pure.
//
// The whole-world snapshot (R-0081) syncs YOUR devices as one CRDT. A LENS bundle
// is the *shareable* unit: one domain (a way of seeing) plus every plateau under
// it, the bridges among those plateaus, and their resources — serialized to one
// self-contained JSON file. Publish it to a repo; anyone can adopt it and it seeds
// idempotently into their own graph (by stable id). This is the file-partitioned
// layer: one file per lens, independent of the monolithic world snapshot, so a
// "University Physics" lens can travel on its own and be pulled into any world.
//
// Design note — ids. Plateau ids are real UUIDs and stay stable, so we carry them
// verbatim. Bridge/resource ids in a live graph are *random* (minted by add_bridge/
// add_resource), which would make a bundle depend on internal churn: delete and
// recreate the same bridge and its id changes, so a re-publish would seed a
// duplicate on every adopter. Instead we SYNTHESIZE each bridge/resource id from
// its content (endpoints+concept, plateau+uri+title). A bundle is then a pure
// function of what the lens *contains*: re-adopting is idempotent, and two people
// exporting the same content get the same ids. seed_bridge/seed_resource are
// keyed by id, so re-seeding a synthesized id is a no-op — exactly what we want.
//
// The synthesized id MUST be a valid UUID: the Rust seed_plateau/seed_bridge/
// seed_resource each parse every id with `Uuid::parse_str`, so a `b-<hash>` shape
// throws at adopt time. `contentUuid` therefore emits a canonical v5-style UUID
// (name-based, deterministic) rather than a bare token — content-addressed AND
// seed-compatible.

export const LENS_DIR = "lenses";
export const LENS_BUNDLE_V = 1;

// Path for a lens bundle inside the sync repo. Sanitized so a hostile/oddly-named
// domain id can never escape the lenses/ directory or the contents API path.
export function lensBundlePath(domainId) {
  const id = String(domainId == null ? "" : domainId).replace(/[^A-Za-z0-9._-]/g, "");
  return `${LENS_DIR}/${id || "lens"}.json`;
}

// Deterministic, name-based UUID from content — the same inputs always give the
// same id, and the id is a well-formed UUID so `Uuid::parse_str` in the Rust seed
// API accepts it. Four decorrelated 32-bit rolling hashes supply the 128 bits;
// the version (5) and variant nibbles are then stamped into canonical 8-4-4-4-12
// form. Not cryptographic — it only has to be a stable function of the content
// with a vanishing collision rate across the edges one lens holds, and it is.
function contentUuid(...parts) {
  const s = parts.join(""); // unit-separator: unambiguous field boundary
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 5381, d = 0x85ebca6b;
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    a = Math.imul(a ^ k, 0x01000193) >>> 0;
    b = Math.imul(b + k, 0x85ebca6b) >>> 0;
    c = (Math.imul(c, 33) + k) >>> 0;
    d = Math.imul(d ^ k, 0xc2b2ae35) >>> 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const h = (hex(a) + hex(b) + hex(c) + hex(d)).split("");
  h[12] = "5"; // version 5 (name-based)
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16); // variant 10xx
  const j = h.join("");
  return `${j.slice(0, 8)}-${j.slice(8, 12)}-${j.slice(12, 16)}-${j.slice(16, 20)}-${j.slice(20, 32)}`;
}

const num = (v) => (Number.isFinite(v) ? v : 0);
const str = (v) => (v == null ? "" : String(v));

/**
 * Build a lens bundle from the full graph arrays. Keeps only:
 *   - plateaus whose domain_id === domain.id (the lens membership)
 *   - bridges BOTH of whose endpoints are in the lens (no dangling edges)
 *   - resources anchored to an in-lens plateau
 * Deterministic and pure — same input → byte-identical output (stable key order).
 *
 * @param domain    {id, label, canonical:{e1,e2,e3}, ...} — the lens itself
 * @param plateaus  graph.plateaus() — [{id,name,description,domain_id,position:{e1,e2,e3}}]
 * @param bridges   graph.bridges()  — [{id,from,to,concept}]
 * @param resources graph.resources()— [{id,plateau_id,title,kind,uri}]
 * @param meta      optional {author, title, note} provenance (author-supplied)
 */
export function buildLensBundle(domain, plateaus, bridges, resources, meta = {}) {
  const dom = domain || {};
  if (!dom.id) throw new Error("buildLensBundle: domain.id is required");
  const canon = dom.canonical || {};

  const mine = (Array.isArray(plateaus) ? plateaus : []).filter(
    (p) => p && p.domain_id === dom.id,
  );
  const memberIds = new Set(mine.map((p) => p.id));

  const outPlateaus = mine
    .map((p) => ({
      id: str(p.id),
      name: str(p.name),
      description: str(p.description),
      e1: num(p.position?.e1),
      e2: num(p.position?.e2),
      e3: num(p.position?.e3),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const seenBridge = new Set();
  const outBridges = [];
  for (const b of Array.isArray(bridges) ? bridges : []) {
    if (!b || !memberIds.has(b.from) || !memberIds.has(b.to)) continue;
    const concept = str(b.concept);
    const id = contentUuid(str(b.from), str(b.to), concept);
    if (seenBridge.has(id)) continue; // fold exact-duplicate edges
    seenBridge.add(id);
    outBridges.push({ id, from: str(b.from), to: str(b.to), concept });
  }
  outBridges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const seenRes = new Set();
  const outResources = [];
  for (const r of Array.isArray(resources) ? resources : []) {
    if (!r || !memberIds.has(r.plateau_id)) continue;
    const title = str(r.title);
    const uri = str(r.uri);
    const id = contentUuid(str(r.plateau_id), uri, title);
    if (seenRes.has(id)) continue;
    seenRes.add(id);
    outResources.push({
      id,
      plateau_id: str(r.plateau_id),
      title,
      kind: str(r.kind) || "Link",
      uri,
    });
  }
  outResources.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const bundle = {
    v: LENS_BUNDLE_V,
    domain: {
      id: str(dom.id),
      label: str(dom.label) || str(dom.id),
      canonical: { e1: num(canon.e1), e2: num(canon.e2), e3: num(canon.e3) },
    },
    plateaus: outPlateaus,
    bridges: outBridges,
    resources: outResources,
    counts: {
      plateaus: outPlateaus.length,
      bridges: outBridges.length,
      resources: outResources.length,
    },
  };
  // Optional provenance — only include keys the author actually supplied, so an
  // anonymous export stays free of empty fields.
  const title = str(meta.title).trim();
  const author = str(meta.author).trim();
  const note = str(meta.note).trim();
  if (title) bundle.title = title;
  if (author) bundle.author = author;
  if (note) bundle.note = note;
  return bundle;
}

/**
 * Parse + validate a bundle from JSON text (or an already-parsed object).
 * Returns a normalized bundle, or null if it is missing the shape we need to seed
 * a lens. Tolerant of missing optional arrays; strict about the domain identity.
 */
export function parseLensBundle(input) {
  let b;
  try {
    b = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return null;
  }
  if (!b || typeof b !== "object") return null;
  if (!b.domain || typeof b.domain !== "object" || !b.domain.id) return null;
  if (!Array.isArray(b.plateaus)) return null;
  const canon = b.domain.canonical || {};
  return {
    v: Number.isFinite(b.v) ? b.v : LENS_BUNDLE_V,
    domain: {
      id: str(b.domain.id),
      label: str(b.domain.label) || str(b.domain.id),
      canonical: { e1: num(canon.e1), e2: num(canon.e2), e3: num(canon.e3) },
    },
    plateaus: b.plateaus.filter((p) => p && p.id),
    bridges: (Array.isArray(b.bridges) ? b.bridges : []).filter(
      (x) => x && x.id && x.from && x.to,
    ),
    resources: (Array.isArray(b.resources) ? b.resources : []).filter(
      (x) => x && x.id && x.plateau_id,
    ),
    title: str(b.title),
    author: str(b.author),
    note: str(b.note),
  };
}

/**
 * Apply a bundle by seeding it into a doc, idempotently. Dependency-injected so it
 * is pure to test: `seeders` supplies plateau/bridge/resource seed callbacks (in
 * production these wrap doc.seed_plateau / seed_bridge / seed_resource, all keyed
 * by id, so a second apply is a no-op). Also registers the domain as a local lens
 * via `onDomain` (custom domains live in localStorage, not the CRDT).
 *
 * Order matters twice over. Plateaus seed BEFORE bridges/resources, because the
 * Rust seed_bridge/seed_resource reject an endpoint that does not exist yet. And
 * the domain registers LAST: if any seed throws (a malformed bundle, a bad id),
 * an already-registered domain would strand an empty orphan lens in the picker
 * that the reader never asked for and cannot easily clear.
 */
export function applyLensBundle(bundle, seeders) {
  const b = parseLensBundle(bundle);
  if (!b) throw new Error("applyLensBundle: not a valid lens bundle");
  const s = seeders || {};
  for (const p of b.plateaus) {
    s.plateau?.(p.id, p.name, b.domain.id, num(p.e1), num(p.e2), num(p.e3), str(p.description));
  }
  for (const br of b.bridges) {
    s.bridge?.(br.id, br.from, br.to, str(br.concept));
  }
  for (const r of b.resources) {
    s.resource?.(r.id, r.plateau_id, str(r.title), str(r.kind) || "Link", str(r.uri));
  }
  if (typeof s.onDomain === "function") {
    s.onDomain({ id: b.domain.id, label: b.domain.label, canonical: b.domain.canonical });
  }
  return { plateaus: b.plateaus.length, bridges: b.bridges.length, resources: b.resources.length };
}
