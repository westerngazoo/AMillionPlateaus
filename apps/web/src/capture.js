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
 * Aggregate scored neighbour suggestions into candidate LENSES (R-0103). Given the
 * output of suggestNeighbors (each { name, lens, domain, score }), sum the score
 * per lens/domain and collect the matching topic names as the EVIDENCE. Returns
 * [{ domain, lens, score, matches: [names] }] best first. Pure.
 *
 * This is what answers "does 'reflections' relate to GA, Euclidean, or vector
 * geometry?" — instead of silently filing under the single busiest island, it
 * shows every lens the topic touches, and why.
 */
export function rankLenses(neighbors) {
  const by = new Map();
  for (const n of neighbors || []) {
    if (!n) continue;
    const key = n.domain != null ? `d:${n.domain}` : `l:${n.lens || "Uncharted"}`;
    const cur = by.get(key) || {
      domain: n.domain ?? null,
      lens: n.lens || "Uncharted",
      score: 0,
      matches: [],
    };
    cur.score += Number.isFinite(n.score) ? n.score : 1;
    if (n.name) cur.matches.push(n.name);
    by.set(key, cur);
  }
  return [...by.values()].sort(
    (a, b) => b.score - a.score || String(a.lens).localeCompare(String(b.lens)),
  );
}

/**
 * A plain-language verdict on where a topic fits, from ranked lenses. When the
 * leading lenses are within `spanRatio` of the top one, it is called a CROSS-LENS
 * idea — the honest answer for something like "reflections", which is genuinely a
 * first-class idea in several lenses (a versor sandwich in GA, an isometry in
 * Euclidean geometry, a projection in vector geometry) rather than living in one.
 * Returns `{ kind, text, lenses }`:
 *   'none'    — nothing in your graph matched (lean on the model hand-off)
 *   'single'  — one lens, nothing else of note
 *   'span'    — several comparable lenses; a genuine cross-lens idea
 *   'primary' — a clear leader, but other lenses have real evidence too
 */
export function fitVerdict(ranked, { spanRatio = 0.6, touchRatio = 0.25, maxSpan = 3 } = {}) {
  const r = (ranked || []).filter((x) => x && x.score > 0);
  if (!r.length) {
    return {
      kind: "none",
      text: "Nothing in your graph matches yet — ask your model where it fits, or pick a lens below.",
      lenses: [],
    };
  }
  const top = r[0];
  if (r.length === 1) {
    return { kind: "single", text: `Looks like ${top.lens}.`, lenses: [top.lens] };
  }
  // Genuine cross-lens: two or three lenses within spanRatio of the leader.
  const near = r.filter((x) => x.score >= top.score * spanRatio).slice(0, maxSpan);
  if (near.length >= 2) {
    const names = near.map((x) => x.lens);
    const list =
      names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
    return {
      kind: "span",
      text: `Spans ${list} — a cross-lens idea. Home it in one lens; you can bridge it into the others.`,
      lenses: names,
    };
  }
  // A clear leader, but name the other lenses with non-trivial evidence so you
  // still learn it touches Euclidean & vector geometry even when GA leads.
  const touches = r
    .slice(1)
    .filter((x) => x.score >= top.score * touchRatio)
    .map((x) => x.lens)
    .slice(0, maxSpan);
  if (touches.length) {
    return {
      kind: "primary",
      text: `Mostly ${top.lens} — also touches ${touches.join(", ")}.`,
      lenses: [top.lens, ...touches],
    };
  }
  return { kind: "single", text: `Looks like ${top.lens}.`, lenses: [top.lens] };
}

/**
 * A copy-paste prompt asking a model which of YOUR lenses a new topic belongs to,
 * and which existing topics it should connect to. Offline heuristics only see
 * shared words; this is the conceptual call (e.g. it knows a reflection is a GA
 * versor even when no GA topic spells the word). `lenses` = your lens labels;
 * `nearby` = [{ lens, topics: [names] }] your graph already has near it. Pure text.
 */
