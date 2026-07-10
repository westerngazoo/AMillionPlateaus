// library.js — the personal library (R-0051): pin YOUR OWN PDFs to a plateau,
// and make Drive links readable in the split pane.
//
// Local-first by design: a picked PDF's bytes go into THIS browser's IndexedDB
// media store (same store as the QR note photos) and never leave the device —
// the CRDT syncs only the resource row (title + resource://local/ URI), so
// other devices see the row honestly labelled as stored elsewhere. No cloud
// account, no upload, works fully offline (the Boox case: the PDFs already
// live on the device).
//
// PURE: validation + URL rewriting only — no DOM, no IndexedDB handles. The
// impure edges (file input, media store, iframe) live in main.js glue.
// Tested in library.test.mjs.

// Bytes cap for a pinned PDF. IndexedDB holds hundreds of MB happily, but the
// media store is shared with note photos and quota errors are per-origin —
// 25 MB covers papers and book chapters while keeping a stray 800 MB scan out.
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

const mb = (n) => (n / (1024 * 1024)).toFixed(1);

/**
 * Validate a picked file as a pinnable PDF. Duck-typed ({name, type, size})
 * so tests need no real File. Accepts by MIME or by .pdf extension — Boox/
 * Android file managers sometimes hand over PDFs with a blank or generic type.
 * Returns { ok: true, title } (title = filename sans extension) or
 * { ok: false, error } with an honest, actionable message.
 */
export function pdfCheck(file) {
  if (!file) return { ok: false, error: "No file picked." };
  const name = String(file.name ?? "");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
  if (!isPdf) return { ok: false, error: `"${name || "that file"}" doesn't look like a PDF.` };
  if (!file.size) return { ok: false, error: `"${name}" is empty (0 bytes).` };
  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      error: `"${name}" is ${mb(file.size)} MB — the cap is ${mb(MAX_PDF_BYTES)} MB so one scan can't eat the app's whole storage quota.`,
    };
  }
  const title = name.replace(/\.pdf$/i, "").trim() || "Untitled PDF";
  return { ok: true, title };
}

/**
 * The embeddable form of a link for the split-view pane. Google Drive refuses
 * to render its normal /view (and open?id=) pages inside an iframe
 * (X-Frame-Options), but serves the SAME file at /preview, which is built for
 * embedding — so a pinned Drive PDF becomes readable side-by-side with the
 * topic. Anything unrecognised (including garbage) passes through unchanged.
 */
export function frameableURL(href) {
  try {
    const u = new URL(href);
    if (u.hostname === "drive.google.com") {
      const m = u.pathname.match(/^\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
      const id = u.searchParams.get("id");
      if ((u.pathname === "/open" || u.pathname === "/uc") && id) {
        return `https://drive.google.com/file/d/${id}/preview`;
      }
    }
    return href;
  } catch {
    return href;
  }
}

/**
 * What (if anything) a clicked link should load into the split reader pane.
 * Returns null → let the browser handle the click normally (new tab / no-op).
 * Returns { src, sandboxed } → intercept and load `src` in the pane:
 *   - http(s) links load in their embeddable form, SANDBOXED (untrusted web);
 *   - blob: links (a device-local PDF, R-0051) load UNsandboxed — Chromium's
 *     built-in PDF viewer refuses to render inside a sandboxed iframe, and the
 *     blob is the learner's own file, already openable in a plain tab. This is
 *     what makes a local book on the Boox readable beside its topic.
 * Only the split layout intercepts; every other layout returns null.
 */
export function paneTarget(href, layout) {
  if (layout !== "split" || !href) return null;
  if (href.startsWith("blob:")) return { src: href, sandboxed: false };
  if (/^https?:\/\//i.test(href)) return { src: frameableURL(href), sandboxed: true };
  return null; // mailto:, relative, javascript: (already sanitised upstream) …
}
