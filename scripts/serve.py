#!/usr/bin/env python3
"""Dev server for the fog-world (apps/web) with caching DISABLED.

Plain `python3 -m http.server` lets the browser cache ES modules and the wasm
binary, which serves a STALE app after rebuilds/edits (we kept hopping ports to
bust it). This sends `Cache-Control: no-cache` on everything, so a normal reload
always picks up the latest main.js / pkg / blobs — one stable port forever.

Usage:  python3 scripts/serve.py [port]     (default 8143)
Serves: apps/web  (relative to the repo root, wherever you run it from)
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8143
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web")
EXPORT_PATH = os.path.join(ROOT, "export", "world.bin")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # no-cache = revalidate every time (the server answers 200 with fresh
        # bytes; no stale module/wasm ever survives a reload).
        self.send_header("Cache-Control", "no-cache")
        # Dev-only: allow the browser to PUT the CRDT blob for Godot hot-sync.
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_PUT(self):
        if self.path != "/dev/world.bin":
            self.send_error(404, "not found")
            return
        length = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(length)
        os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
        with open(EXPORT_PATH, "wb") as f:
            f.write(data)
        self.send_response(204)
        self.end_headers()
        print(f"[dev] world.bin updated ({len(data)} bytes) → Godot can reload")


if __name__ == "__main__":
    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"fog-world → http://localhost:{PORT}  (serving {os.path.abspath(ROOT)}, no-cache)")
        print(f"Godot sync → {EXPORT_PATH}  (PUT /dev/world.bin from the browser)")
        httpd.serve_forever()
