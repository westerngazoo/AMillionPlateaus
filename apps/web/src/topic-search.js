// topic-search.js — 🔎 Find a topic across every lens (R-0072). Pure.
//
// You're reading a book about "system config and degrees of freedom" — which of
// YOUR topics is that, and through which lens? This searches every plateau's NAME
// and BODY for a phrase, ranks name hits above body hits, and returns md-stripped
// snippets around the first body hit so you can see WHY it matched. The UI groups
// results by lens so one query shows the Physics treatment next to the GA one and
// you choose the door. Offline, no model — plain text search over the seeded +
// authored world. Impure edges (graph read, flyTo/openPlateau) live in main.js.
// Unit-tested in topic-search.test.mjs.

// Tokenize a query: lowercase words, ≥3 chars ("of" is noise for AND semantics).
const words = (q) =>
  String(q || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);

// A haystack "contains" a query word with light plural forgiveness: "degrees"
// matches "degree" (and vice versa) so a book's plural phrasing still finds the
// singular in a body. Both sides lowercase already.
const hasWord = (hay, w) => {
  if (hay.includes(w)) return true;
  if (w.endsWith("es") && hay.includes(w.slice(0, -2))) return true;
  if (w.endsWith("s") && hay.includes(w.slice(0, -1))) return true;
  return false;
};

// Strip markdown noise for a one-line snippet (headers, emphasis, code ticks).
const stripMd = (s) =>
  String(s || "")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Search `topics` = [{ id, name, lens, body }] for `query`. AND semantics: every
 * query word (≥3 chars, plural-forgiving) must appear in name+body combined.
 * Ranking: whole-phrase-in-name ≫ per-word name hits ≫ body hits; ties by name.
 * Each result carries an md-stripped `snippet` of ±40 chars around the first
 * body hit ("" for name-only matches). Capped at `max`. Pure + deterministic.
 */
export function searchTopics(query, topics, { max = 24 } = {}) {
  const qwords = words(query);
  if (!qwords.length || !Array.isArray(topics)) return [];
  const phrase = String(query || "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  for (const t of topics) {
    const name = String(t?.name || "");
    if (!name) continue;
    const body = String(t?.body || "");
    const nameLc = name.toLowerCase();
    const bodyLc = body.toLowerCase();
    let score = 0;
    let missing = false;
    for (const w of qwords) {
      const inName = hasWord(nameLc, w);
      const inBody = hasWord(bodyLc, w);
      if (inName) score += 10;
      else if (inBody) score += 2;
      else {
        missing = true;
        break;
      }
    }
    if (missing) continue;
    if (phrase && nameLc.includes(phrase)) score += 25; // the whole phrase in the title
    else if (phrase && bodyLc.includes(phrase)) score += 8; // the whole phrase in the body
    // snippet: context around the first body occurrence of the phrase, else the
    // first query word — "" when the match is name-only.
    let snippet = "";
    let at = phrase ? bodyLc.indexOf(phrase) : -1;
    if (at === -1) {
      for (const w of qwords) {
        const i = bodyLc.indexOf(w) !== -1 ? bodyLc.indexOf(w) : bodyLc.indexOf(w.replace(/e?s$/, ""));
        if (i !== -1) {
          at = i;
          break;
        }
      }
    }
    if (at !== -1) {
      const from = Math.max(0, at - 40);
      const to = Math.min(body.length, at + 80);
      snippet = `${from > 0 ? "…" : ""}${stripMd(body.slice(from, to))}${to < body.length ? "…" : ""}`;
    }
    out.push({ id: t.id, name, lens: t.lens || "Uncharted", score, snippet });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, max);
}

/**
 * Group ranked results by lens, preserving rank order inside each group and
 * ordering groups by their best hit — so the strongest lens leads. Returns
 * `[[lens, results[]], …]`. Pure.
 */
export function groupByLens(results) {
  const groups = new Map();
  for (const r of results || []) {
    if (!groups.has(r.lens)) groups.set(r.lens, []);
    groups.get(r.lens).push(r);
  }
  return [...groups.entries()].sort((a, b) => (b[1][0]?.score ?? 0) - (a[1][0]?.score ?? 0));
}
