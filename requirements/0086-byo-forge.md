# R-0086 — bring your own forge: Gitea/Forgejo sync + follow

- **Status:** Accepted · **Milestone:** POC — Knowledge content · **Created:** 2026-07-22
- **Depends on:** R-0075/81/84 (sync + world + auto-push), R-0082/85 (follow).
- **Source:** the owner: "can we maybe also connect it to a Gitea server which I already have,
  and have it all sync repo p2p and maybe connect on that."

## 1. Statement

The repo layer is now **forge-agnostic**. GitHub stays the default, but any **Gitea/Forgejo**
instance works for everything the repo does: device sync, auto-push, notes, *and* following
peers — so the whole world can federate through a server the owner runs, with no GitHub
dependency at all. Gitea's contents API is deliberately GitHub-shaped (base64 + sha, same
GET/PUT); the only difference is the URL prefix (`/api/v1`), and that difference now lives in
one pure place. The 📓 Sync wizard gains an optional **server** field (blank = GitHub; paste a
Gitea root URL — bare hosts get https, an accidental `/api/v1` suffix is stripped); a full repo
URL pasted in the repo field carries its own forge. 👣 Follow accepts any forge's repo URL —
a Gitea peer is a *distinct* identity from the same owner/repo on GitHub (host-prefixed key +
label) and can carry its own read token (R-0085). Everything else — CRDT merge semantics,
409 retry, auto-push, token envelope (this browser only, sent only to the chosen forge) — is
unchanged. Legacy configs without a base read as GitHub. WebRTC P2P remains for live
same-room sync.

## 2. Acceptance criteria

- **AC1** — pure `notes-sync.js`: `GITHUB_API`, `normalizeForgeBase` (""→GitHub, bare hosts get
  https, trailing `/` + `/api/v1` stripped, github.com spellings collapse), `repoApiUrl` /
  `contentsApiUrl` (GitHub `/repos/…` vs Gitea `/api/v1/repos/…`; empty base = GitHub),
  `parseRepoUrl` (bare + github.com → GitHub; other forge URLs keep origin + subpath as base;
  junk → null). Unit-tested. `peers.js`: `peerKey` host-prefixes non-GitHub peers; `addPeer`
  stores `base` only when non-GitHub (GitHub entries stay lean). Unit-tested.
- **AC2** — 📓 Sync: the optional server field (or a full repo URL) selects the forge; test,
  notes push/pull, world pull/push, and R-0084 auto-push all hit that forge's `/api/v1` URLs;
  reopening the panel repopulates the server field and names the connected forge.
- **AC3** — 👣 Follow accepts any forge's repo URL; the peer persists with its base and a
  host-prefixed label; Re-pull hits the peer's forge.
- **AC4** — additive, no new dependency, `apps/web` only; legacy GitHub configs unaffected;
  suite stays green.

## Setup notes (owner-side, for a self-hosted Gitea)

The app is served over HTTPS, so the Gitea instance must be reachable from an HTTPS page:
same-machine `http://localhost:3000` works in Chrome (trustworthy-origin exemption); for OTHER
devices (tablets), put Gitea behind HTTPS — e.g. a Cloudflare Tunnel (`gitea.<domain>` →
`localhost:3000`). Gitea must also allow the app's origin via CORS (`app.ini`: `[cors]
ENABLED = true`, `ALLOW_DOMAIN = plateaus.goosethropic.systems`). Token: Gitea → Settings →
Applications → new token with repository read/write.

## Changelog

- 2026-07-22 created (Accepted) + implemented. Suite 570/570 (5 new tests). Live-verified vs a
  stubbed Gitea API with URL logging: connect/test, world pull, and the R-0084 auto-push after a
  capture all hit `https://gitea.….test/api/v1/repos/…` exactly; following
  `https://gitea.peer.test/ada/world` parsed the forge, stored `base`, labeled the peer
  `gitea.peer.test/ada/world`, and pulled via the peer's `/api/v1` contents URL.
