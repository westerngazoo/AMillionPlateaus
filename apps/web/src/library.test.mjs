// library.test.mjs — node --test, pure (R-0051). The personal library's two
// pure legs: PDF validation (duck-typed file) and the split-pane URL rewrite.

import test from "node:test";
import assert from "node:assert/strict";

import { MAX_PDF_BYTES, pdfCheck, frameableURL } from "./library.js";

test("pdfCheck: accepts by MIME and derives the title from the filename", () => {
  const r = pdfCheck({ name: "Sheaves in Geometry.pdf", type: "application/pdf", size: 1024 });
  assert.equal(r.ok, true);
  assert.equal(r.title, "Sheaves in Geometry");
});

test("pdfCheck: accepts by .pdf extension when the MIME type is blank/generic (Boox file managers)", () => {
  assert.equal(pdfCheck({ name: "notes.PDF", type: "", size: 10 }).ok, true);
  assert.equal(pdfCheck({ name: "notes.pdf", type: "application/octet-stream", size: 10 }).ok, true);
});

test("pdfCheck: rejects non-PDFs, empty files and missing picks with honest messages", () => {
  assert.equal(pdfCheck(null).ok, false);
  const notPdf = pdfCheck({ name: "photo.jpg", type: "image/jpeg", size: 10 });
  assert.equal(notPdf.ok, false);
  assert.match(notPdf.error, /doesn't look like a PDF/);
  const empty = pdfCheck({ name: "x.pdf", type: "application/pdf", size: 0 });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /empty/);
});

test("pdfCheck: rejects oversize with both sizes named (the honest quota story)", () => {
  const r = pdfCheck({ name: "scan.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 });
  assert.equal(r.ok, false);
  assert.match(r.error, /25\.0 MB/);
  assert.match(r.error, /scan\.pdf/);
});

test("pdfCheck: a bare '.pdf' filename still gets a usable title", () => {
  assert.equal(pdfCheck({ name: ".pdf", type: "application/pdf", size: 5 }).title, "Untitled PDF");
});

test("frameableURL: Drive /view and open?id= rewrite to the embeddable /preview", () => {
  assert.equal(
    frameableURL("https://drive.google.com/file/d/ABC123/view?usp=sharing"),
    "https://drive.google.com/file/d/ABC123/preview",
  );
  assert.equal(
    frameableURL("https://drive.google.com/open?id=XYZ9"),
    "https://drive.google.com/file/d/XYZ9/preview",
  );
  assert.equal(
    frameableURL("https://drive.google.com/uc?id=Q1&export=download"),
    "https://drive.google.com/file/d/Q1/preview",
  );
});

test("frameableURL: non-Drive links and garbage pass through unchanged", () => {
  assert.equal(frameableURL("https://example.com/a?b=c"), "https://example.com/a?b=c");
  assert.equal(frameableURL("https://drive.google.com/drive/folders/F1"), "https://drive.google.com/drive/folders/F1");
  assert.equal(frameableURL("not a url"), "not a url");
});
