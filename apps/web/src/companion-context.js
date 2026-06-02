// companion-context.js — pure graph-grounded context builder
// (SPEC-0007 §2.3, R-0007 AC3/AC6).
//
// Turns a GA-graph snapshot for the visitor's current orientation into a compact
// grounding block for the model. PURE and deterministic: same inputs → same
// string. No GA math here — the projection scores come from the wasm core
// (`nearest_plateaus`); this module only formats names/scores into text.
//
// Two different personas pass a different `reachableIds`/`nearest` (their
// orientations light different regions), so the context observably differs — the
// whole point of grounding the companion in the geometry (R-0007 AC3).

export function buildGroundingContext({ persona, plateaus, reachableIds, nearest, bridges }) {
  const byId = new Map(plateaus.map((p) => [p.id, p]));

  const lit = [...reachableIds]
    .map((id) => byId.get(id)?.name)
    .filter(Boolean)
    .sort();

  // Filter unknown ids like `lit` does, so a snapshot mismatch never renders
  // "undefined (0.16)".
  const near = nearest
    .filter((n) => byId.has(n.id))
    .map((n) => `${byId.get(n.id).name} (${n.score.toFixed(2)})`);

  const links = bridges
    .filter((b) => reachableIds.has(b.from) && reachableIds.has(b.to))
    .map((b) => `${byId.get(b.from)?.name}—${byId.get(b.to)?.name}: ${b.concept}`);

  return [
    `You are ${persona.name}, oriented toward ${persona.domainLabel}.`,
    `Plateaus currently in reach: ${lit.join(", ") || "none yet"}.`,
    `Nearest to your orientation: ${near.join(", ") || "none"}.`,
    `Connections among them: ${links.join("; ") || "none"}.`,
    `Ground your guidance in this neighbourhood; do not invent plateaus outside it.`,
  ].join("\n");
}
