# pair-relay — cross-device "Scan Note" transport (R-0058)

A tiny Cloudflare Worker + Durable Object that lets your **phone (or Boox) send a
photo to your desktop** across any network. It's the missing piece of the QR note
capture (R-0045): the QR and camera page already work; this carries the image.

It is a **dumb byte forwarder** — a phone and a desktop each open a WebSocket to
`wss://…/room/<roomId>`, and the Durable Object for that room passes the
(size-capped, ~256 KB JPEG) bytes from one to the other. **Nothing is stored, no
auth, no accounts.** The note still lives only on your desktop (IndexedDB); the
relay never touches the graph, the CRDT, or reputation.

## Why a relay at all

The app runs at **HTTPS** `plateaus.goosethropic.systems`, so the capture page
(same origin) can only reach **WSS** endpoints, and plain WebRTC across two
different networks fails without a TURN server. A one-hop WSS relay works
everywhere — phone on cellular, Boox on Wi-Fi, desktop wherever.

## Deploy (one time, ~2 minutes, free)

```sh
cd workers/pair-relay
npx wrangler login        # once, opens your Cloudflare in a browser
npx wrangler deploy
```

`wrangler deploy` prints the URL, e.g. `https://mp-pair-relay.<your-subdomain>.workers.dev`.

- **Free plan is fine.** Durable Objects run on the Workers Free plan (SQLite
  backend, which this uses) and the WebSocket **Hibernation API** means an idle
  room — a QR on screen, waiting for you to snap the photo — costs nothing.
- Optional: put it on your own domain by adding a route in `wrangler.jsonc` and
  the Cloudflare dashboard (e.g. `pair.plateaus.goosethropic.systems`).

## Point the app at it

Take the deployed URL and set it in the app (once). Either:

- **Edit the default** in [`apps/web/src/pair-relay.js`](../../apps/web/src/pair-relay.js) —
  set `DEFAULT_PAIR_RELAY` to your `wss://…workers.dev` URL (use `wss://`, not
  `https://`), commit, and it ships for every device; **or**
- **Set it per-browser** without editing code — in the desktop app's console:
  `localStorage.setItem("mp.pairRelayUrl", "wss://mp-pair-relay.<sub>.workers.dev")`.

That's it. Open a topic → **Scan Note (QR)** → scan with your phone → take the
photo → it appears on your desktop. The desktop encodes the relay URL into the QR,
so the phone needs no configuration.

## Behaviour / limits

- **Ephemeral.** A room is just the two live sockets; when both disconnect it's
  gone. Room ids are short-lived (a fresh one per QR).
- **One phone + one desktop** per room (a third connection is refused).
- **Frames capped** at ~300 KB (above the app's 256 KB image cap); larger frames
  are rejected, not relayed.
- **No fallback loss.** If no relay URL is configured, the app degrades to the
  same-browser `BroadcastChannel` path (two tabs on one machine) and, failing
  that, shows the capture URL as copyable text — exactly as before.
- `--selftest` isn't applicable (this is edge-runtime code); the pairing framing
  is unit-tested in `apps/web/src/pair-relay.test.mjs`, and `npx wrangler dev`
  runs it locally against `ws://127.0.0.1:8787/room/<id>`.
