// markdown.test.mjs — node --test, no DOM. Proves the plateau-body renderer is
// injection-safe (R-0020 AC4): the output is HTML built only from an allowlist of
// tags/attributes, every text run escaped, link/resource schemes whitelisted, and
// math handed off as an inert escaped placeholder. Bodies arrive from untrusted
// synced/imported peers, so the security battery is the heart of this suite.
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown, esc, safeHref } from "./markdown.js";

// ── Structural allowlist: scan the output for every tag + attribute name and
// assert each is in the allowed set. This makes "safe by construction" a CHECKED
// invariant, not an example. Attribute values never contain a literal `"`/`>`
// (esc() escapes them), so the naive scan is sound for this renderer's output.
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br",
  "strong", "em", "code", "pre", "ul", "ol", "li", "a", "span",
]);
const ALLOWED_ATTRS = new Set(["href", "rel", "target", "class", "data-display", "data-tex"]);

function scan(html) {
  const tags = new Set();
  const attrs = new Set();
  for (const m of html.matchAll(/<\/?([a-z][a-z0-9]*)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/gi)) {
    tags.add(m[1].toLowerCase());
    for (const a of m[2].matchAll(/([a-z-]+)=/gi)) attrs.add(a[1].toLowerCase());
  }
  return { tags, attrs };
}

test("renders the supported Markdown subset", () => {
  const html = renderMarkdown(
    "# Title\n\nA **bold** and *italic* and `code` line.\n\n- one\n- two\n\n[site](https://example.com)",
  );
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<a href="https:\/\/example\.com" rel="noopener noreferrer" target="_blank">site<\/a>/);
});

test("ordered lists and fenced code blocks", () => {
  assert.match(renderMarkdown("1. a\n2. b"), /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  const code = renderMarkdown("```js\nlet x = 1 < 2;\n```");
  assert.match(code, /<pre><code>let x = 1 &lt; 2;<\/code><\/pre>/);
});

test("output is deterministic", () => {
  const src = "# H\n\n$E=mc^2$ and [x](https://a.b) and `c`";
  assert.equal(renderMarkdown(src), renderMarkdown(src));
});

test("STRUCTURAL allowlist — only allowed tags + attributes are ever emitted (AC4)", () => {
  // A kitchen-sink body mixing every construct + hostile bits.
  const html = renderMarkdown(
    "# H1\n\n## H2\n\ntext **b** _i_ `c`\n\n- li\n\n1. oi\n\n" +
      "[ok](https://ok.com) [bad](javascript:alert(1))\n\n" +
      "$a_b$\n\n$$\\int_0^1 x\\,dx$$\n\n```\ncode <here>\n```\n\n" +
      "<script>alert(1)</script> <img src=x onerror=alert(1)>",
  );
  const { tags, attrs } = scan(html);
  for (const t of tags) assert.ok(ALLOWED_TAGS.has(t), `unexpected tag <${t}> in output`);
  for (const a of attrs) assert.ok(ALLOWED_ATTRS.has(a), `unexpected attribute ${a} in output`);
  // The structural scan above is the real guarantee (no <script>/<img>/event-attr
  // tag can exist). The hostile inputs survive ONLY as escaped, inert text:
  assert.doesNotMatch(html, /<script/i); // no real <script (it's &lt;script&gt;)
  assert.doesNotMatch(html, /<img/i); // no real <img
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); // onerror is inert text, not an attribute
  // The dangerous-scheme link is NOT linkified (stays literal text).
  assert.match(html, /\[bad\]\(javascript:alert\(1\)\)/);
});

