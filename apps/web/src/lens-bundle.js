// lens-bundle.js — a lens as a portable, publishable subgraph (R-0093). Pure.
//
// The whole-world snapshot (R-0081) syncs YOUR devices as one CRDT. A LENS bundle
// is the *shareable* unit: one domain (a way of seeing) plus every plateau under
// it, the bridges among those plateaus, and their resources, serialized to one
// self-contained JSON file. Publish it to a repo; anyone can adopt it and it seeds
// into their own graph (by stable id). This is the file-partitioned layer: one
// file per lens, independent of the monolithic world snapshot, so a "University
// Physics" lens can travel on its own and be pulled into any world.
//
// Design note — ids (R-0093a). Plateau ids are real UUIDs and stay stable, so we
// carry them verbatim. Bridge/resource ids in a live graph are *random* (minted by
// add_bridge/add_resource), which would make a bundle depend on internal churn:
// delete and recreate the same bridge and its id changes, so a re-publish would
// seed a duplicate on every adopter. Instead we SYNTHESIZE each bridge/resource id
// from its content. A bundle is then a pure function of what the lens *contains*:
// re-adopting is idempotent, and two people exporting the same content agree.
//
// Three properties that scheme must have, each learned the hard way:
//   1. UUID-shaped. The Rust seed_plateau/seed_bridge/seed_resource each parse
//      every id with `Uuid::parse_str`, so a `b-<hash>` token throws at adopt time.
//   2. NAMESPACED by kind. Hashing bare fields put bridges and resources in one id
//      space, where `{from:A,to:B,concept:""}` and `{plateau:A,uri:B,title:""}`
//      collided exactly. Each kind now hashes under its own prefix.
//   3. Written with an ESCAPED separator. The field separator used to be a raw
//      control byte pasted into the source; any reformatting or re-encode would
//      have silently re-minted every id in the ecosystem. It is `"\u001f"` now,
//      and `contentUuid` has a golden-vector test so a change fails loudly.
// These ids are the join key R-0094's registry and R-0095's query layer will index
// on, so the scheme is fixed here, before anything is published against it.

export const LENS_DIR = "lenses";
export const LENS_BUNDLE_V = 1;

// ASCII unit separator — an unambiguous field boundary that cannot occur in a
// UUID, URI, or title. Written as an escape ON PURPOSE: see design note (3).
const SEP = "\u001f";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Path for a lens bundle inside the sync repo. Sanitized so a hostile/oddly-named
// domain id can never escape the lenses/ directory or the contents API path.
export function lensBundlePath(domainId) {
  const id = String(domainId == null ? "" : domainId).replace(/[^A-Za-z0-9._-]/g, "");
  return `${LENS_DIR}/${id || "lens"}.json`;
}

// Guard for a path a REMOTE repo declared (a directory listing, or later a
// registry index a stranger authored): it must stay inside lenses/ and may not
// climb. Cheap, and the registry will lean on it.
export function isSafeLensPath(path) {
  const p = String(path == null ? "" : path);
  if (!p.startsWith(`${LENS_DIR}/`)) return false;
  return !p.split("/").includes("..") && !p.includes("\\");
}

