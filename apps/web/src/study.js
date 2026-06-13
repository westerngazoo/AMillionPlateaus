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
