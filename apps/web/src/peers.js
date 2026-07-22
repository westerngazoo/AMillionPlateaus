// peers.js — follow other wizards' worlds through their GitHub repo (R-0082). Pure.
//
// "Connect a peer" used to mean a live WebRTC handshake (copy-paste SDP blobs,
// same LAN, both online at once) — unusable across real devices. Following a repo
// instead is async and needs nothing live: you add a peer's PUBLIC repo, pull
// their world snapshot (R-0081's world/graph.mpworld), and CRDT-merge it onto your
// map. It's READ-ONLY — you pull their islands in; you never write to their repo.
// The merge is a union, so it only ever ADDS their topics, never disturbs yours.
//
// PURE: this manages the followed-peers list (dedup, add, remove, key). The fetch
// + merge edges live in main.js. The peer list is `mp.peers` in localStorage —
// this browser only, like the relay URL and the notes-sync config. Unit-tested.

/** A stable identity for a followed repo: "owner/repo" (lowercased for dedup). */
export function peerKey(p) {
  return p && p.owner && p.repo ? `${p.owner}/${p.repo}`.toLowerCase() : "";
}

/**
 * A NEW list with `peer` added (or its branch/label refreshed if already
 * followed — dedup by key). Ignores a peer missing owner/repo. Newest last.
 * Pure.
 */
export function addPeer(list, peer) {
  const key = peerKey(peer);
  const base = Array.isArray(list) ? list : [];
  if (!key) return base;
  const without = base.filter((p) => peerKey(p) !== key);
  return [
    ...without,
    { owner: peer.owner, repo: peer.repo, branch: peer.branch || "main", label: peer.label || `${peer.owner}/${peer.repo}` },
  ];
}

/** A NEW list with the peer whose key === `key` removed. Pure. */
export function removePeer(list, key) {
  const k = String(key || "").toLowerCase();
  return (Array.isArray(list) ? list : []).filter((p) => peerKey(p) !== k);
}
