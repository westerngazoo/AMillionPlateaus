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


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Match GitHub Pages: the PWA manifest gets its real MIME (SPEC-0047).
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # no-cache = revalidate every time (the server answers 200 with fresh
        # bytes; no stale module/wasm ever survives a reload).
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"fog-world → http://localhost:{PORT}  (serving {os.path.abspath(ROOT)}, no-cache)")
        httpd.serve_forever()
