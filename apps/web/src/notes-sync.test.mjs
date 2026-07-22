// notes-sync.test.mjs — node --test, pure (R-0075).
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRepo,
  noteFilePath,
  b64EncodeUtf8,
  b64DecodeUtf8,
  b64FromBytes,
  bytesFromB64,
  WORLD_FILE,
  ghHeaders,
} from "./notes-sync.js";

test("parseRepo accepts owner/repo, full URLs, .git and trailing slashes; rejects junk", () => {
  assert.deepEqual(parseRepo("goose/plateaus-notes"), { owner: "goose", repo: "plateaus-notes" });
  assert.deepEqual(parseRepo("https://github.com/goose/plateaus-notes"), { owner: "goose", repo: "plateaus-notes" });
  assert.deepEqual(parseRepo("https://github.com/goose/plateaus-notes.git/"), { owner: "goose", repo: "plateaus-notes" });
  assert.deepEqual(parseRepo("  goose/notes.repo_x  "), { owner: "goose", repo: "notes.repo_x" });
  assert.equal(parseRepo("just-a-name"), null);
  assert.equal(parseRepo("a//b"), null);
  assert.equal(parseRepo(""), null);
  assert.equal(parseRepo(null), null);
});

test("noteFilePath: readable slug + stable id suffix, diacritics folded, capped", () => {
  assert.equal(
    noteFilePath("Rotors: Rotation without Matrices", "90000000-0000-0000-0000-000000000003"),
    "notes/rotors-rotation-without-matrices--90000000.md",
  );
  assert.equal(noteFilePath("Ecuación de Möbius", "abcd1234-x"), "notes/ecuacion-de-mobius--abcd1234.md");
  assert.match(noteFilePath("x".repeat(200), "id"), /^notes\/x{60}--id\.md$/);
  assert.equal(noteFilePath("", ""), "notes/topic--x.md");
});

test("base64 round-trips UTF-8 (accents, math symbols, emoji)", () => {
  const s = "∇F = J — ecuación, ½(ab−ba) ✓ 📜";
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s)), s);
  assert.equal(b64EncodeUtf8(""), "");
  // GitHub wraps base64 with newlines — decoder must tolerate them
  const b = b64EncodeUtf8("hello world hello world");
  const wrapped = `${b.slice(0, 10)}\n${b.slice(10)}`;
  assert.equal(b64DecodeUtf8(wrapped), "hello world hello world");
});

test("binary base64 (R-0081): round-trips raw graph-snapshot bytes, incl. >127 and chunk edges", () => {
  // every byte value 0..255 — a text base64 would mangle the high bytes
  const all = new Uint8Array(256);
  for (let i = 0; i < 256; i++) all[i] = i;
  assert.deepEqual([...bytesFromB64(b64FromBytes(all))], [...all]);
  // spans the 0x8000 chunk boundary without corruption
  const big = new Uint8Array(0x8000 * 2 + 5).map((_, i) => (i * 7) & 0xff);
  assert.deepEqual([...bytesFromB64(b64FromBytes(big))], [...big]);
  // empty + nullish are safe
  assert.equal(b64FromBytes(new Uint8Array()), "");
  assert.equal(bytesFromB64("").length, 0);
  assert.equal(b64FromBytes(null), "");
  // accepts a plain array too
  assert.deepEqual([...bytesFromB64(b64FromBytes([1, 2, 250]))], [1, 2, 250]);
});

test("WORLD_FILE is a single stable path under world/", () => {
  assert.equal(WORLD_FILE, "world/graph.mpworld");
});

test("ghHeaders carries the token as a Bearer + the GitHub API version", () => {
  const h = ghHeaders("tok_x");
  assert.equal(h.Authorization, "Bearer tok_x");
  assert.match(h.Accept, /vnd\.github/);
  assert.ok(h["X-GitHub-Api-Version"]);
});
