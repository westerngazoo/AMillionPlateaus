// podcast.js — the Audio Overview (R-0050): NotebookLM's podcast, graph-grounded
// and $0. The connected model WRITES a two-host episode about the open topic
// (drawing on the whole domain's notes); the browser's built-in speechSynthesis
// READS it aloud with two voices — no TTS service, no key, works offline once
// the script exists.
//
// PURE: prompt building, script parsing and voice selection are plain functions
// over plain data — no DOM, no fetch, no speechSynthesis handles. The single
// impure edge (creating utterances and speaking them) lives in main.js glue.
// Tested in podcast.test.mjs.

import { TOPIC_BODY_CAP } from "./study-prompts.js";

const capBody = (body = "") => String(body).slice(0, TOPIC_BODY_CAP);

/**
 * The episode-writing prompt. HOST A is the curious learner (asks, pushes
 * back, wants examples); HOST B is the expert (explains, connects topics).
 * The strict "HOST A:/HOST B:" line format is the contract parseScript reads.
 */
export function podcastPrompt({ domainLabel = "this domain", focusName = "this topic", topics = [] } = {}) {
  const sources = topics
    .map((t) => {
      const body = capBody(t.body);
      return body ? `### ${t.name}\n${body}` : `### ${t.name}\n(no notes yet)`;
    })
    .join("\n\n");
  return [
    `Write a short podcast episode: two hosts discussing "${focusName}" for a learner walking the "${domainLabel}" topics below.`,
    "HOST A is the curious one — asks the questions a smart newcomer would, pushes back on jargon, wants concrete examples. HOST B is the expert — explains clearly, connects the focus topic to the other topics below, admits open questions honestly.",
    "Rules: 10 to 14 exchanges total. EVERY line must start with exactly \"HOST A:\" or \"HOST B:\" — no narration, no stage directions, no markdown, no headings. Keep each turn to 1–3 spoken sentences (this will be read aloud). Ground every claim in the notes below — do not invent facts the notes contradict. End with HOST B giving the listener one concrete thing to try next.",
    "",
    sources,
  ].join("\n\n");
}

/**
 * Parse the model's reply into [{ host: "A"|"B", text }].
 *
 * Tolerant by design — models drift from format contracts: accepts "HOST A:",
 * "Host B —", "**HOST A:**", bare "A:", "HOST 1:"/"HOST 2:" (mapped to A/B).
 * A line with no marker continues the previous speaker's turn. If NO markers
 * appear anywhere, falls back to alternating hosts per paragraph so a
 * non-compliant reply still plays instead of erroring.
 */
export function parseScript(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const marker = /^\s*(?:[*_#>]+\s*)?(?:HOST\s*)?([AB12])(?:[*_]+)?\s*[:：—–-]\s*(.*)$/i;
  const strip = (s) => s.replace(/\*\*|__|(^|\s)[*_](\S)/g, "$1$2").trim();
  const lines = [];
  let sawMarker = false;
  for (const line of raw.split("\n")) {
    const m = line.match(marker);
    if (m) {
      sawMarker = true;
      const host = m[1] === "1" ? "A" : m[1] === "2" ? "B" : m[1].toUpperCase();
      const text = strip(m[2]);
      if (text) lines.push({ host, text });
      else lines.push({ host, text: "" }); // marker-only line — text continues below
    } else if (sawMarker && lines.length && line.trim()) {
      const last = lines[lines.length - 1];
      last.text = (last.text ? last.text + " " : "") + strip(line);
    }
  }
  if (sawMarker) return lines.filter((l) => l.text);
  // No markers at all: alternate hosts per paragraph — degraded but playable.
  return raw
    .split(/\n\s*\n/)
    .map((p) => strip(p.replace(/\n/g, " ")))
    .filter(Boolean)
    .map((text, i) => ({ host: i % 2 === 0 ? "A" : "B", text }));
}

/**
 * Pick two DISTINCT voices for the hosts from speechSynthesis.getVoices()
 * (plain {name, lang} objects — pure and testable). Prefers two different
 * voices matching `langPrefix`; falls back to any two distinct voices, then to
 * doubling the single available voice, then to {a: null, b: null} (the glue
 * leaves utterance.voice unset → browser default, differentiated by pitch).
 */
export function pickVoices(voices = [], langPrefix = "en") {
  const all = (voices || []).filter((v) => v && v.name);
  const pref = all.filter((v) => String(v.lang || "").toLowerCase().startsWith(langPrefix.toLowerCase()));
  const pool = pref.length ? pref : all;
  if (!pool.length) return { a: null, b: null };
  const a = pool[0];
  const b = pool.find((v) => v.name !== a.name) ?? a;
  return { a, b };
}
