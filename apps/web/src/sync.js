// sync.js — BroadcastChannel ↔ WasmSyncSession pump (R-0005 AC6/AC7).
//
// A single same-origin channel stands in for the Phase-5 relay. The channel
// carries ONLY CRDT bytes produced by `doc.generate_message` — never the local
// reputation/fog state (AC7). Both tabs run an identical pump; with exactly two
// tabs each treats "the channel" as its one peer (one WasmSyncSession per tab).

const CHANNEL = "mp-graph-sync";

/// Wire a doc+session to a BroadcastChannel. `onRemote` is called after a peer
/// message has been applied, so the caller can re-render. Returns `{ pump,
/// close }`; call `pump()` after every LOCAL edit to ship the change.
export function createSync(doc, session, onRemote) {
  const channel = new BroadcastChannel(CHANNEL);

  function pump() {
    let msg;
    // Uint8Array is structured-clone transferable over BroadcastChannel.
    while ((msg = doc.generate_message(session)) !== undefined) {
      channel.postMessage(msg);
    }
  }

  channel.onmessage = (e) => {
    doc.receive_message(session, new Uint8Array(e.data));
    pump(); // a received change may unblock more to send
    onRemote();
  };

  return {
    pump,
    close: () => channel.close(),
  };
}
