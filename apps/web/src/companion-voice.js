// companion-voice.js — pure persona → voice mapping (SPEC-0007 §2.3, R-0007 AC2).
//
// An archetype's voice is tone/stance ONLY — never a stat or a number. Rank is
// earned geometry, not dialed-in (CLAUDE.md §4 / R-0006); the voice just makes the
// companion *embody* the chosen persona. Keyed by the archetype ids defined in
// persona.js (geometer / composer / polymath).

export const VOICES = {
  geometer:
    "Speak as a precise, proof-minded guide who loves structure, rigor, and clean definitions.",
  composer:
    "Speak as a lyrical guide who hears patterns as rhythm and harmony and reaches for the musical analogy.",
  polymath:
    "Speak as a synthesist who bridges domains and delights in analogy across mathematics and music.",
};

// Prefer an explicit per-persona `voice` (what an authored persona composes from
// the visitor's tone, SPEC-0009), then the built-in archetype voice, then the
// generic fallback. Purely additive — presets carry no `.voice`, so they resolve
// exactly as before; an authored persona with no tone still gets the generic line
// (no crash, R-0009 AC3).
export function voiceFor(persona) {
  if (persona?.voice && persona.voice.trim()) return persona.voice.trim();
  return (persona && VOICES[persona.id]) || "Speak as a helpful, grounded guide.";
}
