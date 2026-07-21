// notes-sync.test.mjs — node --test, pure (R-0075).
import test from "node:test";
import assert from "node:assert/strict";
import { parseRepo, noteFilePath, b64EncodeUtf8, b64DecodeUtf8, ghHeaders } from "./notes-sync.js";

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

test("ghHeaders carries the token as a Bearer + the GitHub API version", () => {
  const h = ghHeaders("tok_x");
  assert.equal(h.Authorization, "Bearer tok_x");
  assert.match(h.Accept, /vnd\.github/);
  assert.ok(h["X-GitHub-Api-Version"]);
});
