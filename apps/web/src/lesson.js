// lesson.js — the guided "Teach me this topic" lesson (R-0060).
//
// A topic in the graph is a MAP; a lesson is the TERRITORY. This sequences the
// pieces the app already has — the plateau's notes, the audio overview (R-0050),
// the deep-study prompts (R-0048), the NotebookLM/Gemini hand-off (R-0056), the
// private notepad (R-0056), the mastery gate (R-0030) — into an ordered,
// one-step-at-a-time Feynman lesson instead of a grid of buttons.
//
// Pure: it defines the step sequence and builds each step's hand-off prompt from
// the topic's own graph context. The impure edges (clipboard, window.open, audio,
// DOM) live in main.js.

import { feynmanPrompt, deepQuizPrompt, flashcardsPrompt } from "./study-prompts.js";

const NOTES_CAP = 900; // keep a pasted prompt inside any chat box

const groundNotes = (notes) => String(notes || "").trim().slice(0, NOTES_CAP);
const groundLine = (notes) =>
  groundNotes(notes)
    ? `\n\nGround it in my notes (say what's missing rather than inventing):\n${groundNotes(notes)}`
    : "";

/** 2–3 vivid everyday analogies, each with the point where it breaks. */
export function analogyPrompt({ name = "this topic", domainLabel = "", notes = "" } = {}) {
  const where = domainLabel ? ` (in ${domainLabel})` : "";
  return (
    `Give me 2–3 vivid, everyday ANALOGIES for "${name}"${where} — the kind that make it click for someone new. ` +
    `For each: state the analogy, then the ONE place it breaks down (every analogy lies a little — name the lie).` +
    groundLine(notes)
  );
}

/** One concrete worked example / derivation, step by step. */
export function examplePrompt({ name = "this topic", domainLabel = "", notes = "" } = {}) {
  const where = domainLabel ? ` (in ${domainLabel})` : "";
  return (
    `Work ONE concrete, instructive EXAMPLE of "${name}"${where} step by step — show every move and say why each step is allowed, ` +
    `as if teaching at a whiteboard. End with the one insight the example is really there to teach.` +
    groundLine(notes)
  );
}

// The ordered lesson. `kind` tells the UI how to render the step; `prompt` (when
// present) is the hand-off prompt key. Keep it short — a lesson you finish beats
// one you abandon.
export const LESSON_STEPS = [
  { key: "summary", title: "Summary", kind: "read",
    coach: "Start with the map of the idea — its notes. Then we build the territory. (🎧 listen if you'd rather hear it.)" },
  { key: "ground", title: "Ground it", kind: "ground",
    coach: "Anchor the topic in one real source you trust — a search, a paper, a book. A course needs a spine." },
  { key: "analogy", title: "Make it click", kind: "handoff", prompt: "analogy",
    coach: "A good analogy is worth a page of definitions. Get a few, then keep the best in your notes." },
  { key: "example", title: "See it work", kind: "handoff", prompt: "example",
    coach: "One worked example beats ten statements. Follow it, then redo it yourself without looking." },
  { key: "check", title: "Check yourself", kind: "handoff", prompt: "check",
    coach: "Try before you look — the struggle IS the learning. Answer these in your own words first." },
  { key: "teach", title: "Teach it back", kind: "handoff", prompt: "teach",
    coach: "If you can't explain it simply, you don't understand it yet (Feynman). Write your explanation, then have it graded." },
  { key: "recall", title: "Lock it in", kind: "master", prompt: "recall",
    coach: "Spaced recall is what makes it stick. Make flashcards — and when you can answer them cold, mark it mastered." },
];

/**
 * A self-contained grounding header. The reused R-0048 prompts (deep quiz,
 * flashcards) were written to ride the IN-APP companion, whose system prompt
 * already carries the topic's notes — pasted into a BLANK Gemini/AI Studio tab
 * their "this topic" / "grounding above" refer to nothing. Prepending this makes
 * every hand-off prompt stand on its own. Pure.
 */
export function groundHeader({ name = "this topic", domainLabel = "", notes = "" } = {}) {
  const where = domainLabel ? ` (${domainLabel})` : "";
  const body = groundNotes(notes);
  return body
    ? `Topic: "${name}"${where}\n\nMy notes on it (ground your answer in these; where they're thin, say what's missing rather than inventing):\n${body}\n\n`
    : `Topic: "${name}"${where}\n\n`;
}

/**
 * The hand-off prompt for a step, built from the topic's graph context.
 * `ctx` = { name, domainLabel, notes, neighbors }. Returns "" for steps with no
 * generated prompt (summary / ground). Every generated prompt is self-contained —
 * it names the topic and carries its notes — so it works in a blank chat tab, not
 * only inside the app's companion. Pure + deterministic.
 */
export function lessonStepPrompt(stepKey, ctx = {}) {
  switch (stepKey) {
    case "analogy":
      return analogyPrompt(ctx);
    case "example":
      return examplePrompt(ctx);
    case "check":
      return groundHeader(ctx) + deepQuizPrompt({ neighbors: ctx.neighbors || [] });
    case "teach":
      return groundHeader(ctx) + feynmanPrompt({ topicName: ctx.name || "this topic" });
    case "recall":
      return groundHeader(ctx) + flashcardsPrompt();
    default:
      return "";
  }
}

/** Clamp a step index into range (for Next/Back). Pure. */
export function clampStep(i, total = LESSON_STEPS.length) {
  return Math.max(0, Math.min(total - 1, Number.isFinite(i) ? Math.floor(i) : 0));
}
