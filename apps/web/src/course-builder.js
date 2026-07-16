// course-builder.js — turn a reference into a whole course (R-0061).
//
// The lesson (R-0060) teaches ONE topic; this designs the whole SYLLABUS. You give
// a title and (optionally) a reference — a book, a paper, a university course, a
// link — and get a copy-able prompt that asks NotebookLM/Gemini to lay out a
// step-by-step course in a STRICT, parseable format. You paste the result back and
// the app turns it into real authored plateaus + prerequisite bridges + a
// followable path — each topic then gets the R-0060 "Teach me" lesson for free.
//
// This module is PURE: it builds the prompt and PARSES the pasted outline. The
// impure edges (clipboard, window.open, doc.add_plateau/add_bridge, savePaths) are
// in main.js. Model-free by design — the generation rides the hand-off (R-0056).

const NAME_CAP = 80;
const DESC_CAP = 240;

/**
 * The hand-off prompt: asks for a course in a line format we can parse back.
 * `reference` is optional free text (book / course / url / topic). Pure.
 */
export function courseOutlinePrompt({ title = "this subject", reference = "" } = {}) {
  const ref = String(reference || "").trim();
  const basedOn = ref ? ` based on: ${ref}` : "";
  return [
    `Design a step-by-step COURSE on "${title}"${basedOn}.`,
    "",
    "Give it as a dependency-ordered syllabus a motivated beginner could actually follow — each topic building on earlier ones, from foundations to the real payoff.",
    "",
    "Output ONLY the course, one topic per line, in EXACTLY this format and nothing else (no preamble, no numbering styles other than this):",
    "",
    "N. Topic name :: one-sentence description of what it covers :: prereq: <the exact name of an earlier topic it depends on, or: none>",
    "",
    "Rules: 8–14 topics; the first has prereq none; every other prereq must be the EXACT name of a topic listed ABOVE it; keep names short (a few words).",
  ].join("\n");
}

const clean = (s, cap) => String(s || "").trim().replace(/\s+/g, " ").slice(0, cap);

/**
 * Parse a pasted course outline into ordered steps. Tolerant of formatting drift:
 * the strict `N. Name :: desc :: prereq: X` shape first, then looser fallbacks
 * (`N. Name — desc`, `N. Name`). Lines that carry no topic name are skipped, so
 * a stray preamble/among-the-lines note doesn't become a plateau.
 *
 * Returns `[{ name, description, prereqName }]` — `prereqName` is the raw earlier
 * topic name (resolved to an id at build time) or `null`. Pure + deterministic.
 */
export function parseCourseOutline(text) {
  const MARKER = /^\s*(?:\d+[.)]|[-*•])\s+/; // "1." / "1)" / "- " / "* " / "• "
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // A topic line has a list marker OR the structured "::" — otherwise it's
    // prose (a preamble, a note) and is skipped, so it never becomes a plateau.
    const hasMarker = MARKER.test(line);
    if (!hasMarker && !line.includes("::")) continue;
    const body = line.replace(MARKER, "");

    let name = "";
    let description = "";
    let prereqName = null;
    if (body.includes("::")) {
      const parts = body.split("::").map((p) => p.trim());
      name = parts[0] || "";
      description = parts[1] || "";
      const pr = (parts[2] || "").replace(/^prereq:\s*/i, "").trim();
      prereqName = pr && !/^none$/i.test(pr) ? clean(pr, NAME_CAP) : null;
    } else {
      // fallback: "Name — desc" / "Name: desc" / "Name • desc" / just "Name"
      const m = body.match(/^(.+?)\s*(?:—|–|•|·|:| - )\s*(.+)$/);
      if (m) {
        name = m[1];
        description = m[2].replace(/\s*\(?prereq[^)]*\)?\.?$/i, "");
      } else {
        name = body;
      }
    }
    name = clean(name, NAME_CAP);
    if (!name) continue; // no usable topic name → skip
    out.push({ name, description: clean(description, DESC_CAP), prereqName });
  }
  // De-dup by name (first wins) so a repeated heading doesn't double a plateau.
  const seen = new Set();
  return out.filter((t) => {
    const k = t.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Resolve each step's `prereqName` to the index of an EARLIER step (by
 * case-insensitive name match); unmatched or forward references fall back to the
 * immediately-preceding step, so the course is always a connected chain. Returns
 * `[{ ...step, prereqIndex }]` where prereqIndex is -1 for the first topic. Pure.
 */
export function linkPrereqs(steps) {
  const indexByName = new Map(steps.map((s, i) => [s.name.toLowerCase(), i]));
  return steps.map((s, i) => {
    if (i === 0) return { ...s, prereqIndex: -1 };
    let j = s.prereqName ? indexByName.get(s.prereqName.toLowerCase()) : undefined;
    if (j === undefined || j >= i) j = i - 1; // missing/forward ref → previous topic
    return { ...s, prereqIndex: j };
  });
}
