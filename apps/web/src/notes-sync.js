// notes-sync.js — sync private notes to the OWNER'S OWN GitHub repo (R-0075). Pure.
//
// The notepad is this-browser-only; the owner studies on two Boox tablets too.
// The sync model that respects the app's rules: THE OWNER creates a private repo
// and a fine-grained token themselves (a setup wizard walks them through it), the
// token lives ONLY in this browser's localStorage (same pattern as the model key,
// R-0007 AC5), and every request goes straight from the browser to api.github.com
// — no middleman, and cross-origin means the service worker never touches it.
// One markdown file per topic, so any Boox reader can open the notes raw.
//
// This module is PURE: repo parsing, file naming, UTF-8-safe base64, and headers.
// The fetch edges (test connection, get/put contents) live in main.js.
//
// R-0081: the same repo also carries the GRAPH ITSELF — a single CRDT snapshot
// (`doc.save()` bytes) at WORLD_FILE — so a topic captured on one device crosses
// to the others. Merge is a CRDT union (`merge_bytes`), so pull never clobbers
// local work; base64 here is over RAW BYTES, not UTF-8 text.

/** The one file that holds the whole graph snapshot (Automerge CRDT bytes).
 *  Under `world/` so it sits apart from the human-readable `notes/`. */
export const WORLD_FILE = "world/graph.mpworld";

// R-0086: the repo layer is FORGE-AGNOSTIC. GitHub is the default, but any
// Gitea/Forgejo instance works — their contents API is deliberately
// GitHub-shaped (base64 + sha, same GET/PUT verbs); only the URL prefix
// differs (Gitea nests under /api/v1). These pure builders are the single
// place that difference lives.

export const GITHUB_API = "https://api.github.com";

/** Normalize a pasted forge URL to a stable base: "" → GitHub; bare hosts get
 *  https://; trailing slashes and an accidental /api/v1 suffix are stripped;
 *  github.com spellings collapse to GITHUB_API. */
export function normalizeForgeBase(input) {
  let s = String(input || "").trim().replace(/\/+$/, "");
  if (!s) return GITHUB_API;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  s = s.replace(/\/api\/v1$/i, "").replace(/\/+$/, "");
  if (/^https:\/\/(www\.|api\.)?github\.com$/i.test(s)) return GITHUB_API;
  return s;
}

/** The repo endpoint on a forge: GitHub → /repos/o/r; Gitea → /api/v1/repos/o/r. */
export function repoApiUrl(base, owner, repo) {
  const b = base || GITHUB_API;
  return b === GITHUB_API ? `${b}/repos/${owner}/${repo}` : `${b}/api/v1/repos/${owner}/${repo}`;
}

/** The contents endpoint for a path (optionally at a ref) on any forge. */
export function contentsApiUrl(base, owner, repo, path, ref) {
  return `${repoApiUrl(base, owner, repo)}/contents/${encodeURI(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
}

/**
 * Parse a repo reference into `{ base, owner, repo }`: bare "owner/repo" and
 * github.com URLs → GitHub; any other forge URL keeps its origin (+ subpath —
 * Gitea often lives under one) as `base`, its last two path segments as
 * owner/repo. `.git` and trailing slashes tolerated. null on junk.
 */
export function parseRepoUrl(input) {
  const s = String(input || "").trim().replace(/\/+$/, "").replace(/\.git$/i, "");
  if (!/^https?:\/\//i.test(s)) {
    const p = parseRepo(s);
    return p ? { base: GITHUB_API, ...p } : null;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  if (segs.length < 2) return null;
  const repo = segs.pop();
  const owner = segs.pop();
  if (!/^[A-Za-z0-9._-]+$/.test(repo) || !/^[A-Za-z0-9._-]+$/.test(owner)) return null;
  if (/(^|\.)github\.com$/i.test(u.hostname)) return { base: GITHUB_API, owner, repo };
  return { base: `${u.origin}${segs.length ? `/${segs.join("/")}` : ""}`, owner, repo };
}

/** "owner/repo", a github.com URL, or trailing ".git"/slash → { owner, repo } | null. */
export function parseRepo(input) {
  const s = String(input || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  const m = s.match(/^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/**
 * One file per topic: `notes/<name-slug>--<id8>.md`. The slug keeps it readable on
 * a Boox file list; the id suffix keeps it stable and unique if topics share or
 * change names. Diacritics folded, 60-char slug cap. Pure + deterministic.
 */
export function noteFilePath(name, id) {
  const slug =
    String(name || "topic")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "topic";
  const id8 = String(id || "").replace(/-/g, "").slice(0, 8) || "x";
  return `notes/${slug}--${id8}.md`;
}

/** UTF-8-safe base64 (GitHub contents API wants base64; notes carry accents + math). */
export function b64EncodeUtf8(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64DecodeUtf8(b64) {
  const bin = atob(String(b64 || "").replace(/\s+/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Base64 over RAW BYTES (the graph snapshot is binary, not UTF-8) — the
 *  counterpart to b64EncodeUtf8, minus the TextEncoder pass. Chunked so a big
 *  snapshot doesn't blow the argument stack. */
export function b64FromBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}
/** Inverse of b64FromBytes → the raw bytes to hand back to `merge_bytes`. */
export function bytesFromB64(b64) {
  const bin = atob(String(b64 || "").replace(/\s+/g, ""));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The headers every GitHub call carries. The token NEVER goes anywhere else. */
export function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
