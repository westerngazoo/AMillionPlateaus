// resource.js — pure. Validates and normalises trail-marker inputs. Returns
// { plateau, title, kind, uri, error: null } on success, or { error } on invalid
// input. No WASM, no GA. Mirrors plateau.js / bridge.js (SPEC-0014 / R-0014).

// The six ResourceKind values (authoritative enum lives in Rust). The UI offers
// these labels; an unknown/blank kind falls back to "Note" both here and in the
// Rust parse_resource_kind (defense in depth).
export const RESOURCE_KINDS = ["Note", "Article", "Video", "Interactive", "Paper", "Tool"];
export const TITLE_FALLBACK = "Untitled note";

// buildResource({ plateau, title, kind, uri })
//
// Requires a plateau anchor (the only hard error — a marker must attach to a
// plateau). Title trims to a fallback; an unknown/blank kind defaults to "Note";
// uri trims and may be empty (a note need not link anywhere).
export function buildResource({ plateau, title, kind, uri } = {}) {
  if (!plateau) return { error: "Pick a plateau to anchor the marker to." };
  return {
    plateau,
    title: (typeof title === "string" ? title.trim() : "") || TITLE_FALLBACK,
    kind: RESOURCE_KINDS.includes(kind) ? kind : "Note",
    uri: typeof uri === "string" ? uri.trim() : "",
    error: null,
  };
}
