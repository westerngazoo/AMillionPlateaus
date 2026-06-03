// eventbus.js — second BroadcastChannel for cross-tab signed events
// (SPEC-0010 §2.3, R-0010 AC4). Carries ONLY signed `NostrEvent` JSON between
// same-origin tabs so two local clients converge with no relay.
//
// This is a SEPARATE channel from the CRDT graph-sync channel ("mp-graph-sync",
// see sync.js), which still carries only Automerge bytes. Signed events, reputation
// and keys never ride the CRDT (CLAUDE.md §7); they ride here (cross-tab) and the
// relay (cross-host). The receiver verify-gates every event through the local log,
// so an unsigned message off this channel contributes nothing.

const CHANNEL = "mp-nostr-events";

/// Wire a BroadcastChannel for signed-event JSON. `onEvent(json)` fires for each
/// peer message. Returns `{ broadcast, close }`; call `broadcast(json)` after
/// signing a local event to ship it to the other tab.
export function createEventBus(onEvent) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e) => {
    if (typeof e.data === "string") onEvent(e.data);
  };
  return {
    broadcast: (json) => channel.postMessage(json),
    close: () => channel.close(),
  };
}
