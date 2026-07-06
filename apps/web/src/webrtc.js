// webrtc.js — a WebRTC data channel as a CRDT-sync pipe (SPEC-0018 / R-0018).
//
// PURE transport: it knows nothing of the doc/wasm — it ships and receives bytes,
// exactly like relay.js. Signaling is MANUAL and NON-TRICKLE (copy-paste one blob
// each way); there is NO signaling server. The data flows only over the direct
// peer-to-peer data channel; only SDP+ICE descriptors cross out-of-band. The
// RTCPeerConnection is INJECTED so the framing/queue/routing is unit-testable with
// a hand-rolled fake — no real WebRTC stack, no npm dependency.

export const CHANNEL_LABEL = "mp-sync";
export const MEDIA_CHANNEL_LABEL = "mp-media";

function defaultFactory() {
  // No data ever traverses a STUN/TURN server; an empty iceServers list works on
  // a LAN/loopback (host candidates). Only touched when actually invoked, so a
  // browser without WebRTC throws nothing until the user opts in.
  return new RTCPeerConnection({ iceServers: [] });
}

/// createPeer({ rtcFactory, onMessage, onOpen, onClose }) → a peer handle:
/// { createOffer, acceptOffer, acceptAnswer, send, isOpen, close }.
/// The offerer calls createOffer → (copy) → the answerer calls acceptOffer →
/// (copy back) → the offerer calls acceptAnswer. Once the channel opens, `send`
/// ships bytes (queued until open) and inbound bytes route to `onMessage`.
export function createPeer({
  rtcFactory = defaultFactory,
  onMessage = () => {},
  onMediaMessage = () => {},
  onOpen = () => {},
  onClose = () => {},
} = {}) {
  const pc = rtcFactory();
  let channel = null;
  let mediaChannel = null;
  const outbox = []; // bytes queued before the channel opens
  const mediaOutbox = [];

  function wire(ch) {
    channel = ch;
    ch.binaryType = "arraybuffer";
    ch.onopen = () => {
      for (const m of outbox.splice(0)) ch.send(m);
      onOpen();
    };
    ch.onmessage = (e) => onMessage(new Uint8Array(e.data));
    ch.onclose = () => onClose();
  }

  function wireMedia(ch) {
    mediaChannel = ch;
    ch.binaryType = "arraybuffer";
    ch.onopen = () => {
      for (const m of mediaOutbox.splice(0)) ch.send(m);
    };
    ch.onmessage = (e) => onMediaMessage(new Uint8Array(e.data));
  }

  // Resolve the full local SDP once ICE gathering completes (non-trickle), so the
  // single blob carries all candidates. The synchronous fast-path runs to
  // completion before any state-change event can dispatch, so the listener is
  // always attached before "complete" fires — no race, no hang.
  function gathered() {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve(pc.localDescription);
        return;
      }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") resolve(pc.localDescription);
      };
    });
  }

  return {
    /// Offerer: create the data channel + an invite blob to copy out.
    async createOffer() {
      wire(pc.createDataChannel(CHANNEL_LABEL));
      wireMedia(pc.createDataChannel(MEDIA_CHANNEL_LABEL));
      await pc.setLocalDescription(await pc.createOffer());
      return JSON.stringify(await gathered());
    },
    /// Answerer: ingest the invite, return an answer blob to copy back. The
    /// `ondatachannel` listener is registered BEFORE applying the remote offer.
    async acceptOffer(offerBlob) {
      pc.ondatachannel = (e) => {
        if (e.channel.label === CHANNEL_LABEL) wire(e.channel);
        else if (e.channel.label === MEDIA_CHANNEL_LABEL) wireMedia(e.channel);
      };
      await pc.setRemoteDescription(JSON.parse(offerBlob));
      await pc.setLocalDescription(await pc.createAnswer());
      return JSON.stringify(await gathered());
    },
    /// Offerer: complete the handshake with the answer blob.
    async acceptAnswer(answerBlob) {
      await pc.setRemoteDescription(JSON.parse(answerBlob));
    },
    /// Ship bytes over the channel, queueing until it opens. `send(Uint8Array)`.
    send(bytes) {
      if (channel && channel.readyState === "open") channel.send(bytes);
      else outbox.push(bytes);
    },
    sendMedia(bytes) {
      if (mediaChannel && mediaChannel.readyState === "open") mediaChannel.send(bytes);
      else mediaOutbox.push(bytes);
    },
    isOpen: () => channel?.readyState === "open",
    close: () => pc.close(),
  };
}
