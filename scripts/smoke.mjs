// smoke.mjs — does the REAL app boot in a REAL browser? (the gate the
// #73/#75/#76 outages proved node-only tests cannot be: a dangling import, a
// browser-only fetch binding, and an IndexedDB boot deadlock each passed
// `node --test` and still shipped a black screen.)
//
// Zero dependencies: drives the headless Chrome that GitHub runners (and dev
// machines) already have over the DevTools protocol, using Node's built-in
// WebSocket (Node >= 22). `--dump-dom --virtual-time-budget` was tried first
// and is NOT reliable here: virtual time skips past non-timer async work
// (wasm compile, IndexedDB), dumping while the HUD still says "loading…".
// This script instead POLLS the live page until the HUD proves boot+draw
// completed (it prints the topic count only after main() seeded the world and
// draw() painted), or times out red.
//
// Usage: node scripts/smoke.mjs [port]   (serve.py must already be running,
// apps/web/pkg built). scripts/smoke.sh wraps server+chrome lifecycle.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.argv[2] ?? "8151";
const APP_URL = `http://localhost:${PORT}/`;
const TIMEOUT_MS = 60_000;

const candidates = [
  process.env.CHROME_BIN,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const chrome = candidates.find((c) => existsSync(c));
if (!chrome) {
  console.error("smoke: no Chrome/Chromium found (set CHROME_BIN)");
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "mp-smoke-"));
// port=0: Chrome picks a free port and writes it to <profile>/DevToolsActivePort
// — the canonical handshake, immune to port contention on busy CI runners
// (a fixed port + short wait flaked with "endpoint never came up").
const proc = spawn(chrome, [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--no-first-run",
  `--user-data-dir=${profile}`,
  "--remote-debugging-port=0",
  "about:blank",
], { stdio: "ignore" });

const cleanup = (code, msg) => {
  proc.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  if (msg) (code ? console.error : console.log)(msg);
  process.exit(code);
};
setTimeout(() => cleanup(1, "smoke: FAIL — timed out; the app never left the loading state"), TIMEOUT_MS);

// Wait for the DevTools endpoint, open the page target, then poll the HUD.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

import { readFileSync } from "node:fs";
let debugPort = null;
for (let i = 0; i < 150 && !debugPort; i++) {
  await wait(200); // up to 30s — slow runners need it
  try {
    const line = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
    if (line) debugPort = Number(line);
  } catch {}
}
if (!debugPort) cleanup(1, "smoke: FAIL — Chrome never wrote DevToolsActivePort");

let target = null;
for (let i = 0; i < 50 && !target; i++) {
  await wait(200);
  try {
    const list = await fetch(`http://localhost:${debugPort}/json`).then((r) => r.json());
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (!target) cleanup(1, "smoke: FAIL — DevTools endpoint never answered on the advertised port");

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((r) => (ws.onopen = r));
await send("Page.enable");
await send("Page.navigate", { url: APP_URL });

for (;;) {
  await wait(1000);
  const res = await send("Runtime.evaluate", {
    expression: "document.getElementById('hud')?.textContent ?? ''",
    returnByValue: true,
  });
  const hud = res?.result?.result?.value ?? "";
  if (/\d+ topics ·/.test(hud)) {
    cleanup(0, `smoke: OK — app booted, world seeded, map drawn (hud: "${hud.slice(0, 60)}")`);
  }
  // A dead boot leaves "loading…" (or an error string) forever; keep polling
  // until the outer deadline turns that into a red exit.
}
