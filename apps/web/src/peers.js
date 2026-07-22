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

import { GITHUB_API } from "./notes-sync.js"; // R-0086: peers can live on any forge

/** A stable identity for a followed repo: "owner/repo" (lowercased), prefixed
 *  with the forge host when it isn't GitHub — ada/world on your Gitea and
 *  ada/world on github.com are DIFFERENT peers (R-0086). */
export function peerKey(p) {
  if (!p || !p.owner || !p.repo) return "";
  const core = `${p.owner}/${p.repo}`.toLowerCase();
  const base = p.base && p.base !== GITHUB_API ? `${String(p.base).toLowerCase().replace(/^https?:\/\//, "")}/` : "";
  return base + core;
}

/**
 * A NEW list with `peer` added (or its branch/label/token refreshed if already
 * followed — dedup by key). Ignores a peer missing owner/repo. Newest last.
 * R-0085: an optional `token` rides along for PRIVATE repos the owner was
 * granted read access to — pasted by the owner, stored in this browser only
 * (mp.peers), sent only to api.github.com, same envelope as the sync token.
 * Re-following without a token keeps the one already stored. Pure.
 */
export function addPeer(list, peer) {
  const key = peerKey(peer);
  const base = Array.isArray(list) ? list : [];
  if (!key) return base;
  const prev = base.find((p) => peerKey(p) === key);
  const without = base.filter((p) => peerKey(p) !== key);
  const entry = {
    owner: peer.owner,
    repo: peer.repo,
    branch: peer.branch || "main",
    label: peer.label || `${peer.owner}/${peer.repo}`,
  };
  if (peer.base && peer.base !== GITHUB_API) entry.base = peer.base; // R-0086: non-GitHub forge
  const token = peer.token || prev?.token || "";
  if (token) entry.token = token;
  return [...without, entry];
}

/** A NEW list with the peer whose key === `key` removed. Pure. */
export function removePeer(list, key) {
  const k = String(key || "").toLowerCase();
  return (Array.isArray(list) ? list : []).filter((p) => peerKey(p) !== k);
}
