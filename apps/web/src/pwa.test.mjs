// pwa.test.mjs — node --test, pure (SPEC-0047 §6). Proves the service worker's
// decision core: the AC4 bypass rules (the model-key path is never touched),
// the navigate/asset split, the cacheable() gate, the warm-list filter
// (architect BLOCKING-1), the vendor list's no-drift guarantee against the
// actual vendor directory (BLOCKING-2), and the localhost registration gate
// (MAJOR-5).

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CACHE_NAME,
  SHELL,
  PRECACHE,
  NAV_TIMEOUT_MS,
  VENDOR_WARM,
  classify,
  cacheable,
  isCode,
  warmList,
  shouldRegister,
} from "./pwa.js";

const ORIGIN = "https://westerngazoo.github.io";
const app = (path, mode = "no-cors") => ({ method: "GET", url: ORIGIN + path, mode });

test("non-GET requests are always bypassed (nothing with a body is ever cached)", () => {
  assert.equal(classify({ method: "POST", url: ORIGIN + "/x", mode: "cors" }, ORIGIN), "bypass");
  assert.equal(classify({ method: "PUT", url: ORIGIN + "/x", mode: "cors" }, ORIGIN), "bypass");
});

test("cross-origin GETs are bypassed — every model endpoint is out of reach (AC4)", () => {
  for (const url of [
    "https://api.anthropic.com/v1/chat/completions",
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    "http://localhost:11434/v1/chat/completions", // Ollama
    "http://localhost:1234/v1/chat/completions", // LM Studio
  ]) {
    assert.equal(classify({ method: "GET", url, mode: "cors" }, ORIGIN), "bypass");
  }
});

test("a malformed url is bypassed, never thrown on", () => {
  assert.equal(classify({ method: "GET", url: "not a url", mode: "cors" }, ORIGIN), "bypass");
});

test("same-origin navigations route network-first; subresources route SWR", () => {
  assert.equal(classify(app("/AMillionPlateaus/", "navigate"), ORIGIN), "navigate");
  assert.equal(classify(app("/AMillionPlateaus/src/main.js"), ORIGIN), "asset");
  assert.equal(classify(app("/AMillionPlateaus/pkg/mp_wasm_bg.wasm"), ORIGIN), "asset");
  assert.equal(classify(app("/AMillionPlateaus/vendor/katex/katex.min.css"), ORIGIN), "asset");
});

test("isCode flags JS/wasm (network-first) and nothing else (R-0062)", () => {
  // code → network-first, so a fresh shell never pairs with a stale module
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/src/main.js"), true);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/src/course-builder.mjs"), true);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/pkg/mp_wasm_bg.wasm"), true);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/pkg/mp_wasm.js"), true);
  // non-code → stays stale-while-revalidate (no cross-file export contract)
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/index.html"), false);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/vendor/katex/katex.min.css"), false);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/vendor/katex/fonts/KaTeX_Main-Regular.woff2"), false);
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/icons/icon-192.png"), false);
  // query strings / hashes don't fool the pathname test; garbage is never code
  assert.equal(isCode(ORIGIN + "/AMillionPlateaus/src/main.js?v=2"), true);
  assert.equal(isCode("not a url"), false);
});

test("cacheable() admits only healthy same-origin responses", () => {
  assert.equal(cacheable({ ok: true, type: "basic" }), true);
  assert.equal(cacheable({ ok: false, type: "basic" }), false); // 4xx/5xx
  assert.equal(cacheable({ ok: true, type: "opaque" }), false); // cross-origin no-cors
  assert.equal(cacheable(undefined), false);
});

test("one canonical shell key; the precache is drift-proof; the knobs are pinned", () => {
  assert.equal(SHELL, "./index.html");
  assert.deepEqual(PRECACHE, [SHELL, "./manifest.webmanifest"]);
  assert.ok(!PRECACHE.includes("./"), "no duplicate root entry beside the canonical shell");
  assert.ok(PRECACHE.every((p) => !/src\/|pkg\/|vendor\//.test(p)));
  assert.equal(CACHE_NAME, "mp-shell-v2"); // v2: code went network-first (R-0062) → activate purges skewed v1
  assert.equal(NAV_TIMEOUT_MS, 4000);
});

test("warmList keeps same-origin boot resources, drops the model call, dedups", () => {
  const entries = [
    { name: ORIGIN + "/AMillionPlateaus/src/main.js" },
    { name: ORIGIN + "/AMillionPlateaus/src/main.js" }, // dup
    { name: ORIGIN + "/AMillionPlateaus/pkg/mp_wasm_bg.wasm" },
    { name: "https://api.anthropic.com/v1/chat/completions" }, // the model POST in the perf buffer
    { name: "http://localhost:11434/v1/chat/completions" },
    { name: "garbage not a url" },
  ];
  const urls = warmList(entries, ORIGIN);
  assert.deepEqual(urls, [
    ORIGIN + "/AMillionPlateaus/src/main.js",
    ORIGIN + "/AMillionPlateaus/pkg/mp_wasm_bg.wasm",
  ]);
  assert.deepEqual(warmList(undefined, ORIGIN), []);
});

test("VENDOR_WARM matches the vendored KaTeX on disk — the list cannot drift (BLOCKING-2)", () => {
  const webRoot = fileURLToPath(new URL("..", import.meta.url));
  for (const rel of VENDOR_WARM) {
    assert.ok(existsSync(webRoot + rel.slice(2)), `${rel} exists on disk`);
  }
  const fonts = readdirSync(webRoot + "vendor/katex/fonts").filter((f) => f.endsWith(".woff2"));
  const listed = VENDOR_WARM.filter((u) => u.endsWith(".woff2")).map((u) => u.split("/").at(-1));
  assert.deepEqual(listed.sort(), fonts.sort(), "every woff2 in the vendor dir is warmed");
  assert.ok(VENDOR_WARM.includes("./vendor/katex/katex.mjs"), "the lazy import itself is warmed");
  assert.ok(VENDOR_WARM.includes("./vendor/katex/katex.min.css"));
});

test("shouldRegister: production yes; localhost only with the explicit ?sw=1 opt-in (MAJOR-5)", () => {
  assert.equal(shouldRegister({ hostname: "westerngazoo.github.io", search: "" }), true);
  assert.equal(shouldRegister({ hostname: "localhost", search: "" }), false);
  assert.equal(shouldRegister({ hostname: "127.0.0.1", search: "" }), false);
  assert.equal(shouldRegister({ hostname: "localhost", search: "?sw=1" }), true);
  assert.equal(shouldRegister({ hostname: "localhost", search: "?x=2&sw=1" }), true);
  assert.equal(shouldRegister({ hostname: "localhost", search: "?sw=10" }), false);
});
