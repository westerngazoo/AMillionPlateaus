// imports.test.mjs — node --test, pure filesystem check. Every RELATIVE import
// specifier in the web app (static, re-export, or dynamic literal) must resolve
// to a real file on disk.
//
// Exists because of the #73 outage class: R-0045 shipped `qr.js` importing
// `./vendor/qr/index.js`, a file that was NEVER COMMITTED — the missing module
// failed main.js's whole import graph and the deployed app hung at "loading…".
// Node's test runner never imports the app entry, so nothing caught it. This
// test makes a dangling import a RED PR, not a production outage.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url)); // apps/web/
const SRC = join(WEB_ROOT, "src");

// No known exceptions. Issue #73 is fixed: `./vendor/qr/index.js` is a real,
// committed QR encoder, so `qr.js`'s import resolves. Any dangling import is now
// a hard failure (a missing file kills the whole module graph → boot hangs).
const KNOWN_MISSING = [];

// Static `import x from "spec"`, re-export `export ... from "spec"`, and
// dynamic `import("spec")` — literal specifiers only, which is all the app uses.
const SPEC_RE = /(?:import\s[^"']*?from\s*|export\s[^"']*?from\s*|import\s*\(\s*)["']([^"']+)["']/g;

function moduleFiles() {
  const files = readdirSync(SRC)
    .filter((f) => f.endsWith(".js"))
    .map((f) => join(SRC, f));
  files.push(join(WEB_ROOT, "sw.js")); // the service worker imports src/pwa.js
  return files;
}

test("every relative import in apps/web resolves to a file on disk (#73 class)", () => {
  const dangling = [];
  for (const file of moduleFiles()) {
    const rel = file.slice(WEB_ROOT.length); // e.g. "src/main.js"
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(SPEC_RE)) {
      const spec = match[1];
      if (!spec.startsWith("./") && !spec.startsWith("../")) continue; // bare/URL: not ours
      // pkg/ is the wasm-pack OUTPUT — gitignored by design, absent in the CI
      // checkout. The smoke job builds it and boots the app, so a broken pkg
      // import still fails CI — just in the job that actually has the artifact.
      if (/^\.\.?\/pkg\//.test(spec)) continue;
      if (existsSync(normalize(join(dirname(file), spec)))) continue;
      if (KNOWN_MISSING.some((k) => k.file === rel && k.spec === spec)) continue;
      dangling.push(`${rel} → ${spec}`);
    }
  }
  assert.deepEqual(
    dangling,
    [],
    `dangling imports (a missing file kills the whole module graph): ${dangling.join(", ")}`,
  );
});

test("the #73 exception list shrinks, never grows", () => {
  assert.ok(KNOWN_MISSING.length <= 1, "no new exceptions — commit the missing file instead");
  if (existsSync(join(SRC, "vendor/qr/index.js"))) {
    assert.equal(KNOWN_MISSING.length, 0, "#73 is fixed — delete the KNOWN_MISSING entry");
  }
});
