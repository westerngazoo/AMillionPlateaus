// rabbit-hole.js — mark the sentence that lost you (R-0071). Pure.
//
// A topic body can read like a lecture at full speed. The pedagogic fix: let the
// learner TAP the exact sentence that went too fast, and from that one sentence
// either (a) rabbit-hole — a hand-off that explains THAT sentence slowly, one
// idea at a time — or (b) surface the hidden prerequisite it silently assumed,
// as EXACT topic names that resolve (via where-fits' matchTopics) to plateaus
// they can open: "a plateau previous that I did not know I needed."
//
// This module is PURE: it splits prose into sentence chunks WITHOUT ever breaking
// inside $…$ math (KaTeX renders after segmentation, so a split delimiter would
// kill the math), and it builds the two hand-off prompts. The impure edges (DOM
// segmentation, marks in localStorage, clipboard/window.open) live in main.js.
// Unit-tested in rabbit-hole.test.mjs.

/**
 * Split a TEXT-NODE string into sentence chunks: `[{ text, end }]` where `end`
 * marks a sentence boundary after that chunk. A boundary is `.`/`!`/`?` (plus any
 * closing quotes/parens) followed by whitespace and an upper-case/digit/¿¡ opener
 * — so "e.g. lowercase" doesn't split — and NEVER inside `$…$` math (the `$`
 * delimiters toggle an in-math state). Concatenating the chunks reproduces the
 * input exactly. Pure + deterministic.
 */
export function sentenceChunks(text) {
  const s = String(text ?? "");
  if (!s) return [];
  const out = [];
  let start = 0;
  let inMath = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "$") {
      inMath = !inMath;
      continue;
    }
    if (inMath || !".!?".includes(ch)) continue;
    // swallow closing quotes/parens after the terminator
    let j = i + 1;
    while (j < s.length && `)"'”’`.includes(s[j])) j++;
    // need whitespace, then a sentence opener
    if (j >= s.length || !/\s/.test(s[j])) continue;
    let k = j;
    while (k < s.length && /\s/.test(s[k])) k++;
    if (k >= s.length) continue; // trailing space — the block ends anyway
    if (!/[A-Z0-9¿¡ÁÉÍÓÚÑ]/.test(s[k])) continue; // "e.g. lowercase" — not a boundary
    out.push({ text: s.slice(start, k), end: true });
    start = k;
    i = k - 1;
  }
  if (start < s.length) out.push({ text: s.slice(start), end: false });
  return out;
}

// Group a topic list by lens — the same legible shape whereFitsPrompt uses.
const lensBlock = (topics) => {
  const byLens = new Map();
  for (const t of topics || []) {
    const k = t.lens || "Other";
    if (!byLens.has(k)) byLens.set(k, []);
    byLens.get(k).push(t.name);
  }
  return [...byLens.entries()].map(([lens, names]) => `${lens}:\n  ${names.join("\n  ")}`).join("\n\n");
};

/**
 * The rabbit-hole prompt: explain THIS sentence slowly — one idea at a time,
 * every symbol defined, analogy first — in the context of its topic. Pure.
 */
export function explainSlowlyPrompt({ topic = "this topic", sentence = "", pathTitle = "" } = {}) {
  return [
    `I'm studying "${topic}"${pathTitle ? ` (in "${pathTitle}")` : ""} and this sentence went too fast for me:`,
    "",
    `"${sentence}"`,
    "",
    "Explain it SLOWLY, like a patient teacher:",
    "- one idea per short paragraph, in order — do not skip steps;",
    "- define EVERY symbol and technical term the moment it first appears;",
    "- give a concrete example or physical analogy BEFORE the formal statement;",
    "- if there's an equation, read it aloud in plain words term by term;",
    "- end by restating the sentence in one plain-language line.",
    "Assume only basic high-school math unless the sentence itself requires more — and if it does, say exactly what background it leans on.",
  ].join("\n");
}

/**
 * The hidden-prerequisite prompt: what background does this sentence silently
 * assume? Constrained to EXACT topic names from the learner's map (one per line)
 * so the pasted answer resolves back to real plateaus via matchTopics; concepts
 * not on the map are named plainly. `topics` = [{ name, lens }]. Pure.
 */
export function missingForPrompt({ topic = "this topic", sentence = "", topics = [] } = {}) {
  return [
    `I'm studying "${topic}" and I don't have the background for this sentence:`,
    "",
    `"${sentence}"`,
    "",
    "Here is the full topic list of my study map, grouped by lens:",
    "",
    lensBlock(topics),
    "",
    "Name the 1–4 prerequisite concepts this sentence silently assumes. Where a concept matches a topic in my list, reply with its EXACT name from the list, one per line, most fundamental first — nothing else on those lines. If a needed concept is NOT in my list, add a final line starting with \"missing:\" naming it plainly.",
  ].join("\n");
}
