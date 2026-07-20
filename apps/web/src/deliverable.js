// deliverable.js — 🎯 walk me through the deliverable (R-0073). Pure.
//
// Every curriculum topic ends in a concrete **Deliverable:** — but stating a task
// doesn't teach you to DO it ("shows a deliverable but does not help me if I
// don't know how"). This extracts the deliverable line from a topic body and
// builds a TUTOR prompt for the hand-off: smallest steps, hints before answers,
// the full worked solution only at the end. With the R-0073 Gemini prefill the
// tab opens with the coaching request already asked. Impure edges (DOM row,
// clipboard, window.open) live in main.js. Unit-tested in deliverable.test.mjs.

/**
 * Pull the deliverable text out of a Markdown body: the text after a
 * `**Deliverable:**` marker, up to the next blank line or the next `**…:**`
 * section (e.g. **Study (official):**). Whitespace-collapsed; "" when the body
 * has no deliverable. Pure.
 */
export function extractDeliverable(md) {
  const s = String(md || "");
  const m = s.match(/\*\*Deliverable:\*\*\s*([\s\S]*?)(?:\n\s*\n|\n\*\*[^*]+:\*\*|$)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * The tutor prompt: coach me through DOING this deliverable — don't just answer
 * it. Small enough (~topic + deliverable) to ride the Gemini prefill URL. Pure.
 */
export function deliverableCoachPrompt({ topic = "this topic", deliverable = "", pathTitle = "" } = {}) {
  return [
    `I'm studying "${topic}"${pathTitle ? ` (in "${pathTitle}")` : ""}. My deliverable is:`,
    "",
    `"${deliverable}"`,
    "",
    "Be my tutor and walk me through actually DOING it — do not just hand me the answer:",
    "1. Restate the goal in plain words and name what I need to already know.",
    "2. Break the work into the smallest sensible steps, in order.",
    "3. For each step, ask me to try it and give a HINT first — only reveal that step's answer (with the why) if I say I'm stuck.",
    "4. At the end, show the full worked solution cleanly, then give me ONE similar practice problem to confirm I can do it alone.",
    "Start with step 1 now and wait for my attempt.",
  ].join("\n");
}
