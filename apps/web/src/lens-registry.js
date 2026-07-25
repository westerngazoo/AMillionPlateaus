// lens-registry.js — an index so lenses can be DISCOVERED, not just fetched (R-0094). Pure.
//
// R-0093 made a lens a portable file (`lenses/<id>.json`) and R-0093a hardened it.
// But adopting still required knowing a repo URL, and listing one meant fetching
// EVERY bundle in the folder to learn its title and size — N requests, serial,
// rate-limit-prone, with no way to see what a lens holds before pulling it.
//
// This adds `lenses/index.json`: one small file describing what a repo publishes.
// Listing becomes ONE fetch; the bundle itself is fetched only when adopted. That
// is also what makes a *shared* registry repo possible — several wizards
// publishing into one index is how "all people shall be able to do it" stops
// meaning "ask me for my repo URL".
//
// The index is DERIVED data: every entry restates what is already inside a bundle,
// so it can always be rebuilt by reading the folder. Treat it as a cache that
// happens to live in git, never as the source of truth — a reader that distrusts
// it can still fall back to listing the directory (and the app does).

import { LENS_DIR, LENS_BUNDLE_V, lensBundlePath, isSafeLensPath } from "./lens-bundle.js";

export const REGISTRY_FILE = `${LENS_DIR}/index.json`;
export const REGISTRY_V = 1;

const str = (v) => (v == null ? "" : String(v));
const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

/**
 * One index row, derived entirely from a bundle. `path` is where the bundle lives
 * so a reader can fetch exactly one file; everything else is a preview so they can
 * decide whether they want to.
 */
export function buildIndexEntry(bundle) {
  const b = bundle || {};
  const dom = b.domain || {};
  if (!dom.id) throw new Error("buildIndexEntry: bundle has no domain.id");
  const entry = {
    id: str(dom.id),
    path: lensBundlePath(dom.id),
    label: str(dom.label) || str(dom.id),
    counts: {
      plateaus: int(b.counts?.plateaus ?? b.plateaus?.length),
      bridges: int(b.counts?.bridges ?? b.bridges?.length),
      external_bridges: int(b.counts?.external_bridges ?? b.external_bridges?.length),
      resources: int(b.counts?.resources ?? b.resources?.length),
    },
    v: Number.isFinite(b.v) ? b.v : LENS_BUNDLE_V,
  };
  // provenance only when the bundle carried it (R-0093 keeps these optional)
  const title = str(b.title).trim();
  const author = str(b.author).trim();
  const note = str(b.note).trim();
  if (title) entry.title = title;
  if (author) entry.author = author;
  if (note) entry.note = note;
  return entry;
}

/** An empty index — what a repo that has published nothing yet looks like. */
export function emptyIndex() {
  return { v: REGISTRY_V, lenses: [] };
}

/**
 * Insert or replace a row, keyed by lens id, keeping the list ordered by label so
 * the file's diff is small and readable when several people publish into it.
 * Pure: returns a new index, never mutates the input.
 */
export function upsertIndex(index, entry) {
  const cur = parseIndex(index) || emptyIndex();
  const others = cur.lenses.filter((x) => x.id !== entry.id);
  const lenses = [...others, entry].sort((a, b) =>
    a.label.localeCompare(b.label) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return { v: REGISTRY_V, lenses };
}

/** Drop a lens from the index (unpublishing). Pure. */
export function removeFromIndex(index, id) {
  const cur = parseIndex(index) || emptyIndex();
  return { v: REGISTRY_V, lenses: cur.lenses.filter((x) => x.id !== id) };
}

/**
 * Parse + validate an index written by ANYONE. Rows are untrusted input: a `path`
 * is fetched with the reader's token attached, so a row whose path escapes
 * `lenses/` is dropped outright rather than repaired. A row missing an id or path
 * is useless and also dropped. Returns null only if the whole file is unusable.
 *
 * A FUTURE registry version is refused rather than half-read, same rule as bundles.
 */
export function parseIndex(input) {
  let j;
  try {
    j = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  if (Number.isFinite(j.v) && j.v > REGISTRY_V) return null; // too new
  if (!Array.isArray(j.lenses)) return null;
  const seen = new Set();
  const lenses = [];
  for (const r of j.lenses) {
    if (!r || typeof r !== "object") continue;
    const id = str(r.id);
    const path = str(r.path) || lensBundlePath(id);
    if (!id || seen.has(id)) continue;
    if (!isSafeLensPath(path)) continue; // never fetch a path that climbs out
    seen.add(id);
    const row = {
      id,
      path,
      label: str(r.label) || id,
      counts: {
        plateaus: int(r.counts?.plateaus),
        bridges: int(r.counts?.bridges),
        external_bridges: int(r.counts?.external_bridges),
        resources: int(r.counts?.resources),
      },
      v: Number.isFinite(r.v) ? r.v : LENS_BUNDLE_V,
    };
    const title = str(r.title).trim();
    const author = str(r.author).trim();
    const note = str(r.note).trim();
    if (title) row.title = title;
    if (author) row.author = author;
    if (note) row.note = note;
    lenses.push(row);
  }
  return { v: REGISTRY_V, lenses };
}

/** Canonical bytes for the index file — stable so its git diff stays readable. */
export function registryJson(index) {
  return JSON.stringify(parseIndex(index) || emptyIndex(), null, 2);
}

/**
 * Rebuild an index from a directory listing when a repo has none — so a repo
 * published by plain R-0093 is still browsable, just without the previews. The
 * caller supplies the `.json` paths it found; `index.json` itself is excluded.
 */
export function indexFromPaths(paths) {
  const lenses = [];
  const seen = new Set();
  for (const p of Array.isArray(paths) ? paths : []) {
    const path = str(p);
    if (!isSafeLensPath(path) || path === REGISTRY_FILE) continue;
    const id = path.replace(/^lenses\//, "").replace(/\.json$/i, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    lenses.push({
      id,
      path,
      label: id, // no preview available without fetching the bundle
      counts: { plateaus: 0, bridges: 0, external_bridges: 0, resources: 0 },
      v: LENS_BUNDLE_V,
      unindexed: true, // the UI says "counts unknown until adopted"
    });
  }
  return { v: REGISTRY_V, lenses };
}

/** A one-line summary of a row for a list UI. Pure string building. */
export function describeEntry(entry) {
  const e = entry || {};
  const name = e.title || e.label || e.id || "Untitled lens";
  if (e.unindexed) return `${name} — counts unknown (no index in that repo)`;
  const c = e.counts || {};
  const bits = [
    `${int(c.plateaus)} topic${int(c.plateaus) === 1 ? "" : "s"}`,
    `${int(c.bridges)} bridge${int(c.bridges) === 1 ? "" : "s"}`,
  ];
  if (int(c.resources)) bits.push(`${int(c.resources)} resource${int(c.resources) === 1 ? "" : "s"}`);
  if (int(c.external_bridges)) bits.push(`${int(c.external_bridges)} cross-lens`);
  return `${name} — ${bits.join(", ")}`;
}
