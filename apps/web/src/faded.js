// faded.js — faded worked examples over R-0074 derivations (R-0083). Pure.
//
// The worked-example literature's strongest move (Renkl & Atkinson): start from
// the fully worked derivation, then FADE it — hide the last step and make the
// learner produce it, then the last two, … until they're deriving the whole
// thing. Backward fading beats forward (the early steps keep scaffolding the
// goal), and self-explaining a missing step beats re-reading a shown one.
//
// This module turns a `### Worked derivation` body (R-0074's format: blank-line
// separated paragraphs, steps marked `**Step N — title.** …`) into a faded view:
// which steps show, which are yours to produce. The fade LEVEL is per topic —
// 0 = fully worked; level k hides the LAST k steps; at level == steps.length
// you're deriving from a blank page. Leveling is self-assessed and persisted by
// main.js (mp.fade, this browser only). PURE + deterministic: no DOM, no
// storage, no randomness. Unit-tested in faded.test.mjs.

const STEP_RE = /^\*\*Step\s+(\d+)\s*[—–-]\s*([^*]*?)\*\*/;

/**
 * Parse a derivation body into `{ preamble, steps }`: paragraphs before the
 * first `**Step N — …**` marker join into `preamble` (may be ""); each step is
 * `{ n, title, md }` with `md` the step's FULL markdown paragraph. A body with
 * no step markers parses as all-preamble, zero steps (nothing fadeable). Pure.
 */
export function parseSteps(derivationMd) {
  const paras = String(derivationMd || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pre = [];
  const steps = [];
  for (const p of paras) {
    const m = p.match(STEP_RE);
    if (m) steps.push({ n: Number(m[1]), title: m[2].trim().replace(/\.$/, ""), md: p });
    else if (!steps.length) pre.push(p); // trailing non-step paragraphs ride the last step's tail
    else steps[steps.length - 1].md += `\n\n${p}`;
  }
  return { preamble: pre.join("\n\n"), steps };
}

/** Clamp a fade level into [0, total]. Junk (NaN/negative) → 0. */
export function clampFade(level, total) {
  const t = Math.max(0, Number.isFinite(total) ? Math.trunc(total) : 0);
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(Math.trunc(level), t));
}

/**
 * The faded view at `level`: backward fading hides the LAST `level` steps.
 * Returns `[{ step, hidden }]` in derivation order. Level 0 = fully worked;
 * level ≥ steps.length = every step is yours. Pure.
 */
export function fadedView(steps, level) {
  const list = Array.isArray(steps) ? steps : [];
  const k = clampFade(level, list.length);
  const firstHidden = list.length - k;
  return list.map((step, i) => ({ step, hidden: i >= firstHidden }));
}

/** Self-assessment transitions: "got it" fades one more step next time (capped);
 *  "show more support" restores one (floored at fully worked). */
export function levelUp(level, total) {
  return clampFade(clampFade(level, total) + 1, total);
}
export function levelDown(level, total) {
  return clampFade(clampFade(level, total) - 1, total);
}

/** The practice-bar label for a level — honest about where you are. */
export function fadeLabel(level, total) {
  const k = clampFade(level, total);
  if (k === 0) return "✍️ Practice — fill the missing step";
  if (k >= total) return `✍️ Practice — derive it all (${total} steps, no scaffold)`;
  return `✍️ Practice — last ${k === 1 ? "step is" : `${k} steps are`} yours`;
}
