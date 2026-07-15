// qr.test.mjs — node --test, pure. Structural checks on the vendored QR encoder
// (issue #73). Decodability (a phone can actually scan it) is proven separately
// by rendering + BarcodeDetector in the browser; these pin the geometry so a
// gross regression (missing finder, wrong size, broken timing) fails fast.
import test from "node:test";
import assert from "node:assert/strict";
import { qrMatrix } from "./vendor/qr/index.js";

// The 7×7 finder ring pattern the spec places in three corners.
function isFinder(m, r, c) {
  for (let dr = 0; dr < 7; dr++)
    for (let dc = 0; dc < 7; dc++) {
      const dark =
        dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
      if (m[r + dr][c + dc] !== dark) return false;
    }
  return true;
}

test("qrMatrix returns a square boolean matrix at a valid QR size", () => {
  const m = qrMatrix("https://example.com/capture.html#a1b2c3d4");
  assert.ok(Array.isArray(m) && m.length > 0);
  const size = m.length;
  assert.ok(m.every((row) => Array.isArray(row) && row.length === size));
  assert.ok(m.flat().every((v) => typeof v === "boolean"));
  assert.equal((size - 17) % 4, 0, "size must be 4·version + 17");
  assert.ok(size >= 21 && size <= 37, "version 1–5");
});

test("the three finder patterns are present at the corners", () => {
  const m = qrMatrix("hello");
  const size = m.length;
  assert.ok(isFinder(m, 0, 0), "top-left");
  assert.ok(isFinder(m, 0, size - 7), "top-right");
  assert.ok(isFinder(m, size - 7, 0), "bottom-left");
});

test("timing patterns alternate along row and column 6", () => {
  const m = qrMatrix("test");
  const size = m.length;
  for (let i = 8; i < size - 8; i++) {
    assert.equal(m[6][i], i % 2 === 0, `row-6 timing at ${i}`);
    assert.equal(m[i][6], i % 2 === 0, `col-6 timing at ${i}`);
  }
});

test("the mandatory dark module is set at (4·version+9, 8)", () => {
  const m = qrMatrix("x");
  assert.equal(m[m.length - 8][8], true);
});

test("encoding is deterministic", () => {
  const url = "https://plateaus.goosethropic.systems/capture.html#deadbeef";
  assert.deepEqual(qrMatrix(url), qrMatrix(url));
});

test("version grows with payload length", () => {
  const small = qrMatrix("hi").length;
  const big = qrMatrix("x".repeat(90)).length;
  assert.ok(big > small, `${big} should exceed ${small}`);
});

test("a realistic capture URL fits within version 5", () => {
  const url = "https://plateaus.goosethropic.systems/capture.html#a1b2c3d4";
  assert.ok(qrMatrix(url).length <= 37);
});

test("throws past version-5 capacity so the caller can degrade to text", () => {
  assert.throws(() => qrMatrix("x".repeat(200)), /exceeds version-5/);
});

// Golden snapshot: the EXACT matrix for "hi", captured from this encoder after it
// was verified end-to-end — rendered and decoded back to "hi" by the browser's
// BarcodeDetector. It pins every stage (byte encoding, Reed–Solomon ECC, module
// placement, mask selection, format info). Any regression that would make the
// code unscannable changes these bits and fails here, where `node --test` can see
// it — the whole point of #73's guard (a broken QR must be a red test, not a
// silently-degraded "Scan Note" button in production).
test("hi encodes to the exact decode-verified golden matrix (#73 regression guard)", () => {
  const GOLDEN =
    "111111100100101111111 100000101001001000001 101110100100001011101 " +
    "101110101001001011101 101110100011101011101 100000101110101000001 " +
    "111111101010101111111 000000000011100000000 111110111100110101010 " +
    "101001000010100100001 010001110011010011110 111101010000000110100 " +
    "101011100101010010101 000000001011111001001 111111101000101100010 " +
    "100000100111111001001 101110101010100100100 101110101100100100100 " +
    "101110101001010011100 100000101100000110100 111111101111010011110";
  const actual = qrMatrix("hi").map((r) => r.map((v) => (v ? 1 : 0)).join("")).join(" ");
  assert.equal(actual, GOLDEN);
});
