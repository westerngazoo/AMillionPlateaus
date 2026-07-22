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

test("addPeer token (R-0085): carried for private repos, kept on re-follow, never invented", () => {
  // a public follow stores NO token key at all
  const pub = addPeer([], { owner: "ada", repo: "world" });
  assert.ok(!("token" in pub[0]));

  // a private follow carries the token
  let list = addPeer([], { owner: "bob", repo: "secret", token: "github_pat_x" });
  assert.equal(list[0].token, "github_pat_x");

  // re-following WITHOUT a token keeps the stored one (don't lose access on refresh)
  list = addPeer(list, { owner: "Bob", repo: "Secret", label: "Bob's map" });
  assert.equal(list.length, 1);
  assert.equal(list[0].token, "github_pat_x");
  assert.equal(list[0].label, "Bob's map");

  // re-following WITH a new token replaces it (rotation)
  list = addPeer(list, { owner: "bob", repo: "secret", token: "github_pat_y" });
  assert.equal(list[0].token, "github_pat_y");
});

test("forge base (R-0086): a Gitea peer is distinct from the same owner/repo on GitHub", () => {
  const gh = { owner: "ada", repo: "world" };
  const gt = { owner: "ada", repo: "world", base: "https://gitea.example.com" };
  assert.equal(peerKey(gh), "ada/world");
  assert.equal(peerKey(gt), "gitea.example.com/ada/world");
  // both can be followed side by side
  let list = addPeer(addPeer([], gh), gt);
  assert.equal(list.length, 2);
  assert.ok(!("base" in list[0])); // GitHub entries stay lean
  assert.equal(list[1].base, "https://gitea.example.com");
  // removing the Gitea one leaves the GitHub one
  list = removePeer(list, peerKey(gt));
  assert.deepEqual(list.map(peerKey), ["ada/world"]);
});

test("removePeer drops by key (case-insensitive), leaves the rest", () => {
  const list = addPeer(addPeer([], { owner: "ada", repo: "world" }), { owner: "bob", repo: "graph" });
  assert.deepEqual(removePeer(list, "ADA/WORLD").map(peerKey), ["bob/graph"]);
  assert.deepEqual(removePeer(list, "nope/nope").map(peerKey), ["ada/world", "bob/graph"]);
  assert.deepEqual(removePeer(null, "x"), []);
});
