// study.js — pure helpers for the plateau Study view (R-0023 / SPEC-0023).
// No DOM, no GA, no network: resource ranking, the plateau-scoped tutor grounding,
// and the study-action prompts. Mirrors companion-context.js (a pure formatter)
// and is unit-tested in study.test.mjs.

const BODY_CAP = 2000; // bound the body we hand the model (token safety, R-0023 AC5)

/**
 * Resources best-first: weighted votes descending, deterministic id tiebreak.
 * `vote_count` is the R-0015 WEIGHTED SUM (a float), not an integer tally — we
 * sort on the raw value and only round for display. Non-mutating (copies first).
 */
export function rankResources(resources = []) {
  return [...resources].sort(
    (a, b) => b.vote_count - a.vote_count || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * Plateau-scoped grounding for the tutor: the plateau name + its body (capped)
 * + its top resources, best-first. Pure + deterministic; handed to the model as
 * TEXT (never innerHTML). The body may be imported/synced peer content — it
 * rides to the configured endpoint under the same trust boundary as R-0007.
 */
export function buildPlateauStudyContext({ plateau, resources = [] } = {}) {
  const name = plateau?.name ?? "Untitled";
  const body = (plateau?.description ?? "").slice(0, BODY_CAP);
  const top = rankResources(resources)
    .slice(0, 8)
    .map(
      (r) =>
        `- ${r.kind}: ${r.title}` +
        (r.uri ? ` (${r.uri})` : "") +
        (r.state === "Crystallized" ? " [vouched]" : ""),
    );
  return [
    `The learner is studying the plateau "${name}".`,
    body ? `Its notes:\n${body}` : "It has no notes yet.",
    top.length ? `Resources pinned here (best first):\n${top.join("\n")}` : "No resources pinned yet.",
    "Help them learn THIS topic, grounded ONLY in the notes and resources above. " +
      "If the notes are thin, say so and suggest what to add — do not invent facts or resources.",
  ].join("\n\n");
}

// The companion study actions: a label + the prompt sent through the existing
// bring-your-own model path (R-0007), grounded by buildPlateauStudyContext.
export const STUDY_ACTIONS = [
  { key: "summary", label: "Summarize", prompt: "Summarize this topic in a few clear sentences, using only its notes." },
  {
    key: "model",
    label: "Mental model",
    prompt: "Give me the core mental model for this topic — the 2–3 ideas everything else hangs on.",
  },
  {
    key: "first",
    label: "What to read first",
    prompt:
      "Of the resources pinned here, what should I read or watch first, and in what order? " +
      "If there are none, suggest what kind would help most.",
  },
  {
    key: "quiz",
    label: "Quiz me",
    prompt: "Ask me three short questions, one at a time, to check my understanding of this topic.",
  },
];

// ── AI-checked proof (R-0032 / SPEC-0032) ──────────────────────────────────────
// A "Prove it" mastery path: the learner writes a proof, the model judges it
// (feedback + a verdict), a PASS signs the R-0030 mastery. Pure helpers only —
// no DOM/network/GA. The model is a JUDGE, not a formal verifier.

const PROOF_CAP = 4000; // bound the proof we send the model (token safety)

/**
 * The grading USER message: the topic name + the learner's proof + the verdict
 * instruction. The plateau grounding rides separately (assembleMessages). Pure.
 */
export function buildProofGrading({ plateau, proof } = {}) {
  const name = plateau?.name ?? "this topic";
  const p = String(proof ?? "").slice(0, PROOF_CAP);
  return [
    `I'm demonstrating my understanding of "${name}". My proof / explanation:`,
    "",
    p,
    "",
    "You are a tutor giving JUDGMENT, not a formal proof checker. Judge whether " +
      "this correctly demonstrates understanding of THIS topic, grounded ONLY in " +
      "its notes above. Give brief, specific feedback. Then end with EXACTLY one " +
      "final line: `VERDICT: PASS` if it holds, or `VERDICT: REVISE` if it needs work.",
  ].join("\n");
}

/**
 * Parse the model's verdict → `{ pass, feedback }`. Detection is LINE-ANCHORED
 * (a standalone final `VERDICT: PASS`/`REVISE`), so a mid-sentence mention in the
 * model's prose never passes; the last standalone verdict wins; an absent or
 * ambiguous verdict ⇒ `pass: false` (fail-safe — never auto-grant mastery).
 * `feedback` strips the verdict line(s). Pure + deterministic. NOTE: only the
 * MODEL's reply is passed here — never the learner's proof — so the gate can't
 * be self-granted by writing the token in the proof.
 */
export function parseVerdict(reply = "") {
  const text = String(reply);
  const last = [...text.matchAll(/^[ \t]*VERDICT:\s*(PASS|REVISE)\b/gim)].pop();
  const pass = last ? last[1].toUpperCase() === "PASS" : false;
  const feedback = text.replace(/^[ \t]*VERDICT:\s*(PASS|REVISE)[ \t]*$/gim, "").trim();
  return { pass, feedback: feedback || text.trim() };
}

// ── Cross-cutting resources (R-0028 / SPEC-0028) ───────────────────────────────
// A book/link that covers several topics is "the same book" iff it shares a
// normalized URL. Resources stay single-anchor; these PURE helpers thread them
// for display. No DOM/network/GA.

/**
 * Normalize a URL for "same book" grouping: http(s) only (else "" → never
 * groups), lowercase scheme+host, strip trailing slashes, keep path+query, drop
 * the hash. `new URL` is a standard global in node and the browser; malformed or
 * unsafe input returns "" and never throws.
 */
export function normalizeUrl(uri = "") {
  const s = String(uri).trim();
  if (!/^https?:\/\//i.test(s)) return "";
  try {
    const u = new URL(s);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return "";
  }
}

/**
 * The OTHER plateaus whose resources share `uri` — the "Also covers" set.
 * Deterministic: excludes `currentPlateauId`, one row per plateau (max
 * `vote_count` kept for an optional `●N`), sorted by name then id. Empty/unsafe
 * URL → []. Pure.
 */
export function crossLinks({ resources = [], plateaus = [], uri, currentPlateauId } = {}) {
  const key = normalizeUrl(uri);
  if (!key) return [];
  const nameOf = new Map(plateaus.map((p) => [p.id, p.name]));
  const best = new Map(); // plateauId -> max vote_count
  for (const r of resources) {
    if (normalizeUrl(r.uri) !== key || r.plateau_id === currentPlateauId) continue;
    if (!nameOf.has(r.plateau_id)) continue;
    const prev = best.get(r.plateau_id);
    if (prev === undefined || r.vote_count > prev) best.set(r.plateau_id, r.vote_count);
  }
  return [...best.entries()]
    .map(([id, count]) => ({ id, name: nameOf.get(id), count }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Resources whose URL appears on BOTH endpoints of a bridge — the books that
 * span the connection (R-0029). One row per shared URL with a representative
 * title/kind/uri, sorted by title then uri. Pure.
 */
export function bridgeResources({ resources = [], fromId, toId } = {}) {
  const onFrom = new Set();
  const onTo = new Set();
  const meta = new Map(); // url -> { title, kind, uri }
  for (const r of resources) {
    const key = normalizeUrl(r.uri);
    if (!key) continue;
    if (r.plateau_id === fromId) onFrom.add(key);
    if (r.plateau_id === toId) onTo.add(key);
    if (!meta.has(key)) meta.set(key, { title: r.title, kind: r.kind, uri: r.uri });
  }
  return [...onFrom]
    .filter((k) => onTo.has(k))
    .map((k) => meta.get(k))
    .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
}
