// study-prompts.js — the deep-study prompt pack (R-0048): the NotebookLM-style
// study patterns the owner collected ("Prompts NotebookLM" — mental models,
// expert disagreements, deep-understanding questions, answer evaluation, hidden
// connections, personalized gap map, Feynman method), adapted from "all the
// sources in this notebook" to what THIS app actually has — which is stronger:
//
//   NotebookLM's "sources"   →  a plateau's notes + pinned resources
//   "across sources"         →  across BRIDGED neighbours (the graph's edges)
//   "based on our chat"      →  the REAL mastered/studying sets + path position
//
// PURE: every function takes plain data and returns the USER message string;
// grounding (persona voice + plateau notes/resources) rides separately through
// the existing companion pipeline (R-0023). No DOM, no fetch, no graph handles.
// Tested in study-prompts.test.mjs.

// Bound per-topic note bodies so a whole-domain prompt stays token-sane
// (22 QC topics × capped body ≈ 15KB — fine; uncapped bodies would not be).
export const TOPIC_BODY_CAP = 700;

const capBody = (body = "") => String(body).slice(0, TOPIC_BODY_CAP);

// One "source line" per topic for domain-wide prompts.
function topicBlock(t) {
  const body = capBody(t.body);
  return body ? `### ${t.name}\n${body}` : `### ${t.name}\n(no notes yet)`;
}

/** Prompt 1 — mental models, across a whole domain (the lens as the notebook). */
export function mentalModelsPrompt({ domainLabel = "this domain", topics = [] } = {}) {
  return [
    `Across ALL the topics of "${domainLabel}" below, identify the 5 fundamental MENTAL MODELS their authors share.`,
    "I don't want a summary of each topic. I want the common FRAMES OF THOUGHT underneath them — the principles an expert with 20 years of experience takes for granted but a beginner would never articulate.",
    "For each mental model: 1) name it in one clear phrase; 2) explain it in 2–3 sentences; 3) cite at least 2 of the topics below that rest on it; 4) give one concrete decision it changes when studying this field.",
    "",
    topics.map(topicBlock).join("\n\n"),
  ].join("\n\n");
}

/** Prompt 2 — expert disagreements, across THIS plateau's pinned resources. */
export function disagreementsPrompt() {
  return [
    "Across the resources pinned to this topic (listed in the grounding above), show me up to 3 points where their authors FUNDAMENTALLY DISAGREE — or would, given their approaches.",
    "For each disagreement: 1) state the disputed question; 2) present the strongest argument of each position, citing the specific pinned resource it comes from; 3) explain why the debate matters to someone learning this topic now; 4) say whether a consensus is emerging or it remains open.",
    "If the pinned resources genuinely agree on everything, say so honestly and name the nearest live controversy in the field instead.",
  ].join("\n");
}

/** Prompt 3 — deep-understanding questions, forced ACROSS the bridges. */
export function deepQuizPrompt({ neighbors = [] } = {}) {
  const near = neighbors.length
    ? `Its bridged neighbour topics are: ${neighbors.map((n) => `"${n.name}" (bridge: ${n.concept})`).join(", ")}.`
    : "It has no bridged neighbours yet.";
  return [
    "Generate 10 questions that expose whether I UNDERSTAND this topic deeply or have merely memorized rules and facts.",
    near,
    "The questions must: require reasoning, not recall; connect this topic to its bridged neighbours (cross at least 3 bridges); include situations where the usual rule of thumb FAILS; and distinguish someone who repeats definitions from someone who understands the principles behind them.",
    "Order them from easiest to hardest, numbered 1–10. Don't answer them yet — I'll pick one and reply; then evaluate my answer.",
  ].join("\n");
}

/** Prompt 4 — evaluate my answer (a TEMPLATE the learner completes and sends). */
export function evaluatePrompt({ topicName = "this topic" } = {}) {
  return [
    `Evaluate my answer about "${topicName}".`,
    "The question was: [PASTE THE QUESTION]",
    "My answer: [WRITE YOUR ANSWER HERE]",
    "Tell me: 1) what I got right; 2) what is wrong or incomplete; 3) what I'm still missing conceptually; 4) which of this topic's pinned resources (or bridged neighbours) I should revisit to close the gap.",
  ].join("\n");
}

/** Prompt 5 — hidden connections: overlaps, tensions, and a meta-model. */
export function hiddenConnectionsPrompt({ neighbors = [] } = {}) {
  const near = neighbors.length
    ? `Bridged neighbours: ${neighbors.map((n) => `"${n.name}" (${n.concept})`).join(", ")}.`
    : "No bridges yet — propose the first ones.";
  return [
    "Analyze this topic against its bridged neighbours and find the HIDDEN CONNECTIONS.",
    near,
    "Tell me: 1) where the ideas OVERLAP or reinforce each other; 2) where they CONTRADICT or create tension; 3) whether one META-MODEL subsumes them all.",
    'Then propose up to 3 NEW bridges this map is missing, as lines of the form: "this topic" ↔ "other topic" — bridging concept. Use concrete ideas from the notes, not generic links.',
  ].join("\n");
}

/**
 * Prompt 6 — the personalized gap map, grounded in REAL progress data (what
 * NotebookLM has to infer from chat, the graph knows: mastered/studying per
 * topic and the followed path's next step).
 */
export function gapMapPrompt({ domainLabel = "this domain", topics = [], pathTitle = null, nextStep = null } = {}) {
  const lines = topics.map((t) => `- ${t.name}: ${t.status}`);
  const path = pathTitle
    ? `They are following the path "${pathTitle}"${nextStep ? `, whose next unmastered step is "${nextStep}"` : ""}.`
    : "They are not following a path right now.";
  return [
    `Here is the learner's REAL progress across "${domainLabel}" (from the app's mastery records, not self-report):`,
    lines.join("\n"),
    path,
    "Based on this: 1) name their 3 biggest comprehension gaps (topics marked studying-but-unmastered near mastered ones matter more than untouched frontiers); 2) for each gap, which SPECIFIC topics above to study, in order; 3) what they must solidify BEFORE each gap can close; 4) an optimal study plan for the next 4 hours, as a numbered list with rough timings.",
  ].join("\n\n");
}

/** Feynman method — a TEMPLATE the learner completes: explain, get graded. */
export function feynmanPrompt({ topicName = "this topic" } = {}) {
  return [
    `I'm going to explain "${topicName}" as if to a colleague who knows nothing about it.`,
    "My explanation: [EXPLAIN IT HERE IN YOUR OWN WORDS]",
    "Now evaluate my explanation: 1) where did I oversimplify and lose something essential? 2) where am I plain wrong? 3) what analogy or example would make it better? 4) score my understanding 1–10 and justify the score.",
  ].join("\n");
}

// The one-click deep-study verbs, in drawer order. `scope` tells the UI glue
// which context to gather: "plateau" rides the standard grounding as-is,
// "neighbors" wants the bridged-neighbour list, "domain" the domain's topics,
// "progress" the mastery/path snapshot, and "template" prefills the companion
// input for the learner to complete (evaluate/feynman need THEIR words).
export const DEEP_STUDY_ACTIONS = [
  { key: "models", label: "Mental models", scope: "domain" },
  { key: "disagree", label: "Disagreements", scope: "plateau" },
  { key: "deepquiz", label: "Deep quiz", scope: "neighbors" },
  { key: "connections", label: "Hidden connections", scope: "neighbors" },
  { key: "gaps", label: "Gap map", scope: "progress" },
  { key: "feynman", label: "Feynman: I explain", scope: "template" },
  { key: "evaluate", label: "Grade my answer", scope: "template" },
];