// murmur3 finalizer — avalanches a 32-bit accumulator so single-bit input changes
// spread across the whole word. Without it the raw multiply-accumulate lanes leave
// the low bits barely mixed.
function fmix32(h) {
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministic, content-addressed UUID. `kind` namespaces the digest so two
 * different sorts of thing can never share an id. Four accumulator lanes are
 * advanced over the input, finalized, then cross-mixed, giving 128 bits that are
 * stamped into canonical 8-4-4-4-12 form with the RFC-4122 version/variant nibbles
 * so `Uuid::parse_str` accepts it.
 *
 * NOT cryptographic and NOT an RFC-4122 v5 (which is SHA-1 over namespace‖name) —
 * it borrows only v5's shape. It has to be a stable, well-distributed function of
 * the content, which it is; it is not a defence against a deliberate collision.
 */
export function contentUuid(kind, ...parts) {
  const s = [String(kind), ...parts.map((p) => String(p))].join(SEP);
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 5381, d = 0x85ebca6b;
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    a = Math.imul(a ^ k, 0x01000193) >>> 0;
    b = Math.imul(b + k, 0x85ebca6b) >>> 0;
    c = (Math.imul(c, 33) + k) >>> 0;
    d = Math.imul(d ^ k, 0xc2b2ae35) >>> 0;
  }
  // finalize each lane, then cross-mix so every lane depends on every other
  a = fmix32(a); b = fmix32(b); c = fmix32(c); d = fmix32(d);
  a = fmix32((a ^ d) >>> 0); b = fmix32((b ^ a) >>> 0);
  c = fmix32((c ^ b) >>> 0); d = fmix32((d ^ c) >>> 0);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const h = (hex(a) + hex(b) + hex(c) + hex(d)).split("");
  h[12] = "5"; // version nibble
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16); // variant 10xx
  const j = h.join("");
  return `${j.slice(0, 8)}-${j.slice(8, 12)}-${j.slice(12, 16)}-${j.slice(16, 20)}-${j.slice(20, 32)}`;
}

