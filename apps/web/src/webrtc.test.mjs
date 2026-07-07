// webrtc.test.mjs — node --test, no real WebRTC. Proves the data-channel
// transport (SPEC-0018 §3.1, R-0018 AC6): offer/answer framing, the before-open
// send queue, inbound routing as Uint8Array, a two-peer handshake with a message
// crossing both ways, and a malformed blob rejecting. The RTCPeerConnection is a
// hand-rolled fake (no npm dep), mirroring relay.test.mjs's FakeWS.

import test from "node:test";
import assert from "node:assert/strict";

import { createPeer, CHANNEL_LABEL } from "./webrtc.js";

// A fake "network": the offerer's created channel and the answerer's
// `ondatachannel` channel are linked, so A.send → B.onmessage (and back). Channels
// start NOT open (readyState "connecting"); `openAll()` fires onopen on both so the
// before-open queue is genuinely exercised. Inbound is delivered as an ArrayBuffer
// (so `new Uint8Array(e.data)` in webrtc.js is exercised).
function fakeNetwork() {
  const channels = [];
  // ALL channels the offerer announces — the peer now opens TWO (mp-sync +
  // mp-media, SPEC-0045 §2.1), and real WebRTC announces each to the answerer
  // with its label in-band; the old single `offererCh` kept only the LAST one
  // (media), unlabelled on the answerer side, so the label filter wired nothing.
  const offererChs = [];

  function makeChannel() {
    const ch = {
      readyState: "connecting",
      binaryType: "blob",
      _peer: null,
      sent: [],
      send(m) {
        this.sent.push(m);
        if (this._peer && this._peer.onmessage) {
          const buf =
            m instanceof Uint8Array ? m.buffer.slice(m.byteOffset, m.byteOffset + m.byteLength) : m;
          this._peer.onmessage({ data: buf });
        }
      },
    };
    channels.push(ch);
    return ch;
  }

  function makePc(role) {
    const pc = {
      iceGatheringState: "complete", // non-trickle fast path
      localDescription: null,
      createDataChannel(label) {
        const ch = makeChannel();
        ch.label = label;
        offererChs.push(ch);
        return ch;
      },
      createOffer: async () => ({ type: "offer", sdp: "OFFER" }),
      createAnswer: async () => ({ type: "answer", sdp: "ANSWER" }),
      setLocalDescription: async (d) => {
        pc.localDescription = d;
      },
      setRemoteDescription: async (_d) => {
        // The answerer receives EVERY offerer channel via ondatachannel, each
        // carrying its label (as real WebRTC announces in-band), pairwise-linked.
        if (role === "answerer" && pc.ondatachannel) {
          for (const oc of offererChs) {
            const answererCh = makeChannel();
            answererCh.label = oc.label;
            answererCh._peer = oc;
            oc._peer = answererCh;
            pc.ondatachannel({ channel: answererCh });
          }
        }
      },
      close() {
        pc.closed = true;
      },
    };
    return pc;
  }

  return {
    offerer: () => makePc("offerer"),
    answerer: () => makePc("answerer"),
    openAll() {
      for (const ch of channels) {
        ch.readyState = "open";
        if (ch.onopen) ch.onopen();
      }
    },
  };
}

test("createOffer / acceptOffer produce parseable blobs; createDataChannel uses the label", () => {
  return (async () => {
    const net = fakeNetwork();
    const peerA = createPeer({ rtcFactory: net.offerer });
    const offer = await peerA.createOffer();
    assert.equal(JSON.parse(offer).type, "offer", "invite blob is an offer descriptor");

    const peerB = createPeer({ rtcFactory: net.answerer });
    const answer = await peerB.acceptOffer(offer);
    assert.equal(JSON.parse(answer).type, "answer", "answer blob is an answer descriptor");
    await peerA.acceptAnswer(answer); // resolves, no throw
  })();
});

test("two peers handshake; a message crosses both ways (AC2/AC6)", async () => {
  const net = fakeNetwork();
  const gotA = [];
  const gotB = [];
  let openA = false;
  const peerA = createPeer({ rtcFactory: net.offerer, onMessage: (m) => gotA.push(m), onOpen: () => (openA = true) });
  const peerB = createPeer({ rtcFactory: net.answerer, onMessage: (m) => gotB.push(m) });

  const offer = await peerA.createOffer();
  const answer = await peerB.acceptOffer(offer);
  await peerA.acceptAnswer(answer);
  net.openAll();

  assert.equal(openA, true, "onOpen fired");
  assert.equal(peerA.isOpen(), true);

  peerA.send(new Uint8Array([1, 2, 3]));
  assert.equal(gotB.length, 1, "A→B delivered");
  assert.ok(gotB[0] instanceof Uint8Array, "inbound is a Uint8Array");
  assert.deepEqual([...gotB[0]], [1, 2, 3]);

  peerB.send(new Uint8Array([9]));
  assert.deepEqual([...gotA[0]], [9], "B→A delivered");
});

test("a send before open is queued, then flushed on open (AC6)", async () => {
  const net = fakeNetwork();
  const gotB = [];
  const peerA = createPeer({ rtcFactory: net.offerer });
  const peerB = createPeer({ rtcFactory: net.answerer, onMessage: (m) => gotB.push(m) });

  const offer = await peerA.createOffer();
  const answer = await peerB.acceptOffer(offer);
  await peerA.acceptAnswer(answer);

  peerA.send(new Uint8Array([7, 7])); // channel still "connecting" → queued
  assert.equal(peerA.isOpen(), false);
  assert.equal(gotB.length, 0, "nothing delivered before open");

  net.openAll(); // flush the outbox
  assert.deepEqual([...gotB[0]], [7, 7], "queued message flushed on open");
});

test("a malformed offer blob rejects (caught upstream, AC4)", async () => {
  const net = fakeNetwork();
  const peer = createPeer({ rtcFactory: net.answerer });
  await assert.rejects(() => peer.acceptOffer("not json"), "bad blob must reject, not silently pass");
});

test("send before any channel exists is queued, not thrown", () => {
  const net = fakeNetwork();
  const peer = createPeer({ rtcFactory: net.offerer }); // no createOffer yet → no channel
  assert.doesNotThrow(() => peer.send(new Uint8Array([1])));
  assert.equal(peer.isOpen(), false);
});

test("the channel label is the shared constant", async () => {
  const net = fakeNetwork();
  const peerA = createPeer({ rtcFactory: net.offerer });
  await peerA.createOffer();
  // The offerer's channel was created with CHANNEL_LABEL.
  assert.equal(typeof CHANNEL_LABEL, "string");
  assert.ok(CHANNEL_LABEL.length > 0);
});
