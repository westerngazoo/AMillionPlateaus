// digest.js — a downloadable offline study digest for a focused subgraph (Track B7
// / R-0026). Turns a plateau + its bridge-neighbors + its pinned resources into a
// self-contained Markdown document you can keep and study offline. Pure: no DOM,
// no network, no wasm, no GA — the caller assembles the subgraph from the graph
// DTOs and hands it here; this only formats. Deterministic. Reuses the ranking
// (study.js) and extractive sentence pick (offline-digest.js) already in the app.

import { rankResources } from "./study.js";
import { topSentences } from "./offline-digest.js";

/** A filesystem-friendly `.md` name from a topic name (lowercase, dashed). */
export function digestFilename(name = "topic") {
  const slug =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic";
  return `${slug}.md`;
}

// One ranked resource → a Markdown list line (kind, title, uri, stone state).
function resourceLine(r, i) {
  const state = r.state === "Crystallized" ? " ◆ vouched" : r.vote_count > 0 ? ` ● ${Math.round(r.vote_count)}` : "";
  const uri = r.uri ? ` — ${r.uri}` : "";
  return `${i + 1}. [${r.kind}] ${r.title}${uri}${state}`;
}

/**
 * Build the Markdown digest for a focused subgraph:
 *   - `plateau`   the focused topic DTO ({ id, name, description })
 *   - `neighbors` the bridge-connected topic DTOs
 *   - `bridges`   the bridges touching the plateau ({ from, to, concept })
 *   - `resources` the resources pinned to the plateau ({ kind, title, uri, ... })
 * Sections are omitted gracefully when empty. Pure + deterministic (neighbors and
 * connections are sorted; resources use the shared best-first ranking).
 */
export function subgraphDigest({ plateau, neighbors = [], bridges = [], resources = [] } = {}) {
  const name = plateau?.name ?? "Untitled topic";
  const nameOf = new Map([plateau, ...neighbors].filter(Boolean).map((p) => [p.id, p.name]));
  const lines = [`# ${name}`, ""];

  const body = (plateau?.description ?? "").trim();
  lines.push(body || "_No notes yet._", "");

  // Connections: each bridge from the focused plateau to another topic.
  const connections = bridges
    .map((b) => {
      const otherId = b.from === plateau?.id ? b.to : b.from;
      return { concept: b.concept || "", other: nameOf.get(otherId) ?? otherId };
    })
    .filter((c) => c.other != null)
    .sort((a, b) => (a.other < b.other ? -1 : a.other > b.other ? 1 : a.concept < b.concept ? -1 : 1));
  if (connections.length) {
    lines.push("## Connections", "");
    for (const c of connections) {
      lines.push(c.concept ? `- **${c.concept}** → ${c.other}` : `- → ${c.other}`);
    }
    lines.push("");
  }

  // Resources: shared best-first ranking, stone state annotated.
  const ranked = rankResources(resources);
  if (ranked.length) {
    lines.push("## Resources", "");
    ranked.forEach((r, i) => lines.push(resourceLine(r, i)));
    lines.push("");
  }

  // Neighboring topics: name + one salient sentence of their notes (extractive).
  const sortedNeighbors = [...neighbors].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1,
  );
  if (sortedNeighbors.length) {
    lines.push("## Neighboring topics", "");
    for (const n of sortedNeighbors) {
      const gist = topSentences(n.description ?? "", 1)[0];
      lines.push(gist ? `- **${n.name}** — ${gist}` : `- **${n.name}**`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    `_Offline study digest — ${1 + sortedNeighbors.length} topics, ${connections.length} connections, ${ranked.length} resources._`,
  );
  return lines.join("\n");
}
