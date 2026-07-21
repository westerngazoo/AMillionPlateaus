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

/** The headers every GitHub call carries. The token NEVER goes anywhere else. */
export function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