const num = (v) => (Number.isFinite(v) ? v : 0);
const str = (v) => (v == null ? "" : String(v));
const byId = (x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/**
 * Build a lens bundle from the full graph arrays. Keeps:
 *   - plateaus whose domain_id === domain.id (the lens membership)
 *   - bridges BOTH of whose ends are in the lens → `bridges` (seedable)
 *   - bridges with exactly ONE end in the lens  → `external_bridges` (see below)
 *   - resources anchored to an in-lens plateau
 * Deterministic and pure — same content → byte-identical output (stable order).
 *
 * `external_bridges` exist because a cross-lens edge is the most valuable thing in
 * this model — the meet between two ways of seeing (RFC-0002's domain-as-bivector
 * overlap). Seeding one is impossible for a reader who lacks the far endpoint, so
 * `applyLensBundle` deliberately does not, but dropping them from the FILE would
 * destroy them permanently for every adopter. They ride along as data for R-0094
 * and R-0095 to reconnect once both lenses are present.
 *
 * @param domain    {id,label,canonical:{e1,e2,e3}} — the lens itself
 * @param plateaus  graph.plateaus()  — [{id,name,description,domain_id,position}]
 * @param bridges   graph.bridges()   — [{id,from,to,concept}]
 * @param resources graph.resources() — [{id,plateau_id,title,kind,uri}]
 * @param meta      optional {title, author, note} provenance
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
    .sort(byId);

  const seenBridge = new Set();
  const outBridges = [];
  const outExternal = [];
  for (const b of Array.isArray(bridges) ? bridges : []) {
    if (!b) continue;
    const from = str(b.from);
    const to = str(b.to);
    const hasFrom = memberIds.has(from);
    const hasTo = memberIds.has(to);
    if (!hasFrom && !hasTo) continue; // nothing to do with this lens
    const concept = str(b.concept);
    const id = contentUuid("mp:bridge:1", from, to, concept);
    if (seenBridge.has(id)) continue; // fold exact-duplicate edges
    seenBridge.add(id);
    (hasFrom && hasTo ? outBridges : outExternal).push({ id, from, to, concept });
  }
  outBridges.sort(byId);
  outExternal.sort(byId);

  const seenRes = new Set();
  const outResources = [];
  for (const r of Array.isArray(resources) ? resources : []) {
    if (!r || !memberIds.has(r.plateau_id)) continue;
    const plateau_id = str(r.plateau_id);
    const title = str(r.title);
    const uri = str(r.uri);
    const id = contentUuid("mp:resource:1", plateau_id, uri, title);
    if (seenRes.has(id)) continue;
    seenRes.add(id);
    outResources.push({ id, plateau_id, title, kind: str(r.kind) || "Link", uri });
  }
  outResources.sort(byId);

  return canonicalBundle({
    v: LENS_BUNDLE_V,
    domain: {
      id: str(dom.id),
      label: str(dom.label) || str(dom.id),
      canonical: { e1: num(canon.e1), e2: num(canon.e2), e3: num(canon.e3) },
    },
    plateaus: outPlateaus,
    bridges: outBridges,
    external_bridges: outExternal,
    resources: outResources,
    title: str(meta.title).trim(),
    author: str(meta.author).trim(),
    note: str(meta.note).trim(),
  });
}

/**
 * The ONE canonical shape, emitted by both build and parse, with a stable key
 * order. Anything that re-emits a bundle (a registry caching it, a digest, a
 * signature) must get back the bytes it read — so build and parse may not differ
 * in which keys are present. Optional provenance is omitted when blank, and
 * `counts` is always derived here rather than trusted from the file.
 */
function canonicalBundle(b) {
  const out = {
    v: b.v,
    domain: b.domain,
    plateaus: b.plateaus,
    bridges: b.bridges,
    external_bridges: b.external_bridges,
    resources: b.resources,
    counts: {
      plateaus: b.plateaus.length,
      bridges: b.bridges.length,
      external_bridges: b.external_bridges.length,
      resources: b.resources.length,
    },
  };
  if (b.title) out.title = b.title;
  if (b.author) out.author = b.author;
  if (b.note) out.note = b.note;
  return out;
}

/** Serialize a bundle to its canonical bytes — the input to any digest/signature. */
export function canonicalJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parse + FULLY VALIDATE a bundle. Returns a canonical bundle, or null if it is
 * not one we can safely seed.
 *
 * This is deliberately strict, because `applyLensBundle` mutates a live CRDT row
 * by row and cannot roll back: anything that would make the Rust side throw
 * mid-loop (a non-UUID id, a bridge pointing at a plateau the bundle never
 * defines) has to be rejected HERE, while rejecting is still free. Everything that
 * survives this function is seedable without throwing.
 *
 * A bundle from a FUTURE schema version is refused rather than half-read — see
 * the `tooNew` flag on the returned null-substitute so the UI can say "this lens
 * needs a newer version of the app" instead of "not a valid bundle".
 */
export function parseLensBundle(input) {
  let b;
  try {
    b = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return null;
  }
  if (!b || typeof b !== "object") return null;
  if (Number.isFinite(b.v) && b.v > LENS_BUNDLE_V) return null; // too new — see parseLensBundleResult
  if (!b.domain || typeof b.domain !== "object") return null;
  const domainId = str(b.domain.id);
  if (!UUID_RE.test(domainId)) return null; // seed_plateau parses this as a Uuid
  if (!Array.isArray(b.plateaus)) return null;

  const canon = b.domain.canonical || {};
  const plateaus = [];
  const ids = new Set();
  for (const p of b.plateaus) {
    if (!p || !UUID_RE.test(str(p.id)) || ids.has(str(p.id))) continue;
    ids.add(str(p.id));
    // accept the bundle shape {e1,e2,e3} AND the raw graph shape {position:{…}}
    const pos = p.position && typeof p.position === "object" ? p.position : p;
    plateaus.push({
      id: str(p.id),
      name: str(p.name),
      description: str(p.description),
      e1: num(pos.e1),
      e2: num(pos.e2),
      e3: num(pos.e3),
    });
  }
  plateaus.sort(byId);

  // an edge may only reference plateaus this bundle actually defines
  const edge = (x) =>
    x && UUID_RE.test(str(x.id)) && ids.has(str(x.from)) && ids.has(str(x.to));
  const bridges = (Array.isArray(b.bridges) ? b.bridges : [])
    .filter(edge)
    .map((x) => ({ id: str(x.id), from: str(x.from), to: str(x.to), concept: str(x.concept) }))
    .sort(byId);
  // external edges keep exactly one foot in the lens; they are carried, not seeded
  const external_bridges = (Array.isArray(b.external_bridges) ? b.external_bridges : [])
    .filter((x) => x && UUID_RE.test(str(x.id)) && UUID_RE.test(str(x.from)) && UUID_RE.test(str(x.to)))
    .filter((x) => ids.has(str(x.from)) !== ids.has(str(x.to)))
    .map((x) => ({ id: str(x.id), from: str(x.from), to: str(x.to), concept: str(x.concept) }))
    .sort(byId);
  const resources = (Array.isArray(b.resources) ? b.resources : [])
    .filter((x) => x && UUID_RE.test(str(x.id)) && ids.has(str(x.plateau_id)))
    .map((x) => ({
      id: str(x.id),
      plateau_id: str(x.plateau_id),
      title: str(x.title),
      kind: str(x.kind) || "Link",
      uri: str(x.uri),
    }))
    .sort(byId);

  return canonicalBundle({
    v: LENS_BUNDLE_V,
    domain: {
      id: domainId,
      label: str(b.domain.label) || domainId,
      canonical: { e1: num(canon.e1), e2: num(canon.e2), e3: num(canon.e3) },
    },
    plateaus,
    bridges,
    external_bridges,
    resources,
    title: str(b.title).trim(),
    author: str(b.author).trim(),
    note: str(b.note).trim(),
  });
}

/**
 * Why a bundle was rejected — so the UI can tell "written by a newer app" apart
 * from "corrupt". Returns {bundle} | {error:"too-new"} | {error:"invalid"}.
 */
export function parseLensBundleResult(input) {
  let raw;
  try {
    raw = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return { error: "invalid" };
  }
  if (raw && typeof raw === "object" && Number.isFinite(raw.v) && raw.v > LENS_BUNDLE_V)
    return { error: "too-new", v: raw.v };
  const bundle = parseLensBundle(raw);
  return bundle ? { bundle } : { error: "invalid" };
}

/**
 * Apply a bundle by seeding it into a doc. Dependency-injected so it is pure to
 * test: `seeders` supplies plateau/bridge/resource callbacks (in production these
 * wrap doc.seed_plateau / seed_bridge / seed_resource).
 *
 * ADOPTING NEVER OVERWRITES. The underlying `seed_*` are last-writer-wins upserts,
 * and the built-in lenses use fixed plateau ids that every install shares — so a
 * naive re-seed would let a publisher's copy of "Arithmetic" clobber the reader's
 * name, description and position. `seeders.has(kind, id)` (optional) is consulted
 * first and anything already present is skipped, making adoption purely additive,
 * which is what R-0093 AC5 promises.
 *
 * Order: all plateaus before any bridge/resource (the seed API rejects an endpoint
 * that does not exist yet), and the domain LAST — if anything throws, no empty
 * orphan lens is stranded in the reader's picker. `external_bridges` are never
 * seeded: their far endpoint is by definition outside this lens.
 *
 * Returns {plateaus,bridges,resources} = how many were newly SEEDED (skipped
 * pre-existing rows are not counted).
 */
export function applyLensBundle(bundle, seeders) {
  const b = parseLensBundle(bundle);
  if (!b) throw new Error("applyLensBundle: not a valid lens bundle");
  const s = seeders || {};
  const has = typeof s.has === "function" ? s.has : () => false;
  const n = { plateaus: 0, bridges: 0, resources: 0 };

  for (const p of b.plateaus) {
    if (has("plateau", p.id)) continue;
    s.plateau?.(p.id, p.name, b.domain.id, p.e1, p.e2, p.e3, p.description);
    n.plateaus++;
  }
  for (const br of b.bridges) {
    if (has("bridge", br.id)) continue;
    s.bridge?.(br.id, br.from, br.to, br.concept);
    n.bridges++;
  }
  for (const r of b.resources) {
    if (has("resource", r.id)) continue;
    s.resource?.(r.id, r.plateau_id, r.title, r.kind, r.uri);
    n.resources++;
  }
  if (typeof s.onDomain === "function") {
    s.onDomain({ id: b.domain.id, label: b.domain.label, canonical: b.domain.canonical });
  }
  return n;
}