test("raw HTML / script is escaped to text, never a node (AC4)", () => {
  const html = renderMarkdown("hello <script>alert(1)</script> <b onclick='x'>z</b>");
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  // No REAL tags from the input survive — the `<b onclick=…>` is escaped TEXT, so
  // `onclick` is inert (`&lt;b onclick=&#39;x&#39;&gt;`), never a live attribute.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<b[\s>]/i);
  assert.match(html, /&lt;b onclick=&#39;x&#39;&gt;/);
});

test("safeHref — scheme whitelist applied to the control-stripped url (AC4, finding 2)", () => {
  // Safe.
  assert.equal(safeHref("https://a.b/c"), "https://a.b/c");
  assert.equal(safeHref("http://a.b"), "http://a.b");
  assert.equal(safeHref("mailto:x@y.z"), "mailto:x@y.z");
  // Dangerous schemes → null.
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "vbscript:msgbox(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)", // leading space
    "java\tscript:alert(1)", // interior tab
    "java\nscript:alert(1)", // interior newline
    "\u0001javascript:alert(1)", // leading control char
    "file:///etc/passwd",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeHref(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("a link with a dangerous scheme renders as inert literal text, no href (AC4)", () => {
  const html = renderMarkdown("[click](javascript:alert(document.cookie))");
  assert.doesNotMatch(html, /href=/);
  assert.doesNotMatch(html, /<a /);
  // The literal markdown shows as escaped text.
  assert.match(html, /\[click\]\(javascript:alert\(document\.cookie\)\)/);
});

test("math → inert .mp-math placeholder carrying the ESCAPED tex (AC4)", () => {
  const html = renderMarkdown("$E=mc^2$");
  assert.match(html, /<span class="mp-math" data-display="0" data-tex="E=mc\^2">E=mc\^2<\/span>/);
  const disp = renderMarkdown("$$\\int_0^1$$");
  assert.match(disp, /data-display="1"/);
});

test("LaTeX delimiters (R-0087): \\(…\\) inline and \\[…\\] display — what pasted Gemini answers use", () => {
  // inline
  const inline = renderMarkdown("pasted: \\(\\alpha \\cdot \\beta\\) done");
  assert.match(inline, /<span class="mp-math" data-display="0"[^>]*>\\alpha \\cdot \\beta<\/span>/);
  assert.doesNotMatch(inline, /\\\(/); // no raw delimiter survives
  // display, on its own block → emitted directly, not wrapped in <p>
  const disp = renderMarkdown("Before.\n\n\\[ c^2 = a^2 + b^2 - 2ab\\cos\\theta \\]\n\nAfter.");
  assert.match(disp, /data-display="1"/);
  assert.doesNotMatch(disp, /<p><span class="mp-math" data-display="1"/);
  assert.doesNotMatch(disp, /\\\[/);
  // a bracket-math block can NEVER half-match the link rule (extracted first)
  assert.doesNotMatch(renderMarkdown("\\[x\\](https://e.com)"), /<a /);
  // a script breakout inside \(…\) stays inert, exactly like the $ forms
  const evil = renderMarkdown("\\(x</span><script>alert(1)</script>\\)");
  assert.doesNotMatch(evil, /<script/i);
  assert.match(evil, /data-tex="x&lt;\/span&gt;&lt;script&gt;/);
  // all four delimiter forms coexist in one body
  const mixed = renderMarkdown("$a$ and \\(b\\) and $$c$$ and \\[d\\]");
  assert.equal((mixed.match(/class="mp-math"/g) || []).length, 4);
});

test("a script breakout inside $…$ stays inert as an escaped attribute value (AC4, finding 3)", () => {
  const html = renderMarkdown('$x</span><script>alert(1)</script>$');
  // The payload is escaped INSIDE the data-tex attribute — never a sibling node.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<\/span><script/i);
  assert.match(html, /data-tex="x&lt;\/span&gt;&lt;script&gt;/);
});

test("math is extracted before inline parsing — * _ ` inside $…$ round-trip unmangled (AC4)", () => {
  const html = renderMarkdown("$a_b * c `d`$");
  // No emphasis/code tags inside the math; the tex is one escaped attribute.
  assert.match(html, /data-tex="a_b \* c `d`"/);
  assert.doesNotMatch(html, /<em>/);
  assert.doesNotMatch(html, /<code>/);
});

test("esc escapes the five HTML-significant characters", () => {
  assert.equal(esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

test("empty / nullish body renders to empty string (no crash)", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(null), "");
  assert.equal(renderMarkdown(undefined), "");
});

test("images (R-0077): https + base64 raster data URIs render; everything else is inert", () => {
  // https image with an XSS-attempt alt — alt escapes, tag renders
  const ok = renderMarkdown('![my "boox" <note>](https://example.com/page.png)');
  assert.match(ok, /<img src="https:\/\/example\.com\/page\.png" alt="my &quot;boox&quot; &lt;note&gt;" loading="lazy" \/>/);
  // base64 raster data URI renders — WITHOUT loading="lazy" (a lazy offscreen
  // data: URI never loads; its bytes are already inline)
  const dataOk = renderMarkdown("![n](data:image/jpeg;base64,AAAA)");
  assert.match(dataOk, /<img src="data:image\/jpeg;base64,AAAA"/);
  assert.doesNotMatch(dataOk, /loading=/);
  assert.match(renderMarkdown("![n](data:image/png;base64,AAAA)"), /<img /);
  // hostile sources render as escaped literal text, never a tag
  for (const bad of [
    "![x](javascript:alert(1))",
    "![x](data:text/html;base64,PHNjcmlwdD4=)",
    "![x](data:image/svg+xml;base64,PHN2Zz4=)", // svg can script — excluded
    "![x](http://insecure.example/x.png)", // mixed content — excluded
    "![x](data:image/png,notbase64)",
  ]) {
    const html = renderMarkdown(bad);
    assert.doesNotMatch(html, /<img/, `no <img> for ${bad}`);
    assert.match(html, /!\[x\]/, `inert literal survives for ${bad}`);
  }
  // control-char smuggling in the scheme is stripped-then-rejected
  assert.doesNotMatch(renderMarkdown("![x](java\tscript:alert(1))"), /<img|<a /);
  // an image does NOT half-match as a link with a stray "!"
  assert.doesNotMatch(renderMarkdown("![n](https://e.com/i.png)"), /<a /);
});
