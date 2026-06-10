// katex.js — lazy, OFFLINE math typesetting from VENDORED KaTeX (R-0020/SPEC-0020).
//
// No CDN, no network: the assets live in apps/web/vendor/katex (see VENDOR.md) and
// are imported on first use only. markdown.js emits each `$…$`/`$$…$$` as an inert
//   <span class="mp-math" data-display="0|1" data-tex="…escaped…">…raw TeX…</span>
// whose text content is already the raw TeX — so if KaTeX is unavailable (asset
// missing, import fails), the reader still sees the source TeX and the read view
// never breaks. This module replaces that fallback text with typeset math when it
// can. trust:false disables \href/\url/\includegraphics; throwOnError:false renders
// an inline error node instead of throwing.

let katexPromise = null; // import once, reuse across opens
let cssInjected = false;

function ensureCss() {
  if (cssInjected || typeof document === "undefined") return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "vendor/katex/katex.min.css"; // relative to index.html (web root)
  document.head.appendChild(link);
  cssInjected = true;
}

/** Typeset every `.mp-math` placeholder under `root`. Idempotent-ish (already-
 *  typeset nodes are re-rendered harmlessly); never throws; never blocks. */
export async function typesetMath(root) {
  if (!root) return;
  const spans = root.querySelectorAll?.(".mp-math");
  if (!spans || spans.length === 0) return;

  let katex;
  try {
    katexPromise ??= import("../vendor/katex/katex.mjs");
    katex = (await katexPromise).default;
    ensureCss();
  } catch {
    return; // vendored KaTeX unavailable → placeholders keep showing raw TeX (AC5 fallback)
  }

  for (const el of spans) {
    const tex = el.getAttribute("data-tex") ?? el.textContent ?? "";
    try {
      katex.render(tex, el, {
        displayMode: el.getAttribute("data-display") === "1",
        throwOnError: false,
        trust: false,
      });
    } catch {
      el.textContent = tex; // never break the read view on a single bad expression
    }
  }
}
