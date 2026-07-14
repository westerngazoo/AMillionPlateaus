// vendor/qr/index.js — a minimal, dependency-free QR Code encoder (byte mode).
//
// Vendored per the project's zero-npm rule (issue #73): `qr.js` imports
// `qrMatrix` from here to draw the "Scan Note" pairing code. Implements the ISO/
// IEC 18004 algorithm from scratch — no library, no copyrighted code — scoped to
// exactly what the capture URL needs: 8-bit byte mode, error-correction level L,
// versions 1–5 (single error-correction block, so no block interleaving), all
// eight data masks chosen by the standard penalty. That spans up to ~106 bytes —
// far more than a `…/capture.html#<8 hex>` URL — and `qrMatrix` throws a clear
// error past it (the caller in qr.js degrades to a copyable text URL).
//
// `qrMatrix(text) → boolean[][]` — a square matrix, `true` = a dark module. Pure.

// ── GF(256) arithmetic (primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 = 0x11d) ──
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Reed–Solomon generator polynomial ∏(x − α^d), coefficients MSB-first
// (index 0 = leading x^degree coefficient = 1).
function rsGenPoly(degree) {
  let poly = [1];
  for (let d = 0; d < degree; d++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i]; // × x  (shift toward the leading term)
      next[i + 1] ^= gfMul(poly[i], EXP[d]); // × α^d
    }
    poly = next;
  }
  return poly; // length degree+1, leading coefficient 1
}

// Remainder of data·x^ecLen ÷ generator — the error-correction codewords.
function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    if (factor !== 0) for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ── Version table (error-correction level L, single block) ──────────────────
// { data: total data codewords, ec: error-correction codewords }. Versions 1–5
// are all a single EC block at level L, which is why no interleaving is needed.
const VERSIONS = {
  1: { data: 19, ec: 7 },
  2: { data: 34, ec: 10 },
  3: { data: 55, ec: 15 },
  4: { data: 80, ec: 20 },
  5: { data: 108, ec: 26 },
};
// Single alignment-pattern centre per version (none for v1). v2–5 each have
// exactly one, centred at (pos, pos).
const ALIGN_POS = { 1: null, 2: 18, 3: 22, 4: 26, 5: 30 };

const sizeOf = (version) => version * 4 + 17;

// ── Bit stream: byte-mode header + data + terminator + pad to capacity ──────
function makeDataCodewords(bytes, version) {
  const cap = VERSIONS[version].data;
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte-mode indicator
  push(bytes.length, 8); // char count (8 bits for versions 1–9, byte mode)
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, cap * 8 - bits.length)); // terminator (≤ 4 bits)
  while (bits.length % 8 !== 0) bits.push(0); // pad to a byte boundary

  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    words.push(byte);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; words.length < cap; i++) words.push(PAD[i % 2]);
  return words;
}

// ── Matrix scaffolding: function patterns + reserved mask ───────────────────
function blank(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function placeFinder(m, reserved, r, c, size) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      // 7×7 finder (concentric rings) with a 1-module light separator around it.
      const inFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const dark =
        inFinder &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      m[rr][cc] = dark;
      reserved[rr][cc] = true;
    }
  }
}

function placeAlignment(m, reserved, center, size) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const rr = center + dr;
      const cc = center + dc;
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      m[rr][cc] = ring === 0 || ring === 2; // dark centre + dark outer ring
      reserved[rr][cc] = true;
    }
  }
}

function buildFunctionPatterns(version) {
  const size = sizeOf(version);
  const m = blank(size);
  const reserved = blank(size);

  placeFinder(m, reserved, 0, 0, size);
  placeFinder(m, reserved, 0, size - 7, size);
  placeFinder(m, reserved, size - 7, 0, size);

  // Timing patterns — alternating modules along row 6 and column 6.
  for (let i = 8; i < size - 8; i++) {
    const on = i % 2 === 0;
    if (!reserved[6][i]) { m[6][i] = on; reserved[6][i] = true; }
    if (!reserved[i][6]) { m[i][6] = on; reserved[i][6] = true; }
  }

  if (ALIGN_POS[version] != null) placeAlignment(m, reserved, ALIGN_POS[version], size);

  // Dark module — always at (4·version + 9, 8).
  m[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Reserve the format-information areas (filled after masking).
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  return { m, reserved, size };
}

// ── Data placement: upward/downward zig-zag over unreserved modules ─────────
function placeData(m, reserved, codewords, size) {
  const bits = [];
  for (const w of codewords) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);

  let idx = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip the vertical timing column
    for (let r = 0; r < size; r++) {
      const row = up ? size - 1 - r : r;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (reserved[row][cc]) continue;
        m[row][cc] = idx < bits.length ? bits[idx++] === 1 : false;
      }
    }
    up = !up;
  }
}

