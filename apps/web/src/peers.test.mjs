// peers.test.mjs — following peers' repos: key, add (dedup), remove (R-0082). Pure.
import test from "node:test";
import assert from "node:assert/strict";

import { peerKey, addPeer, removePeer } from "./peers.js";

test("peerKey is owner/repo, lowercased; empty for junk", () => {
  assert.equal(peerKey({ owner: "Ada", repo: "Plateaus" }), "ada/plateaus");
  assert.equal(peerKey({ owner: "a" }), "");
  assert.equal(peerKey(null), "");
});

test("addPeer appends with defaults and dedups by key (refreshing branch/label)", () => {
  let list = addPeer([], { owner: "ada", repo: "world" });
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], { owner: "ada", repo: "world", branch: "main", label: "ada/world" });

  // same repo (case-insensitive) → replaced, not duplicated; new branch/label win
  list = addPeer(list, { owner: "Ada", repo: "World", branch: "dev", label: "Ada's map" });
  assert.equal(list.length, 1);
  assert.equal(list[0].branch, "dev");
  assert.equal(list[0].label, "Ada's map");

  // a different repo is added alongside, newest last
  list = addPeer(list, { owner: "bob", repo: "graph" });
  assert.deepEqual(list.map(peerKey), ["ada/world", "bob/graph"]);

  // junk peer ignored; non-array list tolerated
  assert.equal(addPeer(list, { owner: "x" }).length, 2);
  assert.deepEqual(addPeer(null, { owner: "z", repo: "r" }).map(peerKey), ["z/r"]);
});

test("removePeer drops by key (case-insensitive), leaves the rest", () => {
  const list = addPeer(addPeer([], { owner: "ada", repo: "world" }), { owner: "bob", repo: "graph" });
  assert.deepEqual(removePeer(list, "ADA/WORLD").map(peerKey), ["bob/graph"]);
  assert.deepEqual(removePeer(list, "nope/nope").map(peerKey), ["ada/world", "bob/graph"]);
  assert.deepEqual(removePeer(null, "x"), []);
});