export function lensFitPrompt({ name = "this topic", note = "" } = {}, lenses = [], nearby = []) {
  const topic = String(name).trim() || "this topic";
  const L = (lenses || []).filter(Boolean);
  const lines = [`I'm adding a new topic to my personal knowledge map: "${topic}".`];
  const n = String(note || "").trim();
  if (n) lines.push(`My note on it: ${n}`);
  if (L.length) {
    lines.push(`\nMy lenses (the perspectives my map is organised by):\n${L.map((x) => `- ${x}`).join("\n")}`);
  }
  const nb = (nearby || []).filter((x) => x && Array.isArray(x.topics) && x.topics.length);
  if (nb.length) {
    lines.push(`\nTopics already near it in my map, by lens:`);
    for (const g of nb) lines.push(`- ${g.lens}: ${g.topics.slice(0, 6).join(", ")}`);
  }
  lines.push(
    `\nWhich of my lenses does "${topic}" genuinely belong to? It may belong to several — if so, say how it appears through each (the same idea seen differently). Then list the 3–6 existing topics it should connect to, and for each say whether it is a prerequisite of "${topic}", a consequence of it, or a sibling. Keep it a short list I can act on.`,
  );
  return lines.join("\n");
}

// Lens labels that have an established short form in this world; anything else
// falls back to its first word ("Euclidean Geometry" → "Euclidean view: …").
const LENS_SHORT = {
  "Geometric Algebra": "GA",
  "Synthetic Infinitesimal Analysis": "SIA",
};

/** Short prefix for a lens label, matching the seeded "GA view: …" convention. */
export function lensShort(label) {
  const l = String(label || "").trim();
  if (!l) return "Other";
  return LENS_SHORT[l] || l.split(/\s+/)[0];
}

/** A twin's name: the seeded convention, e.g. "GA view: Reflections". */
export function twinName(name, lensLabel) {
  return `${lensShort(lensLabel)} view: ${String(name || "").trim()}`;
}

/**
 * Starter body for a twin: says plainly that it is the SAME idea seen through
 * another lens, and asks the question that makes the twin worth having. Follows
 * the markdown subset (heading in its own block, one line per paragraph).
 */
export function twinBody(name, lensLabel, primaryLens = "the other lens") {
  const n = String(name || "").trim() || "this topic";
  return [
    `# ${twinName(n, lensLabel)}`,
    "",
    `The same idea as **${n}**, seen through ${lensLabel}.`,
    "",
    `How does ${lensLabel} express it? Write the formulation here — the object it uses, the operation that acts, and what becomes obvious in this view that stayed hidden in ${primaryLens}.`,
    "",
  ].join("\n");
}

/**
 * Plan the twin plateaus for a cross-lens capture (R-0104). Given the primary
 * lens the topic is homed in and the OTHER lenses it spans, return one entry per
 * twin: `{ domain, lens, name, body }`. Skips the primary lens, anything without
 * a domain, and duplicates. Pure — the caller mints the plateaus and bridges.
 *
 * This is the "reflections" case made concrete: home it in Geometric Algebra,
 * and also stand up "Euclidean view: Reflections" and "Vector view: Reflections",
 * each bridged to the primary as an alternative formulation — the same twin
 * relation the seeded GA/SIA pairs use, so parallel view can walk across them.
 */
export function twinPlan({ name, primaryDomain, primaryLens } = {}, lenses = []) {
  const n = String(name || "").trim();
  if (!n) return [];
  const seen = new Set([primaryDomain]);
  const out = [];
  for (const l of lenses || []) {
    if (!l || l.domain == null || seen.has(l.domain)) continue;
    seen.add(l.domain);
    out.push({
      domain: l.domain,
      lens: l.lens,
      name: twinName(n, l.lens),
      body: twinBody(n, l.lens, primaryLens || "the primary lens"),
    });
  }
  return out;
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

/**
 * A plateau title from a note's first meaningful line (R-0092): the first
 * non-empty line, stripped of leading Markdown heading/bullet marks and inline
 * emphasis/backticks, collapsed and capped at 60 chars. "" when the note is
 * blank or only images/whitespace. Pure.
 */
export function titleFromNote(note) {
  const lines = String(note || "").split("\n");
  for (const raw of lines) {
    let line = raw
      .replace(/^\s*#{1,6}\s+/, "") // heading marker
      .replace(/^\s*[-*+]\s+/, "") // bullet
      .replace(/^\s*\d+\.\s+/, "") // ordered item
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // drop image syntax
      .replace(/[*_`>#]/g, "") // inline emphasis / stray marks
      .replace(/\s+/g, " ")
      .trim();
    if (line) return line.length > 60 ? `${line.slice(0, 60).trim()}…` : line;
  }
  return "";
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
