// markdown.js — pure, injection-safe Markdown→safe-HTML for plateau bodies
// (R-0020 / SPEC-0020).
//
// CONTRACT: the returned string is SAFE to assign to innerHTML. Every run of
// source text is HTML-escaped; the ONLY tags that ever appear are ones this
// module emits, from a fixed allowlist:
//   h1..h6, p, br, strong, em, code, pre, ul, ol, li, a, span, img
// the ONLY attributes emitted are href/rel/target (on <a>), src/alt/loading (on
// <img> — src passes safeImgSrc: https or base64 RASTER data URIs only, never
// svg, which can script; loading="lazy" on https srcs only) and
// class/data-display/data-tex (on span.mp-math);
// class/data-display/loading are fixed literals, never copied from input.
// Link/resource URLs pass a scheme whitelist
// applied to the CONTROL-STRIPPED url. Math is handed off as an INERT placeholder
// whose TeX lives in an escaped data-tex attribute (katex.js typesets it later).
//
// Bodies arrive from UNTRUSTED synced/imported peers — this must never be an
// injection vector. The pure surface (esc, safeHref, renderMarkdown) is
// unit-tested in markdown.test.mjs, including the structural tag/attribute
// allowlist and a battery of XSS payloads.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const SAFE_SCHEMES = /^(https?:|mailto:)/i;

/** Escape the five HTML-significant characters. */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Return a safe href, or null if the scheme isn't whitelisted. ASCII control
 *  chars + space are stripped FIRST so `java\tscript:` / `\x01javascript:` /
 *  ` javascript:` cannot slip past the prefix test (mirrors the WHATWG URL
 *  parser's control-char removal). The single chokepoint for body links AND
 *  resource URIs. */
export function safeHref(url) {
  const u = String(url ?? "").replace(/[\x00-\x20]/g, "");
  return SAFE_SCHEMES.test(u) ? u : null;
}

// R-0077: image sources are STRICTER than links — https, or a base64 RASTER
// data URI (png/jpeg/gif/webp). data:image/svg+xml is deliberately excluded
// (SVG can carry script); so is http: (mixed content on the hosted app).
const SAFE_IMG_SCHEMES = /^(https:|data:image\/(png|jpe?g|gif|webp);base64,)/i;

/** Return a safe <img> src, or null. Same control-char stripping as safeHref. */
export function safeImgSrc(url) {
  const u = String(url ?? "").replace(/[\x00-\x20]/g, "");
  return SAFE_IMG_SCHEMES.test(u) ? u : null;
}

// Private-use sentinels delimit extracted verbatim/validated tokens. esc() leaves
// them untouched, and they are effectively impossible to type; even if forged,
// the worst case is a peer's own text rendering as their own (escaped) math/code.
const OPEN = "\uE000";
const CLOSE = "\uE001";
const TOKEN_RE = /\uE000(\d+)\uE001/g;

/** Render a Markdown body to SAFE HTML (see module contract). Pure + deterministic. */
export function renderMarkdown(src) {
  const tokens = [];
  const hold = (html, block = false) => {
    const t = `${OPEN}${tokens.push(html) - 1}${CLOSE}`;
    return block ? `\n\n${t}\n\n` : t;
  };

  let s = String(src ?? "");

  // 1. Extract verbatim/validated constructs from the RAW source → placeholders,
  //    so their innards are never treated as Markdown (and links are validated
  //    before escaping mangles the URL).
  // Fenced code blocks (```), block-level.
  s = s.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) =>
    hold(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`, true),
  );
  // Display math $$…$$, block-level.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => hold(mathSpan(tex, true), true));
  // Images ![alt](src) — R-0077, extracted BEFORE links so `![…](…)` never
  // half-matches as a link with a stray "!". src passes safeImgSrc (https or
  // base64 raster data URI); anything else renders as inert escaped text.
  s = s.replace(/!\[([^\]\n]*)\]\(([^)\s]+)\)/g, (whole, alt, url) => {
    const imgSrc = safeImgSrc(url);
    if (!imgSrc) return hold(esc(whole)); // held, so the LINK pass can't re-parse it
    // lazy-load ONLY network images: a lazy data: URI that starts offscreen
    // (notepad preview, print view) can sit at complete=false forever and
    // render 0×0 — the bytes are already inline, there is nothing to defer.
    const lazy = /^https:/i.test(imgSrc) ? ' loading="lazy"' : "";
    return hold(`<img src="${esc(imgSrc)}" alt="${esc(alt)}"${lazy} />`);
  });
  // Links [text](url) — URL validated here, on the raw text.
  s = s.replace(/\[([^\]\n]*)\]\(([^)\s]+)\)/g, (whole, text, url) => {
    const href = safeHref(url);
    return href
      ? hold(`<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(text)}</a>`)
      : esc(whole); // not a safe scheme → inert, escaped literal text
  });
  // Inline math $…$ (single line).
  s = s.replace(/\$([^$\n]+?)\$/g, (_, tex) => hold(mathSpan(tex, false)));
  // Inline code `…`.
  s = s.replace(/`([^`\n]+?)`/g, (_, code) => hold(`<code>${esc(code)}</code>`));

  // 2. Block parse the placeholdered text (blank-line separated blocks).
  const html = s
    .split(/\n{2,}/)
    .map(renderBlock)
    .filter(Boolean)
    .join("\n");

  // 3. Restore placeholders — their HTML was built safely above.
  return html.replace(TOKEN_RE, (_, i) => tokens[Number(i)] ?? "");
}

function mathSpan(tex, display) {
  const t = esc(tex.trim()); // fallback text = raw TeX, so the reader sees it sans KaTeX
  return `<span class="mp-math" data-display="${display ? 1 : 0}" data-tex="${t}">${t}</span>`;
}

function renderBlock(block) {
  const b = block.trim();
  if (!b) return "";
  // A block that is exactly one block-level placeholder (code fence / display
  // math) → emit it directly, not wrapped in <p>.
  if (/^\uE000\d+\uE001$/.test(b)) return b;

  const h = b.match(/^(#{1,6})\s+(.*)$/);
  if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;

  const lines = b.split("\n");
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
  }
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
    return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
  }
  return `<p>${lines.map(inline).join("<br>")}</p>`;
}

// Inline: escape first, then apply emphasis on the escaped text. Placeholders
// (PUA) and escaped entities pass through the emphasis regexes untouched, so no
// escaped `&lt;script&gt;` can be reconstituted into a tag.
function inline(text) {
  let t = esc(text);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/(^|[^A-Za-z0-9])_([^_]+)_(?=[^A-Za-z0-9]|$)/g, "$1<em>$2</em>");
  return t;
}
