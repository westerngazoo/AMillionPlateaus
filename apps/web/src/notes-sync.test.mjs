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
  GITHUB_API,
  normalizeForgeBase,
  repoApiUrl,
  contentsApiUrl,
  parseRepoUrl,
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

test("forge base (R-0086): normalize — empty→GitHub, bare hosts get https, /api/v1 stripped", () => {
  assert.equal(normalizeForgeBase(""), GITHUB_API);
  assert.equal(normalizeForgeBase("  "), GITHUB_API);
  assert.equal(normalizeForgeBase("github.com"), GITHUB_API);
  assert.equal(normalizeForgeBase("https://api.github.com/"), GITHUB_API);
  assert.equal(normalizeForgeBase("gitea.goosethropic.systems"), "https://gitea.goosethropic.systems");
  assert.equal(normalizeForgeBase("https://gitea.example.com/api/v1/"), "https://gitea.example.com");
  assert.equal(normalizeForgeBase("http://localhost:3000/"), "http://localhost:3000");
});

test("forge URLs (R-0086): GitHub is bare /repos, Gitea nests under /api/v1; subpaths survive", () => {
  assert.equal(repoApiUrl(GITHUB_API, "me", "world"), "https://api.github.com/repos/me/world");
  assert.equal(repoApiUrl("", "me", "world"), "https://api.github.com/repos/me/world"); // legacy cfg without base
  assert.equal(repoApiUrl("https://gitea.example.com", "me", "world"), "https://gitea.example.com/api/v1/repos/me/world");
  assert.equal(
    contentsApiUrl("https://gitea.example.com", "me", "world", "world/graph.mpworld", "main"),
    "https://gitea.example.com/api/v1/repos/me/world/contents/world/graph.mpworld?ref=main",
  );
  assert.equal(
    contentsApiUrl(GITHUB_API, "me", "world", "notes/a.md"),
    "https://api.github.com/repos/me/world/contents/notes/a.md", // PUT form: no ref
  );
});

test("parseRepoUrl (R-0086): bare + github.com → GitHub; other forges keep origin + subpath", () => {
  assert.deepEqual(parseRepoUrl("me/world"), { base: GITHUB_API, owner: "me", repo: "world" });
  assert.deepEqual(parseRepoUrl("https://github.com/me/world.git/"), { base: GITHUB_API, owner: "me", repo: "world" });
  assert.deepEqual(parseRepoUrl("https://gitea.example.com/ada/plateaus-world"), {
    base: "https://gitea.example.com",
    owner: "ada",
    repo: "plateaus-world",
  });
  // Gitea under a subpath: base keeps the prefix, last two segments are owner/repo
  assert.deepEqual(parseRepoUrl("https://host.example/gitea/ada/world/"), {
    base: "https://host.example/gitea",
    owner: "ada",
    repo: "world",
  });
  assert.equal(parseRepoUrl("https://gitea.example.com/onlyowner"), null);
  assert.equal(parseRepoUrl("not a repo"), null);
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