// ── Masking ─────────────────────────────────────────────────────────────────
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (((r >> 1) + Math.floor(c / 3)) & 1) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) === 0,
  (r, c) => ((((r * c) % 2) + ((r * c) % 3)) & 1) === 0,
  (r, c) => ((((r + c) % 2) + ((r * c) % 3)) & 1) === 0,
];

function applyMask(m, reserved, maskFn, size) {
  const out = m.map((row) => row.slice());
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!reserved[r][c] && maskFn(r, c)) out[r][c] = !out[r][c];
  return out;
}

// Standard penalty (ISO/IEC 18004 §8.8.2) — lower is more scannable.
function penalty(m, size) {
  let score = 0;
  const line = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  line((a, b) => m[a][b]); // rows
  line((a, b) => m[b][a]); // columns

  // Rule 2: 2×2 blocks of one colour.
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1])
        score += 3;

  // Rule 3: finder-like 1:1:3:1:1 patterns preceded/followed by 4 light modules.
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let a = 0; a < size; a++) {
    for (let b = 0; b <= size - 11; b++) {
      const rowSeq = (k) => m[a][b + k];
      const colSeq = (k) => m[b + k][a];
      let m1r = true, m2r = true, m1c = true, m2c = true;
      for (let k = 0; k < 11; k++) {
        if (rowSeq(k) !== pat1[k]) m1r = false;
        if (rowSeq(k) !== pat2[k]) m2r = false;
        if (colSeq(k) !== pat1[k]) m1c = false;
        if (colSeq(k) !== pat2[k]) m2c = false;
      }
      if (m1r || m2r) score += 40;
      if (m1c || m2c) score += 40;
    }
  }

  // Rule 4: overall dark-module balance.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

// ── Format information: BCH(15,5) over (EC level L = 01) + 3-bit mask ───────
function formatBits(mask) {
  const data5 = (0b01 << 3) | mask; // level L = 01
  let bch = data5 << 10;
  for (let i = 14; i >= 10; i--) if ((bch >> i) & 1) bch ^= 0b10100110111 << (i - 10);
  return ((data5 << 10) | bch) ^ 0b101010000010010; // 15 bits, XOR the mask pattern
}

function placeFormat(m, format, size) {
  // ISO/IEC 18004 §7.9 placement. bit 14 = MSB, bit 0 = LSB. Copy 1 wraps the
  // top-left finder (vertical column 8 carries bits 0..7 low→high, horizontal
  // row 8 carries bits 14..7 high→low); copy 2 mirrors it across the top-right
  // and bottom-left. The timing line (row/col 6) is stepped over.
  const bit = (i) => ((format >> i) & 1) === 1;
  for (let i = 0; i < 8; i++) {
    const vbit = bit(i);
    const hbit = bit(14 - i);
    const off = i >= 6 ? 1 : 0; // hop over the timing pattern at index 6
    m[i + off][8] = vbit; // vertical, upper-left
    m[8][i + off] = hbit; // horizontal, upper-left
    m[8][size - 1 - i] = vbit; // horizontal, upper-right
    m[size - 1 - i][8] = hbit; // vertical, bottom-left
  }
  m[size - 8][8] = true; // dark module
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Encode `text` as a QR matrix. Returns `boolean[][]` (square, `true` = dark).
 * Byte mode, EC level L, smallest fitting version 1–5. Throws if the text is too
 * long for version 5 (~106 bytes) — the caller degrades to a copyable text URL.
 */
export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  let version = 0;
  for (let v = 1; v <= 5; v++) {
    // header (mode 4 bits + count 8 bits) + data + 4-bit terminator ≤ capacity
    if (12 + bytes.length * 8 + 4 <= VERSIONS[v].data * 8) { version = v; break; }
  }
  if (!version) throw new Error(`QR: ${bytes.length} bytes exceeds version-5 capacity`);

  const data = makeDataCodewords(bytes, version);
  const ec = rsEncode(data, VERSIONS[version].ec);
  const codewords = data.concat(ec); // single block → no interleaving

  const { m, reserved, size } = buildFunctionPatterns(version);
  placeData(m, reserved, codewords, size);

  // Choose the lowest-penalty mask, then stamp its format info.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(m, reserved, MASKS[mask], size);
    placeFormat(masked, formatBits(mask), size);
    const p = penalty(masked, size);
    if (!best || p < best.p) best = { p, masked };
  }
  return best.masked;
}
