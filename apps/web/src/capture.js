// capture.js — ⚡ Capture a topic (R-0079). Pure.
//
// Your study life doesn't start inside a curriculum — it starts with "I should
// reassess my trig" or "I want to derive the law of cosines from that YouTube
// video", with no idea yet how it wires into the graph. This module turns that
// standing start into a plateau: it flags an exact duplicate (open it, don't
// fork it), suggests where the topic MIGHT belong, places the new plateau near
// the neighbours you confirm, files it under the right lens, and assembles its
// starter body — all offline, no model.
//
// Deliberately OR-semantic, UNLIKE topic-search's AND: a captured topic's name
// rarely appears in its neighbours ("law of cosines" shares no word with
// "Vectors"), so the connection lives in the surrounding words you typed —
// a note about "the dot product of two vectors" is what surfaces the Vectors
// plateau. Suggestions are proposals you TICK; nothing is auto-wired, because a
// wrong bridge is worse than a missing one.
//
// PURE: plain data in, plain data out — no DOM, no CRDT, no Date.now(). The
// impure edges (add_plateau/add_bridge/add_resource, review enrolment,
// localStorage) live in main.js. Unit-tested in capture.test.mjs.

// Words worth matching on: ≥3 chars, minus a small multilingual stop set (the
// owner studies across EN/ES). Kept tiny — precision comes from name-weighting.
const STOP = new Set([
  "the", "and", "for", "from", "with", "that", "this", "into", "your", "you",
  "are", "was", "its", "how", "why", "des", "der", "una", "los", "las", "por",
  "como", "que", "del",
]);

const words = (s) =>
  String(s || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w));

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Plural-forgiving containment: "vectors" matches a body's "vector" and vice
// versa (mirrors topic-search's hasWord).
const has = (hay, w) => {
  if (hay.includes(w)) return true;
  if (w.endsWith("es") && hay.includes(w.slice(0, -2))) return true;
  if (w.endsWith("s") && hay.includes(w.slice(0, -1))) return true;
  return false;
};

/** An existing topic whose NAME equals the capture name (normalised), or null.
 *  Capture opens this instead of forking a duplicate. */
export function exactMatch(name, topics) {
  const n = norm(name);
  if (!n || !Array.isArray(topics)) return null;
  return topics.find((t) => norm(t?.name) === n) ?? null;
}

/**
 * Rank existing topics likely RELATED to a capture `{ name, note }`. OR
 * semantics: score each topic by how many capture words appear in its name (×3)
 * or body (×1), plural-forgiving; drop zero-score topics and the exact
 * self-match. `topics` = [{ id, name, lens, body, domain? }]. Returns the same
 * shape carried through plus `score`, best first, capped at `max`. Pure.
 */
export function suggestNeighbors(capture, topics, { max = 6 } = {}) {
  const terms = new Set([...words(capture?.name), ...words(capture?.note)]);
  if (!terms.size || !Array.isArray(topics)) return [];
  const self = norm(capture?.name);
  const out = [];
  for (const t of topics) {
    const tname = norm(t?.name);
    if (!tname || tname === self) continue;
    const body = String(t?.body || "").toLowerCase();
    let score = 0;
    for (const w of terms) {
      if (has(tname, w)) score += 3;
      else if (has(body, w)) score += 1;
    }
    if (score > 0) {
      out.push({ id: t.id, name: t.name, lens: t.lens || "Uncharted", domain: t.domain, score });
    }
  }
  out.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  return out.slice(0, max);
}

/**
 * Place a new plateau near confirmed neighbours: the centroid of their Grade-1
 * positions, plus a small DETERMINISTIC nudge (a hash of the name, never
 * Math.random — keeps the module pure and resumable) so it never lands exactly
 * on top of one. With no neighbours it sits at `fallback` (the domain's
 * canonical anchor). Returns `{ e1, e2, e3 }`.
 */
export function placeNear(neighborPositions, name, fallback = { e1: 0, e2: 0, e3: 0 }) {
  const ps = (neighborPositions || []).filter(
    (p) => p && [p.e1, p.e2, p.e3].every(Number.isFinite),
  );
  if (!ps.length) {
    return { e1: fallback?.e1 ?? 0, e2: fallback?.e2 ?? 0, e3: fallback?.e3 ?? 0 };
  }
  const c = ps.reduce(
    (a, p) => ({ e1: a.e1 + p.e1, e2: a.e2 + p.e2, e3: a.e3 + p.e3 }),
    { e1: 0, e2: 0, e3: 0 },
  );
  const n = ps.length;
  let h = 2166136261;
  for (const ch of String(name || "")) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  const jitter = (k) => (((h >> (k * 5)) & 31) / 31 - 0.5) * 0.12; // ±0.06
  return { e1: c.e1 / n + jitter(0), e2: c.e2 / n + jitter(1), e3: c.e3 / n + jitter(2) };
}

/**
 * The domain to file a capture under: the lens-domain carrying the most
 * combined neighbour score (so it lands on the busiest relevant island), or
 * null when none were confirmed — the caller then falls back to the active
 * persona's domain. `neighbors` = [{ domain, score }]. Pure.
 */
export function dominantDomain(neighbors) {
  const tally = new Map();
  for (const n of neighbors || []) {
    if (!n || n.domain == null) continue;
    tally.set(n.domain, (tally.get(n.domain) || 0) + (Number.isFinite(n.score) ? n.score : 1));
  }
  let best = null;
  let bestScore = -Infinity;
  for (const [d, s] of tally) if (s > bestScore) ((best = d), (bestScore = s));
  return best;
}

/** The resource kind for a captured URL: YouTube/Vimeo → Video, any other
 *  http(s) link → Article, non-links → null (nothing to pin). */
export function resourceKindFor(url) {
  const u = norm(url);
  if (!/^https?:\/\//.test(u)) return null;
  if (/(youtube\.com|youtu\.be|vimeo\.com)/.test(u)) return "Video";
  return "Article";
}

/** Assemble the starter Markdown body for a captured topic: an H1 of the name,
 *  then your note (already Markdown) or an honest stub inviting the first pass. */
export function captureBody({ name = "", note = "" } = {}) {
  const title = String(name).trim() || "Untitled topic";
  const n = String(note || "").trim();
  return n ? `# ${title}\n\n${n}` : `# ${title}\n\n_Captured to study — no notes yet._`;
}

/** Of the captured-topic ids in `stored`, those that STILL have no bridge in
 *  `bridges` (= [{ from_id, to_id }]) — the Unwired inbox auto-clears an id the
 *  moment it gains any connection, however it was wired. Preserves order. Pure. */
export function unwiredIds(stored, bridges) {
  const connected = new Set();
  for (const b of bridges || []) {
    if (b) {
      connected.add(b.from_id);
      connected.add(b.to_id);
    }
  }
  return (Array.isArray(stored) ? stored : []).filter((id) => id && !connected.has(id));
}
