// offline-digest.js — the Study companion's OFFLINE floor (R-0026 / SPEC-0026).
// With no model connected, the four study actions get a real, useful answer
// computed locally from the plateau's own notes + ranked resources — never the
// echo. Pure: no DOM, no network, no LLM, no GA. Extractive only — every word of
// output is a body substring, resource metadata, or fixed non-factual scaffolding;
// it NEVER asserts a fact. Deterministic (explicit tiebreaks; only toLowerCase()
// and plain </>, never locale ops). Mirrors study.js/labels.js; node-tested.
import { rankResources } from "./study.js";

const SENTS = 3; // Summarize: salient sentences
const QUIZ = 3; // Quiz me: questions
const TERMS = 6; // Mental model: key ideas
const TOP_RES = 8; // What to read first: cap (matches buildPlateauStudyContext)

// A small English stop set — enough to keep key-term frequency meaningful.
const STOP = new Set(
  (
    "the a an and or but of to in on at for with from by as is are was were be been being " +
    "this that these those it its they them their there here we you your i he she his her " +
    "not no do does did have has had can could will would should may might must if then else " +
    "so than too very just about into over under out up down which who whom whose what when " +
    "where why how all any both each few more most other some such only own same also one two"
  ).split(" "),
);

const THIN =
  "The notes here are thin — add a few sentences, or connect a model in “Model setup” for a richer answer.";
const HEADER =
  "Offline digest (no model connected — connect one in “Model setup” for a richer answer):";

/**
 * Markdown → plain text for extraction. Drops fenced code blocks, heading hashes,
 * list/quote markers, link syntax (keeps the visible text), and emphasis markers.
 * Inline math `$…$` and inline-code text PASS THROUGH (they are body text, not
 * invented). Pure string transforms; `toLowerCase` is applied only downstream.
 */
export function plainText(md = "") {
  return String(md)
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]*)`/g, "$1") // inline code → its text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading hashes
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote markers
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "") // list markers
    .replace(/[*_]{1,3}/g, "") // emphasis markers
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Split plain text into trimmed, non-empty sentences. A boundary is `[.!?]`
 * FOLLOWED BY whitespace/end — so `1.5` and `$x^2$` never split mid-token. Emits
 * WHOLE sentences verbatim (never synthesized text).
 */
export function sentences(text = "") {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `#`/`##`… heading titles, in document order. */
export function headings(md = "") {
  const out = [];
  for (const line of String(md).split("\n")) {
    const m = /^\s{0,3}#{1,6}\s+(.*\S)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Content words (length ≥ 3, not a stop word), most frequent first. Counts live
 * in a first-seen-ordered Map; ties break by first-seen index — no reliance on
 * implicit key order. Returns up to `n` terms (lowercased).
 */
export function keyTerms(text = "", n = TERMS) {
  const freq = new Map();
  const seen = new Map();
  let i = 0;
  for (const raw of plainText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    if (!seen.has(raw)) seen.set(raw, i++);
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  return [...freq.keys()]
    .sort((a, b) => freq.get(b) - freq.get(a) || seen.get(a) - seen.get(b))
    .slice(0, n);
}

/**
 * Extractive summary: score each sentence by lead-position bias + key-term
 * density, SELECT the top `n` (score desc, original index asc), then REORDER the
 * selected set back into original document order. Whole sentences, verbatim.
 */
export function topSentences(body = "", n = SENTS) {
  const plain = plainText(body);
  const sents = sentences(plain);
  if (sents.length <= n) return sents;
  const terms = new Set(keyTerms(body));
  const scored = sents.map((s, idx) => {
    const words = s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const hits = words.filter((w) => terms.has(w)).length;
    const density = words.length ? hits / words.length : 0;
    return { s, idx, score: 1 / (idx + 1) + density };
  });
  const picked = [...scored]
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, n)
    .sort((a, b) => a.idx - b.idx);
  return picked.map((p) => p.s);
}

function doSummary(body) {
  const top = topSentences(body, SENTS);
  return top.length ? top.join(" ") : THIN;
}

function doMentalModel(body) {
  const hs = headings(body);
  if (hs.length) return `The structure of these notes:\n${hs.map((h) => `• ${h}`).join("\n")}`;
  const terms = keyTerms(body);
  if (terms.length) return `Key ideas in these notes:\n${terms.map((t) => `• ${t}`).join("\n")}`;
  return THIN;
}

function doReading(resources) {
  const ranked = rankResources(resources).slice(0, TOP_RES);
  if (!ranked.length) {
    return "No resources pinned here yet — an Article or Video would be a good first stone.";
  }
  const lines = ranked.map(
    (r, i) =>
      `${i + 1}. ${r.kind}: ${r.title}` +
      (r.uri ? ` (${r.uri})` : "") +
      (r.state === "Crystallized" ? " [vouched]" : ""),
  );
  return `Read in this order (most-stoned first):\n${lines.join("\n")}`;
}

function doQuiz(body) {
  const terms = keyTerms(body, QUIZ);
  const sents = topSentences(body, QUIZ);
  const qs = [];
  for (const t of terms) qs.push(`Can you explain "${t}" in your own words?`);
  for (const s of sents) {
    if (qs.length >= QUIZ) break;
    qs.push(`What is the key idea behind: "${s}"?`);
  }
  if (!qs.length) return THIN;
  return `Recall check:\n${qs
    .slice(0, QUIZ)
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n")}`;
}

/**
 * The offline answer for one study action. `action` is a STUDY_ACTIONS key
 * (summary | model | first | quiz). Always prefixed with the offline header so
 * the learner knows to connect a model for more. Pure + deterministic.
 */
export function offlineDigest({ action, plateau, resources = [] } = {}) {
  const body = plateau?.description ?? "";
  const make = {
    summary: () => doSummary(body),
    model: () => doMentalModel(body),
    first: () => doReading(resources),
    quiz: () => doQuiz(body),
  };
  const fn = make[action] ?? make.summary;
  return `${HEADER}\n\n${fn()}`;
}
