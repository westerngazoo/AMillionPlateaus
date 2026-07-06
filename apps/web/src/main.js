// main.js — wire wasm + render + input + sync + identity + the persona creator
// (SPEC-0005/0006/0007/0009, SPEC-0010 Nostr identity, SPEC-0011 plateau authoring).
//
// No GA, graph, CRDT or crypto logic lives here: it parses input, calls the wasm
// core, and marshals results to the render layer. Phase 8 makes reach EARNED — the
// visitor holds a Nostr keypair, traversals/vouches are signed events, and
// reputation is recomputed from the verified event log by the Rust engine (no seed
// magnitude). The persona is now only an ORIENTATION hint; the key, the event log,
// the companion chat and the model config are all LOCAL and never synced.

import init, {
  WasmCrdtDoc,
  WasmSyncSession,
  WasmIdentity,
  verify_event,
  recompute_reputation,
  rank_wizards,
  crystallize_threshold,
  wizard_id_of,
  mastery_kind,
  proof_kind,
  path_kind,
} from "../pkg/mp_wasm.js";
import { canvasRenderer } from "./renderers/canvas.js";
import { viewModel } from "./viewpipeline.js";
import { spreadNodes as spreadLayout } from "./layout.js";
import { project as place } from "./project.js";
import { hitTest } from "./hittest.js";
import { createSync } from "./sync.js";
import { createSnapshotStore } from "./persistence.js";
import { createPeer } from "./webrtc.js";
import { loadOrMintIdentity } from "./identity.js";
import { makeLog } from "./events.js";
import { createRelay, RELAY_KEY } from "./relay.js";
import { createEventBus } from "./eventbus.js";
import {
  ARCHETYPES,
  authorPersona,
  authorDomain,
  SUGGESTED_DOMAINS,
  DOMAINS,
  AXES,
  MATH_DOMAIN,
  MUSIC_DOMAIN,
  PHYSICS_DOMAIN,
} from "./persona.js";
import { SEED_PLATEAUS, SEED_BRIDGES, SEED_RESOURCES, P } from "./seeds.js";
import { QC_PLATEAUS, QC_BRIDGES, QC_RESOURCES, SEED_PATHS } from "./curriculum.js";
import { CS_PLATEAUS, CS_BRIDGES, CS_RESOURCES, CS_PATHS } from "./cs-curriculum.js";
import { isGrowable, childPosition, starterBody, draftPlateauPrompt, inlinePrompt, existingChild } from "./rhizome.js";
import { PRESETS, PROVIDERS, isConfigured } from "./model.js";
import { shouldRegister, warmList, VENDOR_WARM } from "./pwa.js";
import { buildGroundingContext } from "./companion-context.js";
import { voiceFor } from "./companion-voice.js";
import { assembleMessages, sendTurn } from "./companion.js";
import { buildPlateau } from "./plateau.js";
import { renderMarkdown, safeHref } from "./markdown.js";
import { typesetMath } from "./katex.js";
import {
  rankResources,
  buildPlateauStudyContext,
  STUDY_ACTIONS,
  crossLinks,
  bridgeResources,
  buildProofGrading,
  parseVerdict,
} from "./study.js";
import {
  checkEquivalence,
  generateDrill,
  drillsFor,
  parseChallenges,
  stripChallenges,
  parseExpr,
  toTeX,
} from "./cas.js";
import { offlineDigest } from "./offline-digest.js";
import { masteredTopics, visitedTopics, communityApproved, MASTERY_KIND } from "./mastery.js";
import { publishedProofs, PROOF_KIND } from "./proofs.js";
import {
  buildPath,
  pathDomains,
  nextPathStep,
  pathProgress,
  publishedPaths,
  PATH_KIND,
} from "./paths.js";
import { buildBridge } from "./bridge.js";
import { buildResource, RESOURCE_KINDS } from "./resource.js";
import { buildVote } from "./vote.js";
import { createPresence, HEARTBEAT_MS } from "./presence.js";
import { centerOn, zoomAt } from "./wayfinding.js";
import { pinch } from "./gestures.js";
import { TUTORIAL_STEPS, shouldShowTutorial, markTutorialSeen } from "./tutorial.js";

// The companion's model configuration is a LOCAL lens, persisted only in this
// browser and NEVER synced (R-0007 AC5). Default to the offline `fake` provider
// so the UI is always usable before a model is connected.
const CONFIG_KEY = "mp.modelConfig";
const OFFLINE_CONFIG = { kind: "fake", model: "offline" };
function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...OFFLINE_CONFIG };
    const cfg = JSON.parse(raw);
    return PROVIDERS[cfg?.kind] ? cfg : { ...OFFLINE_CONFIG };
  } catch {
    return { ...OFFLINE_CONFIG };
  }
}
function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); // local only — never on the wire
}

// The most-recently authored persona is also a LOCAL lens (SPEC-0009 §2.5). We
// persist only its raw inputs `{ name, orient, tone }` and rebuild it via
// `authorPersona` on load, so a restored persona seeds through the identical pure
// mapping as a freshly authored one. NEVER synced, never in the CRDT (R-0009 AC5).
const AUTHORED_KEY = "mp.authoredPersona";
function loadAuthored() {
  try {
    const raw = localStorage.getItem(AUTHORED_KEY);
    if (!raw) return null;
    const seed = JSON.parse(raw);
    return Array.isArray(seed?.orient) ? seed : null;
  } catch {
    return null;
  }
}
function saveAuthored(seed) {
  localStorage.setItem(AUTHORED_KEY, JSON.stringify(seed)); // local only — never on the wire
}

// Author-your-own domains (SPEC-0038 / R-0038). A domain is a named grade-1 DIRECTION;
// the engine projects onto any canonical, so these are pure local additions to the
// faceable `DOMAINS` set — never synced, never in the CRDT. `allDomains()` is the single
// merge consulted wherever the built-in three are (label, canonical, creator, plateau
// select). Authored domains carry a name-derived UUID id so a signed traversal validates.
const DOMAINS_KEY = "mp.domains";
function loadCustomDomains() {
  try {
    const raw = localStorage.getItem(DOMAINS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Drop any malformed entry so a corrupt blob can't poison canonicalAxis (finding #6).
    return arr.filter(
      (d) =>
        d &&
        typeof d.id === "string" &&
        typeof d.label === "string" &&
        d.canonical &&
        ["e1", "e2", "e3"].every((k) => Number.isFinite(d.canonical[k])),
    );
  } catch {
    return [];
  }
}
let customDomains = loadCustomDomains();
function saveCustomDomains() {
  localStorage.setItem(DOMAINS_KEY, JSON.stringify(customDomains)); // local only
}
// The live faceable set: the built-in three + the visitor's authored domains.
const allDomains = () => [...DOMAINS, ...customDomains];
// A label resolver over `allDomains()` for authorPersona (so a persona facing an authored
// domain shows its name, not "Uncharted", on the card/companion intro/grounding).
const domainLabelOf = (id) => allDomains().find((d) => d.id === id)?.label;
// authorPersona with custom-domain label resolution wired in (used at both call sites).
const buildAuthored = (seed) => authorPersona(seed, domainLabelOf);
// Add or re-aim an authored domain (dedup by id — re-authoring a name updates its canonical).
function addCustomDomain(d) {
  if (!d) return;
  if (DOMAINS.some((b) => b.id === d.id)) return; // never shadow a built-in
  customDomains = customDomains.some((c) => c.id === d.id)
    ? customDomains.map((c) => (c.id === d.id ? d : c))
    : [...customDomains, d];
  saveCustomDomains();
}
// Wired by the world-init to repopulate the draft-plateau domain <select> (no-op until then).
let refreshDomainSelect = () => {};

// The relay endpoint is a LOCAL setting (like the model config). Empty ⇒ offline,
// and the world stays fully playable from the local event log (R-0010 AC7).
function loadRelayUrl() {
  try {
    return localStorage.getItem(RELAY_KEY) || "";
  } catch {
    return "";
  }
}
function saveRelayUrl(url) {
  try {
    if (url) localStorage.setItem(RELAY_KEY, url);
    else localStorage.removeItem(RELAY_KEY);
  } catch {
    /* storage denied — the URL still applies for this session */
  }
}

// How many nearest-by-projection plateaus to ground the companion with.
const NEAREST_K = 5;

// A reached plateau signs a depth-1 traversal toward its position (R-0010 AC3).
const TRAVERSAL_DEPTH = 1.0;
// How many top traversers per domain discovery surfaces (R-0010 AC7).
const DISCOVERY_K = 5;

// The deterministic seed world (fixed-id plateaus + bridges) lives in seeds.js
// (SPEC-0022): pure data, node-testable (seeds.test.mjs asserts id uniqueness),
// imported above. Mathematics on e1, Music on e3, Physics on e2 (R-0022).

// id → domain, so traverse grows the plateau's OWN domain bucket. Foreign synced
// plateaus (added in another tab) fall back to the active persona's first domain
// — a best-effort heuristic, harmless to the positional fog math.
const DOMAIN_OF = new Map(SEED_PLATEAUS.map((p) => [p.id, p.domain]));

// Each faced domain's on-axis origin plateau is always drawn as a navigable
// trailhead (SPEC-0010 §2.3): with an empty log reputation reaches nothing, but a
// trailhead lets the visitor sign their FIRST traversal. This is a render/interaction
// affordance gated on persona ORIENTATION, never on reputation — so "empty log ⇒
// empty domain_reps ⇒ reaches nothing" stays true at the reputation layer.
const TRAILHEAD_OF = {
  [MATH_DOMAIN]: P.Arithmetic,
  [MUSIC_DOMAIN]: P.Rhythm,
  [PHYSICS_DOMAIN]: P.Motion, // R-0022: the Physicist's first step
};

// Math on the upper-right (high e1), Music on the lower-left (high e3).
// `let`, not `const`: Travel (R-0019) re-origins the camera by overwriting
// VIEW.cx/cy via wayfinding.centerOn — the only state travel ever touches.
let VIEW = { cx: 230, cy: 150, scale: 320 };

async function main() {
  await init();

  // ── Durable graph (SPEC-0012 / R-0012) ──────────────────────────────────
  // Restore the CRDT doc from its IndexedDB snapshot, else start fresh. A
  // corrupt/old blob throwing in load() must NOT abort main() (the top-level
  // catch does not reseed), so catch it here and discard-and-reseed (AC7). In
  // node/private-mode the store is inert and load() resolves null.
  const snapshots = createSnapshotStore();
  const saved = await snapshots.load();
  let doc;
  try {
    doc = saved ? WasmCrdtDoc.load(saved) : WasmCrdtDoc.new();
  } catch {
    doc = WasmCrdtDoc.new(); // corrupt blob → fresh doc, reseed below, overwrite on next persist
  }
  const session = new WasmSyncSession();

  // Apply the deterministic seed on every load — an idempotent upsert on fixed
  // ids (convergent, R-0004 AC4); authored nodes have random ids and are never
  // touched (AC4).
  // (`description` rides the same upsert since the QC curriculum — seeds.js rows
  // have none, curriculum.js rows ship their Markdown body.)
  for (const p of [...SEED_PLATEAUS, ...QC_PLATEAUS, ...CS_PLATEAUS])
    doc.seed_plateau(p.id, p.name, p.domain, p.e1, p.e2, p.e3, p.description ?? "");
  for (const b of [...SEED_BRIDGES, ...QC_BRIDGES, ...CS_BRIDGES])
    doc.seed_bridge(b.id, b.from, b.to, b.concept);
  // Example resources (R-0027): fixed-id idempotent upsert, same as above — so a
  // fresh world has something to read; re-seeding never resets earned stones.
  for (const r of [...SEED_RESOURCES, ...QC_RESOURCES, ...CS_RESOURCES])
    doc.seed_resource(r.id, r.plateau, r.title, r.kind, r.uri);

  // Rebuild id→domain from the (possibly restored) doc so a restored authored
  // plateau scores reputation under its OWN domain, not a fallback (AC5).
  for (const p of doc.to_graph().plateaus()) DOMAIN_OF.set(p.id, p.domain_id);

  // Persist the whole converged doc to IndexedDB; debounced inside the store
  // (AC3). Called after every local edit and inbound sync.
  function persist() {
    snapshots.save(doc.save());
  }

  // AC5 — the synced doc carries exactly the four data maps, no reputation key.
  const keys = doc.root_keys();
  const ok = JSON.stringify(keys) === JSON.stringify(["bridges", "plateaus", "resources", "votes"]);
  console.log(`[mp] doc root keys: ${keys.join(", ")} ${ok ? "✓" : "✗ UNEXPECTED"}`);
  console.assert(ok, "synced doc must hold exactly {bridges, plateaus, resources, votes}");

  // ── Identity + event log (SPEC-0010 §2.3, R-0010 AC1/AC3) ───────────────
  // All crypto/GA stays in Rust; this object just injects the wasm entry points
  // into the pure JS orchestration of identity.js / events.js.
  const idWasm = { WasmIdentity, verify_event, recompute_reputation };
  // Mint or restore the wizard key; the SECRET is persisted only locally and never
  // displayed/synced/logged. The pubkey is the stable public wizard id.
  const identity = loadOrMintIdentity(idWasm, localStorage);
  const myPubkey = identity.pubkey();
  // The verified event log is the SOURCE of reputation — no seed magnitude.
  const log = makeLog(idWasm, myPubkey, localStorage);
  // Cached `{domain_reps, synthesis}`; recomputed from the log after every change.
  let reputation = log.reputation();
  function recompute() {
    reputation = log.reputation();
  }
  // Trusted-master weighting (R-0035): community approval sums each master's EARNED
  // REACH (grade-1 reputation magnitude in the topic's domain) and clears a bar — so
  // a vouch-ring Sybil (grade-0, reach ≈ 0) cannot manufacture approval. The bar is a
  // reach magnitude, POC-calibrated (a single on-axis traversal earns reach ≈ 1).
  const APPROVAL_REACH = 2.5;
  const MASTER_K = 256; // rank_wizards top-K — above any plausible per-domain master count this phase

  // Per-domain { pubkey → reach } for the masters in the verified corpus, read from
  // the EXISTING GA reputation via rank_wizards (one call per mastery-bearing domain).
  // NOTE: re-derives reputation per domain (the same recompute the fog path pays) —
  // fine for the POC log size, not a cheap call.
  function reachWeights(events) {
    const logJson = JSON.stringify(events);
    const domains = new Set();
    for (const e of events) {
      if (e?.kind !== MASTERY_KIND) continue;
      try {
        const plateau = JSON.parse(e.content)?.plateau;
        const d = plateau && DOMAIN_OF.get(plateau);
        if (d) domains.add(d);
      } catch {
        /* malformed — skip */
      }
    }
    const byDomain = new Map(); // domainId → Map<pubkey, reach>
    for (const domain of domains) {
      try {
        const rows = rank_wizards(logJson, domain, MASTER_K); // [{ pubkey, reach }]
        byDomain.set(domain, new Map(rows.map((r) => [r.pubkey, r.reach])));
      } catch (err) {
        console.error("[mp] rank_wizards (weighting) failed:", err);
      }
    }
    return byDomain;
  }
  // The R-0035 weighted approval set: distinct masters' summed domain reach ≥ bar.
  function approvedTopics() {
    const byDomain = reachWeights(log.all());
    return communityApproved(log.all(), {
      bar: APPROVAL_REACH,
      domainOf: (plateau) => DOMAIN_OF.get(plateau),
      weightOf: (pk, domain) => byDomain.get(domain)?.get(pk) ?? 0,
    });
  }

  // Progress derived from the SAME verified log (R-0030 mastered, R-0033 visited),
  // refreshed alongside reputation. Both are completion layers, NOT reach: a topic
  // is "studying" once visited, "mastered" once quizzed.
  let mastered = masteredTopics(log.all(), myPubkey);
  let visited = visitedTopics(log.all(), myPubkey);
  // Community-approved (R-0031), now WEIGHTED by master reach (R-0035): over the SAME
  // verified corpus (own + discovered) — pubkey-agnostic, off the CRDT.
  let community = approvedTopics();
  function recomputeProgress() {
    mastered = masteredTopics(log.all(), myPubkey);
    visited = visitedTopics(log.all(), myPubkey);
    community = approvedTopics();
  }
  // Pin the JS MASTERY_KIND to the Rust source (one source of truth, R-0030 AC6).
  console.assert(
    mastery_kind() === MASTERY_KIND,
    `MASTERY_KIND ${MASTERY_KIND} ≠ Rust mastery_kind() ${mastery_kind()}`,
  );
  // Pin the JS PROOF_KIND to the Rust source (R-0036 AC5).
  console.assert(
    proof_kind() === PROOF_KIND,
    `PROOF_KIND ${PROOF_KIND} ≠ Rust proof_kind() ${proof_kind()}`,
  );
  console.assert(
    path_kind() === PATH_KIND,
    `PATH_KIND ${PATH_KIND} ≠ Rust path_kind() ${path_kind()}`,
  );

  // The persona is the page's local lens. Null until the visitor chooses one; the
  // world is not interactive before then (R-0006 AC1). Phase 8: the persona only
  // ORIENTS (which domains' trailheads/camera) — it never seeds a reputation vector.
  let activePersona = null;

  // The visitor's last authored persona inputs `{ name, orient, tone }`, restored
  // from localStorage and surfaced in the creator (SPEC-0009 §2.5). LOCAL only.
  let authoredSeed = loadAuthored();

  // Companion state — all LOCAL, never synced (R-0007 AC5).
  let modelConfig = loadConfig();
  let history = []; // in-memory chat turns; resets on reload (v1)

  const canvas = document.getElementById("world");
  // The view pipeline is injected here (RFC-0003 §4): a layout strategy, a
  // renderer backend, and a pure hit-test. Swapping any of them (force layout,
  // WebGL, raycast) is a constructor choice — no change to the draw loop.
  const renderer = canvasRenderer(canvas);
  const hud = document.getElementById("hud");
  const identityHud = document.getElementById("identity-hud");
  const relayHud = document.getElementById("relay-hud");
  const discovery = document.getElementById("discovery");
  const creator = document.getElementById("creator");
  const companion = document.getElementById("companion");
  const companionName = document.getElementById("companion-name");
  const companionStatus = document.getElementById("companion-status");
  const companionLog = document.getElementById("companion-log");
  const companionForm = document.getElementById("companion-form");
  const companionInput = document.getElementById("companion-input");
  let points = new Map();
  let focusedId = null; // travel focus ring (R-0019); camera highlight only, transient
  let followPathId = null; // R-0039: local path being followed (camera/UI only)
  const PATHS_KEY = "mp.paths";
  function loadPaths() {
    try {
      return JSON.parse(localStorage.getItem(PATHS_KEY)) || {};
    } catch {
      return {};
    }
  }
  function savePaths(all) {
    try {
      localStorage.setItem(PATHS_KEY, JSON.stringify(all));
    } catch {
      /* quota */
    }
  }
  // Seed the flagship curriculum path(s) (R-0039) — an idempotent upsert on their
  // fixed 4… ids, the same convergent seed contract the plateaus use. User paths
  // mint random uuids, so re-seeding the canonical route never clobbers an
  // authored one. This is why "Paths" is never empty: there is always a journey
  // to follow the moment the world loads.
  (function seedPaths() {
    const all = loadPaths();
    for (const p of [...SEED_PATHS, ...CS_PATHS]) all[p.id] = { ...p };
    savePaths(all);
  })();
  const FLAGSHIP_PATH_ID = SEED_PATHS[0]?.id ?? null;
  function followSteps() {
    if (!followPathId) return [];
    return loadPaths()[followPathId]?.steps ?? [];
  }
  function followNext() {
    return nextPathStep(followSteps(), mastered);
  }

  // Show the PUBLIC half of the key (safe to display). The secret is never shown.
  identityHud.textContent = `🔑 ${shortKey(myPubkey)}`;

  // The domains the active persona faces, and each one's always-navigable trailhead.
  function facedDomains() {
    return new Set((activePersona?.orient ?? []).map((o) => o.domain));
  }
  function trailheadIds() {
    const ids = [];
    for (const d of facedDomains()) {
      if (TRAILHEAD_OF[d]) ids.push(TRAILHEAD_OF[d]);
    }
    return ids;
  }

  function draw() {
    const graph = doc.to_graph();
    const plateaus = graph.plateaus();
    const bridges = graph.bridges();
    const resources = graph.resources(); // trail markers, anchored to plateaus (R-0014)
    // place → layout: project each plateau to screen, then declutter. The SAME
    // placement drives the draw AND hit-testing (stored in `points`).
    const raw = new Map();
    for (const p of plateaus) raw.set(p.id, place(p.position, VIEW));
    points = spreadLayout(raw);
    // R-0033: the map colours by PROGRESS, not earned reach — the whole map is
    // browsable. Reach/reputation is still recomputed (it grounds the companion +
    // discovery, R-0010); it just no longer gates or colours the map. The
    // viewModel owns emphasis (focus/context, PR #42); the renderer just replays.
    renderer.draw(
      viewModel({ plateaus, bridges, resources }, points, {
        visited, // studying set (R-0033)
        mastered, // mastered set — ✓ + gold (R-0030)
        community, // crowd-approved set — bedrock ring (R-0031)
        focusedId, // transient travel highlight (R-0019); null most of the time
        // Focus + context: your lens's domains render full; the rest fade to small
        // "shadow" dots (context, still clickable). Empty set (no persona yet) or an
        // all-shadow world renders everything full — fading ALL nodes helps nobody.
        focusDomains: facedDomains(),
        pathSteps: followSteps(),
        pathNext: followNext(),
        peers: presence.peers(), // ephemeral remote-wizard silhouettes (R-0016)
      }),
    );
    const studying = [...visited].filter((id) => !mastered.has(id)).length;
    const who = activePersona ? `${activePersona.name} · ` : "";
    const canonical = community.size > 0 ? ` · ${community.size} canonical` : "";
    hud.textContent = `${who}${mastered.size} mastered · ${studying} studying · ${plateaus.length} topics · ${bridges.length} bridges${canonical}`;
  }

  // ── Ephemeral presence (SPEC-0016 / R-0016) ─────────────────────────────────
  // A per-TAB session id (NOT persisted) — two tabs of the same wizard are two
  // presences. Beacons ride a SEPARATE channel; nothing here touches the CRDT,
  // the event log, or any store. A beacon arriving redraws immediately; the
  // heartbeat re-announces AND redraws so a gone wizard's silhouette expires.
  const sessionId = crypto.randomUUID();
  let myPlateau = null; // current position (a plateau id), set on focus
  const presence = createPresence({ session: sessionId, onChange: draw });
  function announcePresence() {
    if (myPlateau) presence.announce({ pubkey: myPubkey, plateau: myPlateau });
  }
  setInterval(() => {
    announcePresence();
    draw();
  }, HEARTBEAT_MS);

  // After any LOCAL graph edit, ship the change to the other tab. The inbound
  // callback redraws AND persists the converged doc (AC3) — wrapping keeps
  // sync.js a pure transport (it never learns about persistence).
  const sync = createSync(doc, session, () => {
    draw();
    persist();
  });

  // ── WebRTC peer-to-peer sync (SPEC-0018 / R-0018) ───────────────────────
  // An OPTIONAL, additive second pipe for the SAME CRDT sync bytes — directly
  // between devices, no server. `peer` is null until the wizard opts in; with no
  // peer the app is unchanged (BroadcastChannel sync above still runs). Each peer
  // drives its OWN WasmSyncSession; the pump mirrors sync.js, over peer.send.
  let peer = null;
  let peerSession = null;
  function pumpPeer() {
    if (!peer || !peer.isOpen()) return;
    let msg;
    while ((msg = doc.generate_message(peerSession)) !== undefined) peer.send(msg);
  }
  function startPeer() {
    peerSession = new WasmSyncSession();
    peer = createPeer({
      onOpen: () => pumpPeer(), // catch the remote up with our state on connect
      onMessage: (bytes) => {
        doc.receive_message(peerSession, bytes);
        pumpPeer(); // a received change may unblock more to send
        draw();
        persist(); // durable (R-0012); the doc carries plateaus/bridges/markers/votes
      },
    });
    return peer;
  }

  // ── Signed-event transport (SPEC-0010 §2.3, R-0010 AC2/AC4/AC7) ─────────
  // Verify-gate an event into the local log, recompute reputation, re-light, and —
  // for locally-signed events — ship it to the other tab and the relay. Inbound
  // peer/relay events arrive with broadcast:false so they are not echoed back.
  function ingest(json, { broadcast = true } = {}) {
    if (!log.add(json)) return false; // invalid signature or duplicate — inert
    recompute();
    recomputeProgress(); // refresh studying/mastered sets (own + discovered events, R-0030/R-0033)
    if (broadcast) {
      try {
        bus.broadcast(json);
      } catch {
        /* no BroadcastChannel (e.g. older runtime) — relay/local still work */
      }
      relay.publish(json);
    }
    draw();
    return true;
  }

  // Cross-tab signed-event channel — SEPARATE from the CRDT graph-sync channel.
  const bus = createEventBus((json) => ingest(json, { broadcast: false }));

  // Optional relay; reconnectable from the HUD. Starts from the saved URL (offline
  // if none). On socket trouble the HUD shows "offline" and the world keeps working.
  let relay = { publish() {}, close() {} };
  function setRelayStatus(state) {
    relayHud.textContent = state === "online" ? "relay ● online" : "relay ○ offline";
  }
  function connectRelay(url) {
    relay.close();
    relay = createRelay({
      url,
      onEvent: (json) => ingest(json, { broadcast: false }),
      onStatus: setRelayStatus,
    });
  }

  // Reaching a plateau signs a depth-1 traversal toward its position, recomputes,
  // re-lights, and ships it — no reload (R-0010 AC2/AC3).
  function signTraversal(domain, plateau) {
    const { e1, e2, e3 } = plateau.position;
    try {
      ingest(identity.sign_traversal(domain, e1, e2, e3, TRAVERSAL_DEPTH, plateau.id));
    } catch (err) {
      console.error("[mp] sign_traversal failed:", err);
    }
  }

  // R-0030 — sign a mastery event for the topic (self-tested upstream). NOT
  // reputation-bearing; ingest refreshes the ✓ set + redraws. Idempotent (the
  // mastered SET dedupes by plateau id).
  function signMastery(plateau) {
    try {
      ingest(identity.sign_mastery(plateau.id));
    } catch (err) {
      console.error("[mp] sign_mastery failed:", err);
    }
  }

  // ── Discovery + vouch (SPEC-0010 §2.3, R-0010 AC5/AC7) ──────────────────
  function shortKey(pk) {
    return pk && pk.length > 12 ? `${pk.slice(0, 6)}…${pk.slice(-4)}` : pk || "?";
  }
  function labelForDomain(id) {
    return allDomains().find((d) => d.id === id)?.label ?? "Uncharted"; // incl. authored (R-0038)
  }
  function canonicalAxis(domain) {
    const c = allDomains().find((d) => d.id === domain)?.canonical ?? { e1: 0, e2: 0, e3: 0 };
    return [c.e1, c.e2, c.e3];
  }

  // Endorse a discovered wizard in `domain`. The two endpoints are the domain's
  // canonical grade-1 axis, so recompute rebuilds an even-grade rotor (the only
  // public Bridge path) and `propagate` flows the voucher's EARNED reach to the
  // vouched at trust_decay. With no earned reach it is a no-op — you cannot vouch
  // what you have not earned, which is the Sybil grade-collapse (R-0010 AC5).
  function vouchFor(domain, vouchedPubkey) {
    const axis = canonicalAxis(domain);
    try {
      ingest(identity.sign_vouch(domain, vouchedPubkey, axis, axis));
    } catch (err) {
      console.error("[mp] sign_vouch failed:", err);
      return;
    }
    renderDiscovery();
  }

  // Rank top traversers per faced domain from the VERIFIED log (client-side; the
  // relay is never trusted for ordering). Each foreign wizard gets a vouch button.
  function renderDiscovery() {
    discovery.innerHTML = "";
    if (!activePersona) return;
    const domains = [...facedDomains()];
    if (domains.length === 0) {
      discovery.textContent = "Face a domain to discover its wizards.";
      return;
    }
    const logJson = JSON.stringify(log.all());
    for (const domain of domains) {
      const section = document.createElement("div");
      section.className = "discovery-domain";
      const head = document.createElement("div");
      head.className = "discovery-head";
      head.textContent = `${labelForDomain(domain)} — top traversers`;
      section.append(head);

      let rows = [];
      try {
        rows = rank_wizards(logJson, domain, DISCOVERY_K);
      } catch (err) {
        console.error("[mp] rank_wizards failed:", err);
      }
      if (!rows || rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "discovery-empty";
        empty.textContent = "No signed traversals yet.";
        section.append(empty);
      } else {
        for (const { pubkey, reach } of rows) {
          const row = document.createElement("div");
          row.className = "discovery-row";
          const who = pubkey === myPubkey ? "you" : shortKey(pubkey);
          const label = document.createElement("span");
          label.textContent = `${who} · reach ${reach.toFixed(2)}`;
          row.append(label);
          if (pubkey !== myPubkey) {
            const vouchBtn = document.createElement("button");
            vouchBtn.type = "button";
            vouchBtn.textContent = "Vouch";
            vouchBtn.addEventListener("click", () => vouchFor(domain, pubkey));
            row.append(vouchBtn);
          }
          section.append(row);
        }
      }
      discovery.append(section);
    }
  }

  // ── Persona creator (R-0006 AC1/AC2/AC4) ───────────────────────────────
  // Choosing a persona ORIENTS the world (trailheads, camera, companion) and
  // re-lights with no reload. Reputation is NOT touched — reach is earned by the
  // key's signed history, independent of which lens is worn. Nothing about the
  // persona is ever written to the doc/channel.
  function choosePersona(archetype) {
    activePersona = archetype;
    creator.hidden = true;
    initCompanion(archetype); // embody the persona (R-0007 AC2)
    // Stand at the first faced trailhead so peers see us immediately (R-0016 AC4).
    // A persona facing no domain has no trailhead → myPlateau stays null and the
    // wizard appears only after their first focus.
    myPlateau = trailheadIds()[0] ?? null;
    announcePresence();
    renderDiscovery();
    draw();
  }

  // ── Companion (R-0007) ──────────────────────────────────────────────────
  // The companion embodies the active persona and is grounded in the GA graph.
  // Its config, voice and chat are LOCAL — never written to the doc/channel.
  function refreshCompanionStatus() {
    const p = PROVIDERS[modelConfig.kind];
    const label = p ? p.label : "unknown";
    companionStatus.textContent =
      modelConfig.kind === "fake"
        ? "offline — connect a model in “Model setup”"
        : `${label} · ${modelConfig.model || "?"}`;
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className =
      role === "user" ? "msg msg-user" : role === "error" ? "msg msg-err" : "msg msg-bot";
    div.textContent = text;
    companionLog.append(div);
    companionLog.scrollTop = companionLog.scrollHeight;
  }

  function initCompanion(archetype) {
    history = [];
    companionLog.innerHTML = "";
    companionName.textContent = archetype.name;
    refreshCompanionStatus();
    companion.hidden = false;
    appendMessage(
      "bot",
      `I am ${archetype.name}, your guide through ${archetype.domainLabel}. Ask me about what's in reach.`,
    );
  }

  // Snapshot the graph for the current orientation and build the grounding block
  // (R-0007 AC3). All GA ranking is done in the wasm core; JS only formats.
  function buildContextForTurn() {
    const graph = doc.to_graph();
    const repJson = JSON.stringify(reputation);
    const plateaus = graph.plateaus();
    const bridges = graph.bridges();
    const reachableIds = new Set(graph.reachable_plateaus(repJson));
    const nearest = graph.nearest_plateaus(repJson, NEAREST_K);
    return buildGroundingContext({
      persona: activePersona,
      plateaus,
      reachableIds,
      nearest,
      bridges,
    });
  }

  companionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activePersona) return;
    const text = companionInput.value.trim();
    if (!text) return;
    companionInput.value = "";
    appendMessage("user", text);

    try {
      const grounding = buildContextForTurn();
      const messages = assembleMessages(voiceFor(activePersona), grounding, history, text);
      const reply = await sendTurn(modelConfig, messages);
      appendMessage("bot", reply);
      // Keep a trimmed history (the system message is rebuilt each turn).
      history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    } catch (err) {
      appendMessage("error", `⚠ ${err.message}`); // graceful, no uncaught error (R-0007 AC4)
    }
  });

  // ── Model setup (R-0007 AC1) ────────────────────────────────────────────
  const setup = document.getElementById("setup");
  const presetSel = document.getElementById("setup-preset");
  const endpointIn = document.getElementById("setup-endpoint");
  const modelIn = document.getElementById("setup-model");
  const keyIn = document.getElementById("setup-key");

  // Populate the preset dropdown once.
  for (const preset of PRESETS) {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.label;
    presetSel.append(opt);
  }
  presetSel.addEventListener("change", () => {
    const preset = PRESETS.find((p) => p.id === presetSel.value);
    if (!preset) return;
    endpointIn.value = preset.endpoint;
    modelIn.value = preset.model;
  });

  function openSetup() {
    // Seed the form from the current (non-offline) config, else the first preset.
    if (modelConfig.kind !== "fake") {
      endpointIn.value = modelConfig.endpoint || "";
      modelIn.value = modelConfig.model || "";
      keyIn.value = modelConfig.apiKey || "";
    } else {
      const p = PRESETS[0];
      presetSel.value = p.id;
      endpointIn.value = p.endpoint;
      modelIn.value = p.model;
      keyIn.value = "";
    }
    setup.hidden = false;
  }

  document.getElementById("model-setup").addEventListener("click", openSetup);
  document.getElementById("setup-offline").addEventListener("click", () => {
    modelConfig = { ...OFFLINE_CONFIG };
    saveConfig(modelConfig);
    refreshCompanionStatus();
    setup.hidden = true;
  });
  document.getElementById("setup-save").addEventListener("click", () => {
    const candidate = {
      kind: "openai-compatible",
      endpoint: endpointIn.value.trim(),
      model: modelIn.value.trim(),
      apiKey: keyIn.value.trim(),
    };
    // Fall back to offline if the form is incomplete (keeps the UI usable).
    modelConfig = isConfigured(candidate) ? candidate : { ...OFFLINE_CONFIG };
    saveConfig(modelConfig);
    refreshCompanionStatus();
    setup.hidden = true;
  });

  // Make a clickable persona card. `persona` is an archetype-shaped object that
  // `choosePersona` consumes directly (presets or a rebuilt authored persona).
  function personaCard(persona) {
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.innerHTML =
      `<span class="card-name">${persona.name}</span>` +
      `<span class="card-domain">${persona.domainLabel}</span>` +
      `<span class="card-blurb">${persona.blurb}</span>`;
    card.addEventListener("click", () => choosePersona(persona));
    return card;
  }

  // The "create your own" form (R-0009 AC1). Per domain: an enable toggle and three
  // axis sliders under HUMAN labels (Formal/Empirical/Creative) defaulting to the
  // domain's canonical axis — so the simplest path reproduces a preset, while
  // re-aiming a slider authors a novel map. Sliders express DIRECTION only — they
  // orient which domains' trailheads are offered; there is no magnitude/rank control
  // (R-0009 AC1/AC5). Phase 8: rank is earned from signed traversals, not authored.
  function buildAuthorForm() {
    const form = document.createElement("div");
    form.className = "author";

    const nameField = document.createElement("div");
    nameField.className = "author-field";
    nameField.innerHTML = `<label for="author-name">Name</label>`;
    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.id = "author-name";
    nameIn.placeholder = "Your career lens"; // user-facing copy (R-0019 AC1); the authorPersona DEFAULT name stays "Your persona"
    nameIn.value = authoredSeed?.name ?? "";
    nameField.append(nameIn);

    // Pre-fill from the last authored seed (if any), else the canonical defaults.
    const facedBy = new Map((authoredSeed?.orient ?? []).map((o) => [o.domain, o.dir]));
    const domainControls = allDomains().map((d) => {
      const dir = facedBy.get(d.id);
      const block = document.createElement("div");
      block.className = "author-domain";

      const head = document.createElement("div");
      head.className = "author-domain-head";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.id = `author-enable-${d.id}`;
      toggle.checked = authoredSeed ? facedBy.has(d.id) : true; // default: face both
      const label = document.createElement("label");
      label.className = "author-domain-name";
      label.htmlFor = toggle.id;
      label.textContent = d.label;
      head.append(toggle, label);

      const axes = document.createElement("div");
      axes.className = "author-axes";
      axes.hidden = !toggle.checked;
      const sliders = {};
      for (const axis of AXES) {
        const row = document.createElement("div");
        row.className = "axis-row";
        const al = document.createElement("label");
        al.textContent = axis.label;
        const range = document.createElement("input");
        range.type = "range";
        range.min = "0";
        range.max = "1";
        range.step = "0.01";
        range.value = String(dir?.[axis.key] ?? d.canonical[axis.key]);
        sliders[axis.key] = range;
        row.append(al, range);
        axes.append(row);
      }
      toggle.addEventListener("change", () => {
        axes.hidden = !toggle.checked;
      });

      block.append(head, axes);
      return { domain: d.id, toggle, sliders, block };
    });

    // Capture the half-built persona from the live controls (so authoring a new lens
    // doesn't lose the in-progress name/orientation/tone). Same shape buildAuthorForm
    // restores from. Reused by the "Enter" handler too.
    const captureSeed = () => ({
      name: nameIn.value,
      tone: toneIn.value,
      orient: domainControls
        .filter((c) => c.toggle.checked)
        .map((c) => ({
          domain: c.domain,
          dir: {
            e1: Number(c.sliders.e1.value),
            e2: Number(c.sliders.e2.value),
            e3: Number(c.sliders.e3.value),
          },
        })),
    });

    // ── "Add a lens" sub-form (SPEC-0038 / R-0038) ─────────────────────────
    // Name a domain + set its Formal/Empirical/Creative DIRECTION (never a magnitude). On
    // add it's persisted (mp.domains), the draft-plateau select is refreshed, and the form
    // re-renders with the new lens as a faceable block (toggled on, pre-aimed). A suggested
    // name pre-fills the sliders from its grounded blend.
    const addLens = document.createElement("div");
    addLens.className = "author-domain add-lens";
    const addHead = document.createElement("div");
    addHead.className = "author-domain-head";
    addHead.innerHTML = `<span class="author-domain-name">+ Add a lens</span>`;
    const lensName = document.createElement("input");
    lensName.type = "text";
    lensName.setAttribute("list", "domain-suggestions");
    lensName.placeholder = "Name a lens — e.g. AI, Electromagnetism, FPGA";
    lensName.className = "add-lens-name";
    const lensAxesEl = document.createElement("div");
    lensAxesEl.className = "author-axes";
    const lensDefault = { e1: 0.6, e2: 0.5, e3: 0.0 }; // a grounded Formal+Empirical default
    const lensSliders = {};
    for (const axis of AXES) {
      const row = document.createElement("div");
      row.className = "axis-row";
      const al = document.createElement("label");
      al.textContent = axis.label;
      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "1";
      range.step = "0.01";
      range.value = String(lensDefault[axis.key]);
      lensSliders[axis.key] = range;
      row.append(al, range);
      lensAxesEl.append(row);
    }
    // Picking a suggested name pre-fills the sliders from its canonical blend.
    lensName.addEventListener("input", () => {
      const hit = SUGGESTED_DOMAINS.find(
        (s) => s.name.toLowerCase() === lensName.value.trim().toLowerCase(),
      );
      if (hit)
        for (const axis of AXES) lensSliders[axis.key].value = String(hit.canonical[axis.key]);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add lens";
    addBtn.className = "add-lens-btn";
    addBtn.addEventListener("click", () => {
      const d = authorDomain({
        name: lensName.value,
        e1: lensSliders.e1.value,
        e2: lensSliders.e2.value,
        e3: lensSliders.e3.value,
      });
      if (!d) return; // blank name → no-op
      addCustomDomain(d);
      refreshDomainSelect(); // selectable in Draft-a-plateau without a reload (AC4)
      // Re-render with the new lens faced by default, preserving the in-progress persona.
      const seed = captureSeed();
      seed.orient = [
        ...seed.orient.filter((o) => o.domain !== d.id),
        { domain: d.id, dir: { ...d.canonical } },
      ];
      authoredSeed = seed;
      form.replaceWith(buildAuthorForm());
    });
    const addActions = document.createElement("div");
    addActions.className = "author-actions";
    addActions.append(addBtn);
    addLens.append(addHead, lensName, lensAxesEl, addActions);

    const toneField = document.createElement("div");
    toneField.className = "author-field";
    toneField.innerHTML = `<label for="author-tone">Companion tone (optional)</label>`;
    const toneIn = document.createElement("input");
    toneIn.type = "text";
    toneIn.id = "author-tone";
    toneIn.placeholder = "e.g. a wry, encouraging mentor";
    toneIn.value = authoredSeed?.tone ?? "";
    toneField.append(toneIn);

    const hint = document.createElement("p");
    hint.className = "author-hint";
    hint.textContent =
      "Sliders set direction only — which way the lens faces, never how strong it is. It orients where you begin; every topic is open to explore.";

    const actions = document.createElement("div");
    actions.className = "author-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back";
    back.addEventListener("click", buildCreator);
    const enter = document.createElement("button");
    enter.type = "button";
    enter.textContent = "Enter the world";
    enter.addEventListener("click", () => {
      const seed = captureSeed();
      authoredSeed = seed;
      saveAuthored(seed); // local only — never synced (AC5)
      choosePersona(buildAuthored(seed)); // resolver wired → authored-domain labels (R-0038)
    });
    actions.append(back, enter);

    form.append(
      nameField,
      ...domainControls.map((c) => c.block),
      addLens,
      toneField,
      hint,
      actions,
    );
    return form;
  }

  function buildCreator() {
    creator.innerHTML = "";
    const title = document.createElement("h2");
    title.textContent = "Choose your career lens";
    const sub = document.createElement("p");
    sub.className = "creator-sub";
    sub.textContent =
      "Your career lens orients you in the knowledge world and lights where you start. Change it anytime.";
    creator.append(title, sub);

    const cards = document.createElement("div");
    cards.className = "cards";
    for (const a of ARCHETYPES) cards.append(personaCard(a));
    // Surface a restored authored persona as an extra selectable card (§2.5),
    // rebuilt through the same pure factory so it seeds identically (AC2).
    if (authoredSeed) cards.append(personaCard(buildAuthored(authoredSeed)));
    creator.append(cards);

    const create = document.createElement("button");
    create.type = "button";
    create.textContent = "Build your own";
    create.addEventListener("click", () => {
      creator.innerHTML = "";
      const t = document.createElement("h2");
      t.textContent = "Author your career lens";
      const s = document.createElement("p");
      s.className = "creator-sub";
      s.textContent = "Name your lens and aim it: enable a domain and set its direction.";
      creator.append(t, s, buildAuthorForm());
    });
    creator.append(create);
  }
  buildCreator();

  document.getElementById("change-persona").addEventListener("click", () => {
    buildCreator(); // rebuild so the cards (incl. a freshly authored one) show, not a stale form
    creator.hidden = false;
  });

  // ── Map navigation: pan + zoom (R-0024 desktop · R-0037 touch) ─────────────
  // Mutate the single VIEW camera; draw() recomputes points so hit-testing, presence,
  // Travel, and the focus ring all follow. The canvas backing is 800×600 but is now
  // CSS-responsive (R-0037 — it fills the width on a phone), so client px ≠ canvas px:
  // ALL pointer maths goes through clientToCanvas. On desktop rect.width == 800 ⇒ the
  // scale is 1, so behaviour is byte-identical to before.
  function clientToCanvas(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width / r.width),
      y: (clientY - r.top) * (canvas.height / r.height),
    };
  }
  const DRAG_THRESHOLD = 4; // px of travel before a press counts as a pan, not a click
  let moved = false; // a real drag happened → suppress the click-to-open (read at "click")
  const pointers = new Map(); // pointerId → {x,y} in CANVAS px (active touches / mouse)
  let panStart = null; // { x, y, cx, cy } in canvas space — one-pointer pan origin
  let pinchPrev = null; // last two-pointer frame {a,b} — pinch-zoom

  const twoPointerFrame = () => {
    const [a, b] = [...pointers.values()];
    return { a, b };
  };
  const seatPan = () => {
    // (re)seat the one-pointer pan origin from the sole remaining pointer + current VIEW
    const [p] = [...pointers.values()];
    panStart = { x: p.x, y: p.y, cx: VIEW.cx, cy: VIEW.cy };
  };

  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, clientToCanvas(e.clientX, e.clientY));
    moved = false; // reset per press — the click guard reads this
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* inactive pointer id; pan still works */
    }
    if (pointers.size >= 2) {
      pinchPrev = twoPointerFrame(); // enter pinch mode
      panStart = null;
    } else {
      seatPan();
      pinchPrev = null;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, clientToCanvas(e.clientX, e.clientY));
    if (pointers.size >= 2 && pinchPrev) {
      const cur = twoPointerFrame();
      const g = pinch(pinchPrev, cur);
      VIEW = zoomAt(VIEW, g.factor, g.cx, g.cy);
      pinchPrev = cur;
      moved = true; // a pinch is never a tap
      draw();
    } else if (pointers.size === 1 && panStart) {
      const c = pointers.get(e.pointerId);
      const dx = c.x - panStart.x;
      const dy = c.y - panStart.y;
      if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
      if (moved) {
        VIEW.cx = panStart.cx + dx;
        VIEW.cy = panStart.cy + dy;
        draw();
      }
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* nothing captured — fine */
    }
    // NB: `moved` persists until the next pointerdown (the click guard needs it).
    if (pointers.size === 1) {
      seatPan(); // 2→1: re-seat pan from the remaining finger — no jump
      pinchPrev = null;
    } else if (pointers.size === 0) {
      panStart = null;
      pinchPrev = null;
    }
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault(); // don't scroll the page
      const c = clientToCanvas(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      VIEW = zoomAt(VIEW, factor, c.x, c.y);
      draw();
    },
    { passive: false },
  );

  const DEFAULT_VIEW = { ...VIEW };
  document.getElementById("zoom-in").addEventListener("click", () => {
    VIEW = zoomAt(VIEW, 1.3, canvas.width / 2, canvas.height / 2);
    draw();
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    VIEW = zoomAt(VIEW, 1 / 1.3, canvas.width / 2, canvas.height / 2);
    draw();
  });
  document.getElementById("zoom-reset").addEventListener("click", () => {
    VIEW = { ...DEFAULT_VIEW };
    draw();
  });

  canvas.addEventListener("click", (e) => {
    if (moved) return; // a pan/pinch just happened — not a click (R-0024 AC2)
    if (!activePersona) return; // not interactive until a persona is chosen (AC1)
    const { x: mx, y: my } = clientToCanvas(e.clientX, e.clientY); // canvas px (R-0037)

    const graph = doc.to_graph();
    // R-0033 — the map is browsable: hit-test the last-drawn placement (no
    // reachability gate). Discs win over bridges; `hitTest` iterates `points`
    // keys so it is total (SPEC-0043 §2.4). Opening a disc is "studying" it.
    const id = hitTest(points, mx, my, { bridges: graph.bridges(), tol: 6 });
    if (id === null) return;
    const hit = graph.plateaus().find((p) => p.id === id);
    if (hit) {
      // Focusing a plateau is the wizard's position — announce it to peers
      // (ephemeral presence, R-0016 AC4). This is NOT a graph edit or an event.
      myPlateau = hit.id;
      announcePresence();
      // Opening = studying: sign a traversal toward the plateau (R-0010 AC2/AC3),
      // growing the plateau's OWN domain bucket (fallback: the persona's first
      // faced domain — an authored persona may face nothing, R-0009 AC6). The
      // signed event — never any graph edit — feeds reputation (now demoted to
      // rank/discovery; the map colours by progress, R-0033).
      const domain = DOMAIN_OF.get(hit.id) ?? activePersona.orient[0]?.domain;
      if (domain) signTraversal(domain, hit);
      // Visiting a topic is reading it: open the read view (R-0020). Purely
      // presentational — it does not edit the graph.
      openPlateau(hit);
      return;
    }
    // Not a disc → the id is a bridge (R-0029). Disc precedence is already handled
    // by hitTest (a disc under the cursor is returned first); opening a bridge
    // stays read-only.
    const b = graph.bridges().find((x) => x.id === id);
    if (b) openBridge(b, graph);
  });

  // ── Study context menu (right-click a topic) ─────────────────────────────────
  // The map is a graph of dots; "what do I do to study?" isn't obvious. Right-
  // clicking a topic surfaces the study verbs right where you clicked, each wired
  // to the existing study/companion flow. Left-click still opens the full drawer.
  const studyMenu = document.createElement("div");
  studyMenu.id = "study-menu";
  studyMenu.hidden = true;
  let studyMenuHit = null;
  function hideStudyMenu() {
    studyMenu.hidden = true;
    studyMenuHit = null;
  }
  // Opening a topic = studying it: sign a traversal (mirrors the left-click path).
  function studyHit(hit) {
    myPlateau = hit.id;
    announcePresence();
    const domain = DOMAIN_OF.get(hit.id) ?? activePersona?.orient?.[0]?.domain;
    if (domain) signTraversal(domain, hit);
    openPlateau(hit);
  }
  function studyMenuBtn(label, cls, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const h = studyMenuHit;
      hideStudyMenu();
      if (h) fn(h);
    });
    return b;
  }
  studyMenu.append(
    studyMenuBtn("📖  Study this topic", "primary", (h) => studyHit(h)),
    studyMenuBtn("✦  Explain it to me", "", (h) => {
      studyHit(h);
      studyAction(STUDY_ACTIONS.find((a) => a.key === "model"));
    }),
    studyMenuBtn("❓  Quiz me on it", "", (h) => {
      studyHit(h);
      studyAction(STUDY_ACTIONS.find((a) => a.key === "quiz"));
    }),
    studyMenuBtn("🔎  Search the web", "", (h) =>
      window.open(`https://www.perplexity.ai/search?q=${encodeURIComponent(h.name)}`, "_blank", "noopener"),
    ),
  );
  document.body.append(studyMenu);
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // no browser menu over the map
    if (!activePersona) return;
    const { x: mx, y: my } = clientToCanvas(e.clientX, e.clientY);
    const id = hitTest(points, mx, my, { bridges: [], tol: 6 }); // discs only
    const hit = id && doc.to_graph().plateaus().find((p) => p.id === id);
    if (!hit) {
      hideStudyMenu();
      return;
    }
    document.getElementById("map-hint")?.setAttribute("hidden", ""); // learned it
    studyMenuHit = hit;
    studyMenu.hidden = false;
    studyMenu.style.left = `${Math.min(e.clientX, window.innerWidth - studyMenu.offsetWidth - 8)}px`;
    studyMenu.style.top = `${Math.min(e.clientY, window.innerHeight - studyMenu.offsetHeight - 8)}px`;
  });
  document.addEventListener("mousedown", (e) => {
    if (!studyMenu.contains(e.target)) hideStudyMenu();
  });
  canvas.addEventListener("pointerdown", hideStudyMenu);

  // ── Plateau read view (SPEC-0020 / R-0020) ──────────────────────────────────
  // Render a plateau's Markdown body (typeset math via lazy vendored KaTeX) plus
  // the resources anchored to it. Pure view over the DTO — no mutation. The body
  // is rendered through markdown.js's injection-safe renderer before innerHTML.
  const detail = document.getElementById("plateau-detail");
  const detailName = document.getElementById("detail-name");
  const detailBody = document.getElementById("detail-body");
  const detailReply = document.getElementById("detail-reply");
  const detailResources = document.getElementById("detail-resources");
  const detailBridge = document.getElementById("detail-bridge");
  const detailMastery = document.getElementById("detail-mastery");
  // Prove it (R-0032): the AI-checked proof box is a STATIC SIBLING of
  // #detail-mastery (so renderMastery's replaceChildren never wipes the draft);
  // its nodes are queried once here and wired once below.
  const detailProof = document.getElementById("detail-proof");
  const proofPalette = document.getElementById("proof-palette");
  const proofInput = document.getElementById("proof-input");
  const proofPreview = document.getElementById("proof-preview");
  const proofCheck = document.getElementById("proof-check");
  const proofFeedback = document.getElementById("proof-feedback");
  function hideProofBox() {
    detailProof.hidden = true;
    proofInput.value = "";
    proofPreview.replaceChildren();
    proofFeedback.textContent = "";
  }
  // Solve it (R-0034): the CAS-checked answer box — also a STATIC SIBLING of
  // #detail-mastery (survives replaceChildren); nodes queried once, wired below.
  const detailSolve = document.getElementById("detail-solve");
  const solvePrompt = document.getElementById("solve-prompt");
  const solvePalette = document.getElementById("solve-palette");
  const solveNewBtn = document.getElementById("solve-new");
  const solveInput = document.getElementById("solve-input");
  const solvePreview = document.getElementById("solve-preview");
  const solveCheck = document.getElementById("solve-check");
  const solveFeedback = document.getElementById("solve-feedback");
  let solveCurrent = null; // the active problem { prompt, reference, variable, check }
  let solveNext = null; // () → the next problem for the open plateau (challenges then drills)
  function hideSolveBox() {
    detailSolve.hidden = true;
    solveInput.value = "";
    solvePreview.replaceChildren();
    solveFeedback.textContent = "";
    solvePrompt.replaceChildren();
    solveCurrent = null;
    solveNext = null;
  }
  // Persist & share (R-0036): the proofs panel (static sibling in the drawer).
  // Local-keep by default (mp.proofs, PRIVATE), opt-in publish signs a KIND_PROOF
  // event onto the verified log. Saving NEVER touches the log; publishing is a
  // distinct, explicit act (and a gossiped signed event can't be unpublished).
  const detailProofs = document.getElementById("detail-proofs");
  const PROOFS_KEY = "mp.proofs";
  function loadProofs() {
    try {
      return JSON.parse(localStorage.getItem(PROOFS_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveProof(plateauId, kind, body) {
    if (!body || !body.trim()) return;
    const all = loadProofs();
    all[plateauId] = { kind, body }; // latest-wins per topic; PRIVATE — never on the log
    try {
      localStorage.setItem(PROOFS_KEY, JSON.stringify(all));
    } catch {
      /* quota — ignore */
    }
  }
  function publishProof(plateauId) {
    const entry = loadProofs()[plateauId];
    if (!entry) return;
    try {
      ingest(identity.sign_proof(plateauId, entry.kind, entry.body)); // signs + rides the log (R-0010)
      if (studyPlateau) renderProofs(studyPlateau);
    } catch (err) {
      console.error("[mp] sign_proof failed:", err);
    }
  }
  // The proofs view: your saved (private) artifact + everyone's published ones.
  // Untrusted text → body via the R-0020 safe renderer; attribution via textContent.
  function renderProofs(p) {
    detailProofs.replaceChildren();
    const kindLabel = (k) => (k === "solution" ? "solution" : "proof");
    const local = loadProofs()[p.id];
    if (local) {
      const head = document.createElement("div");
      head.className = "proofs-head";
      head.textContent = `Your saved ${kindLabel(local.kind)} (private)`;
      const body = document.createElement("div");
      body.className = "proofs-body";
      body.innerHTML = renderMarkdown(local.body); // SAFE sanitiser — learner text inert
      typesetMath(body);
      const pub = document.createElement("button");
      pub.type = "button";
      pub.className = "proofs-publish";
      pub.textContent = "Publish to the shared log";
      pub.addEventListener("click", () => publishProof(p.id));
      const note = document.createElement("div");
      note.className = "proofs-note";
      note.textContent = "Publishing signs this to the shared log — it can't be unpublished.";
      detailProofs.append(head, body, pub, note);
    }
    const published = publishedProofs(log.all(), p.id);
    if (published.length) {
      const head = document.createElement("div");
      head.className = "proofs-head";
      head.textContent = "Published proofs";
      detailProofs.append(head);
      for (const pr of published) {
        const who = document.createElement("div");
        who.className = "proofs-who";
        // textContent — pubkey/kind are peer-derived (never innerHTML)
        who.textContent = `${pr.pubkey === myPubkey ? "you" : shortKey(pr.pubkey)} · ${kindLabel(pr.kind)}`;
        const body = document.createElement("div");
        body.className = "proofs-body";
        body.innerHTML = renderMarkdown(pr.body); // SAFE sanitiser — untrusted peer text inert
        typesetMath(body);
        detailProofs.append(who, body);
      }
    }
  }

  const STONE_WEIGHT = 10; // the existing place-stone default (R-0015); grow-only
  let studyPlateau = null; // the plateau currently open in the Study view

  function openPlateau(p) {
    detail.dataset.mode = "plateau"; // FIRST — restores body/study/resources from a bridge view (R-0029)
    studyPlateau = p;
    detailName.textContent = p.name; // textContent — never trust the name as HTML
    // R-0034: strip author ```solve blocks BEFORE rendering — markdown.js would
    // otherwise show the raw prompt:/answer: lines (and leak the answer).
    detailBody.innerHTML = renderMarkdown(
      stripChallenges(p.description || "") || "_No description yet._",
    );
    typesetMath(detailBody); // lazy, fire-and-forget; falls back to raw TeX
    detailReply.hidden = true; // clear any prior plateau's study answer
    detailReply.textContent = "";
    hideProofBox(); // R-0032: a different topic — clear+hide any prior proof draft
    hideSolveBox(); // R-0034: same — clear+hide any prior solve problem
    renderStudyResources();
    renderMastery(p); // R-0030 "Mark as mastered" / "✓ Mastered"
    renderProofs(p); // R-0036 your saved proof/solution + published ones
    renderAlsoPin(p.id); // R-0028 multi-pin checklist of OTHER topics
    renderSearchLinks(p); // deep-links to look this topic up elsewhere
    detail.hidden = false;
  }

  // "Look it up" — external search deep-links prefilled with the plateau name.
  // Each opens in a new tab (rel=noopener); the learner chooses to click. The
  // name is URL-encoded and set via textContent — never interpolated as HTML.
  const detailSearch = document.getElementById("detail-search");
  const SEARCH_ENGINES = [
    { label: "Perplexity", url: (q) => `https://www.perplexity.ai/search?q=${q}` },
    { label: "Wikipedia", url: (q) => `https://en.wikipedia.org/w/index.php?search=${q}` },
    { label: "Scholar", url: (q) => `https://scholar.google.com/scholar?q=${q}` },
  ];
  function renderSearchLinks(p) {
    const q = encodeURIComponent(String(p?.name ?? "").slice(0, 200));
    detailSearch.replaceChildren(
      ...SEARCH_ENGINES.map((e) => {
        const a = document.createElement("a");
        a.href = e.url(q);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = e.label;
        return a;
      }),
    );
  }

  // R-0030 — the mastery control: a "✓ Mastered" badge if already mastered, else
  // "Mark as mastered" which runs the Quiz me self-test and reveals a confirm
  // ("I can answer these") that signs the mastery event. Self-attested gate —
  // nothing is signed without running the test and confirming.
  function renderMastery(p) {
    detailMastery.replaceChildren();
    if (mastered.has(p.id)) {
      const done = document.createElement("span");
      done.className = "mastered-badge";
      done.textContent = "✓ Mastered";
      detailMastery.append(done);
      return;
    }
    const markBtn = document.createElement("button");
    markBtn.type = "button";
    markBtn.className = "mastery-mark";
    markBtn.textContent = "Mark as mastered";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "mastery-confirm";
    confirm.textContent = "✓ I can answer these — mark mastered";
    confirm.hidden = true; // only after the self-test runs
    markBtn.addEventListener("click", () => {
      studyAction(STUDY_ACTIONS.find((a) => a.key === "quiz")); // run the recall self-test
      confirm.hidden = false; // now the attestation is available
    });
    confirm.addEventListener("click", () => {
      signMastery(p); // ingest → recomputeMastered → draw
      renderMastery(p); // becomes "✓ Mastered"
    });
    detailMastery.append(markBtn, confirm);
    // R-0032 — "Prove it (AI-checked)": only when a model is connected (offline
    // has no judge, so the self-attest path above stands alone). Toggles the
    // sibling #detail-proof box; opening a different topic hides + clears it.
    if (modelConfig.kind !== "fake") {
      const proveBtn = document.createElement("button");
      proveBtn.type = "button";
      proveBtn.className = "mastery-mark";
      proveBtn.textContent = "Prove it (AI-checked)";
      proveBtn.addEventListener("click", () => {
        detailProof.hidden = !detailProof.hidden;
        if (!detailProof.hidden) proofInput.focus();
      });
      detailMastery.append(proveBtn);
    }
    // R-0034 — "Solve it (CAS-checked)": shown when the topic is QUANTITATIVE
    // (offers generated drills or an author ```solve challenge). NOT model-gated —
    // the check is local + deterministic (the rigorous OFFLINE rung).
    const quantitative = drillsFor(p).length > 0 || parseChallenges(p.description || "").length > 0;
    if (quantitative) {
      const solveBtn = document.createElement("button");
      solveBtn.type = "button";
      solveBtn.className = "mastery-mark";
      solveBtn.textContent = "Solve it (CAS-checked)";
      solveBtn.addEventListener("click", () => {
        if (detailSolve.hidden) openSolve(p);
        else hideSolveBox();
      });
      detailMastery.append(solveBtn);
    }
  }

  // A bridge is a CONNECTION, not a topic (R-0029): clicking it opens a read-only
  // view of the concept, the two topics it joins (each opens its Study view), and
  // the books that span both ends (R-0028). It signs NO traversal, announces NO
  // presence, and makes NO graph edit — a bridge is not a reachable position.
  function openBridge(b, graph) {
    detail.dataset.mode = "bridge"; // CSS hides body/study/reply/resources/add
    detailName.textContent = b.concept || "Connection";
    const plats = graph.plateaus();
    const byId = new Map(plats.map((p) => [p.id, p]));
    detailBridge.replaceChildren();

    const head = document.createElement("p");
    head.className = "bridge-connects";
    head.append(document.createTextNode("Connects: "));
    for (const [i, endId] of [b.from, b.to].entries()) {
      const p = byId.get(endId);
      if (i > 0) head.append(document.createTextNode(" ↔ "));
      if (!p) {
        head.append(document.createTextNode("(unknown)"));
        continue;
      }
      const link = document.createElement("button");
      link.type = "button";
      link.className = "bridge-topic";
      link.textContent = p.name; // textContent — inert
      link.addEventListener("click", () => openPlateau(p));
      head.append(link);
    }
    detailBridge.append(head);

    const shared = bridgeResources({ resources: graph.resources(), fromId: b.from, toId: b.to });
    const label = document.createElement("p");
    label.className = "bridge-res-label";
    label.textContent = shared.length
      ? "Books that span both:"
      : "No resources span both topics yet.";
    detailBridge.append(label);
    if (shared.length) {
      const ul = document.createElement("ul");
      ul.className = "res-list";
      for (const r of shared) {
        const li = document.createElement("li");
        const kind = document.createElement("span");
        kind.className = "res-kind";
        kind.textContent = r.kind;
        li.append(kind, document.createTextNode(" "));
        const href = safeHref(r.uri);
        if (href) {
          const a = document.createElement("a");
          a.href = href;
          a.rel = "noopener noreferrer";
          a.target = "_blank";
          a.textContent = r.title;
          li.append(a);
        } else {
          li.append(document.createTextNode(r.title));
        }
        ul.append(li);
      }
      detailBridge.append(ul);
    }
    detail.hidden = false;
  }

  // The study answer shown INSIDE the detail drawer, where the buttons are: the
  // global companion panel (still the transcript of record) sits behind this
  // fixed drawer, so a study reply must surface here to be seen. textContent
  // only — never innerHTML (no injection).
  function showStudyReply(text) {
    detailReply.textContent = text;
    detailReply.hidden = false;
  }

  // Resources anchored to the open plateau, ranked best-first (R-0023): each row
  // shows the weighted-vote count (rounded for display only — it is the R-0015
  // weighted SUM, not an integer tally), a bedrock badge when Crystallized, and a
  // ＋ stone button on the audited grow-only vote path. Reuses the safeHref
  // chokepoint for the link, exactly as the old flat list did.
  function renderStudyResources() {
    if (!studyPlateau) return;
    const g = doc.to_graph();
    const allResources = g.resources(); // full set — to thread cross-cutting books (R-0028)
    const allPlateaus = g.plateaus();
    const rs = allResources.filter((r) => r.plateau_id === studyPlateau.id);
    detailResources.replaceChildren();
    if (rs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "detail-empty";
      empty.textContent = "No resources pinned here yet — add a book, link, or video below.";
      detailResources.append(empty);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "res-list";
    for (const r of rankResources(rs)) {
      const li = document.createElement("li");
      const crystallized = r.state === "Crystallized";

      const kind = document.createElement("span");
      kind.className = "res-kind";
      kind.textContent = r.kind; // DTO enum string; textContent keeps it inert
      li.append(kind, document.createTextNode(" "));

      const href = safeHref(r.uri); // http(s)/mailto only — else plain, inert title
      if (href) {
        const a = document.createElement("a");
        a.href = href;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        a.textContent = r.title;
        li.append(a);
      } else {
        li.append(document.createTextNode(r.title));
      }

      const stones = document.createElement("span");
      stones.className = crystallized ? "res-stones bedrock" : "res-stones";
      stones.textContent = crystallized
        ? `◆ ${Math.round(r.vote_count)}`
        : `● ${Math.round(r.vote_count)}`;
      stones.title = crystallized ? "crystallized — community-vouched" : "weighted stones";
      li.append(stones);

      const vote = document.createElement("button");
      vote.type = "button";
      vote.className = "res-stone-btn";
      vote.textContent = "＋ stone";
      vote.addEventListener("click", () => {
        try {
          doc.vote(r.id, myVoterId, STONE_WEIGHT); // audited grow-only path (R-0015)
        } catch {
          return; // a bad id never crashes the panel
        }
        sync.pump();
        pumpPeer();
        persist();
        draw();
        renderStudyResources();
      });
      li.append(vote);

      // "Also covers" (R-0028): other topics where the SAME book (URL) is pinned.
      const also = crossLinks({
        resources: allResources,
        plateaus: allPlateaus,
        uri: r.uri,
        currentPlateauId: studyPlateau.id,
      });
      if (also.length) {
        const line = document.createElement("div");
        line.className = "res-also";
        line.append(document.createTextNode("Also covers: "));
        also.forEach((t, i) => {
          if (i > 0) line.append(document.createTextNode(" · "));
          const link = document.createElement("button");
          link.type = "button";
          link.className = "res-also-link";
          link.textContent = t.count > 0 ? `${t.name} ●${Math.round(t.count)}` : t.name;
          link.addEventListener("click", () => {
            const target = allPlateaus.find((p) => p.id === t.id);
            if (target) openPlateau(target);
          });
          line.append(link);
        });
        li.append(line);
      }
      ul.append(li);
    }
    detailResources.append(ul);
  }

  // Add a resource (book / link / video) to the open plateau, inline (R-0023 AC3).
  const addTitle = document.getElementById("detail-add-title");
  const addKind = document.getElementById("detail-add-kind");
  const addUri = document.getElementById("detail-add-uri");
  const addError = document.getElementById("detail-add-error");
  for (const k of RESOURCE_KINDS) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    addKind.appendChild(o);
  }
  // R-0028 multi-pin: a collapsed checklist of OTHER plateaus, repopulated each
  // time a plateau opens, so one add can pin the same link across several topics.
  const alsoPinList = document.getElementById("detail-add-also-list");
  function renderAlsoPin(currentId) {
    alsoPinList.replaceChildren();
    const others = doc
      .to_graph()
      .plateaus()
      .filter((p) => p.id !== currentId)
      .sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
    for (const p of others) {
      const label = document.createElement("label");
      label.className = "also-pin-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = p.id;
      label.append(cb, document.createTextNode(" " + p.name)); // name via textNode — inert
      alsoPinList.append(label);
    }
  }

  document.getElementById("detail-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!studyPlateau) return;
    const spec = buildResource({
      plateau: studyPlateau.id,
      title: addTitle.value,
      kind: addKind.value,
      uri: addUri.value,
    });
    if (spec.error) {
      addError.textContent = spec.error;
      addError.hidden = false;
      return;
    }
    addError.hidden = true;
    doc.add_resource(spec.plateau, spec.title, spec.kind, spec.uri); // R-0014 binding
    // Also pin the same link to each checked topic (best-effort, per-id — a stale
    // id must not abort the rest or the pump/persist, parity with the stone path).
    for (const cb of alsoPinList.querySelectorAll("input:checked")) {
      try {
        doc.add_resource(cb.value, spec.title, spec.kind, spec.uri);
      } catch {
        /* stale/unknown plateau id — skip this one */
      }
    }
    sync.pump();
    pumpPeer();
    persist();
    draw();
    renderStudyResources();
    renderAlsoPin(studyPlateau.id); // reset the checklist (unchecked)
    addTitle.value = "";
    addUri.value = "";
  });

  // Study with the companion (R-0023 AC4): each action sends a prompt grounded in
  // a PLATEAU-SCOPED context (this topic's body + its resources) through the same
  // bring-your-own model turn the global companion uses. The plateau body —
  // possibly imported/synced peer content — rides to the configured endpoint under
  // the SAME trust boundary as R-0007 (the visitor's own endpoint, key in-browser).
  function studyAction(action) {
    if (!studyPlateau || !activePersona) return;
    const rs = doc
      .to_graph()
      .resources()
      .filter((r) => r.plateau_id === studyPlateau.id);
    companion.hidden = false;
    appendMessage("user", action.prompt);
    // OFFLINE (no model): a real, local extractive digest of THIS plateau's notes
    // + ranked resources instead of the echo (R-0026). Pure + synchronous.
    if (modelConfig.kind === "fake") {
      const reply = offlineDigest({ action: action.key, plateau: studyPlateau, resources: rs });
      appendMessage("bot", reply);
      showStudyReply(reply); // visible in the drawer, not just the occluded companion
      history.push({ role: "user", content: action.prompt }, { role: "assistant", content: reply });
      return;
    }
    showStudyReply("…"); // feedback in the drawer while the model answers
    // R-0034: strip any author ```solve answer from the grounding so it never rides to the model.
    const groundPlateau = {
      name: studyPlateau.name,
      description: stripChallenges(studyPlateau.description || ""),
    };
    const grounding = buildPlateauStudyContext({ plateau: groundPlateau, resources: rs });
    const messages = assembleMessages(voiceFor(activePersona), grounding, history, action.prompt);
    sendTurn(modelConfig, messages)
      .then((reply) => {
        appendMessage("bot", reply);
        showStudyReply(reply);
        // Shares the global transcript by design — one companion, one history
        // (R-0023): a plateau answer can context a later global turn, and vice-versa.
        history.push(
          { role: "user", content: action.prompt },
          { role: "assistant", content: reply },
        );
      })
      .catch((err) => {
        appendMessage("error", `⚠ ${err.message}`); // graceful (R-0007 AC4)
        showStudyReply(`⚠ ${err.message}`);
      });
  }
  const studyButtons = document.getElementById("detail-study");
  for (const a of STUDY_ACTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = a.label;
    btn.addEventListener("click", () => studyAction(a));
    studyButtons.append(btn);
  }

  // ── Rhizome drill-down (R-0044) ──────────────────────────────────────────────
  // Select a term inside a plateau's body → a floating menu offers a quick inline
  // gloss (Define / Example, through the companion) OR the rhizome move: GROW the
  // term into a brand-new plateau, placed next to its parent, BRIDGED to it by the
  // term itself, and opened so you can drill in and grow further — as deep as you
  // like. Not a dictionary popup: a durable, syncable, masterable node in the graph.
  const rhizMenu = document.createElement("div");
  rhizMenu.id = "rhizome-menu";
  rhizMenu.hidden = true;
  let rhizTerm = "";
  function hideRhizMenu() {
    rhizMenu.hidden = true;
    rhizTerm = "";
  }
  function rhizBtn(label, cls, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (cls) b.className = cls;
    // mousedown-preventDefault keeps the text selection alive through the click.
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const t = rhizTerm;
      hideRhizMenu();
      fn(t);
    });
    return b;
  }
  rhizMenu.append(
    rhizBtn("Define", "", (t) => askInline(t, "define")),
    rhizBtn("Example", "", (t) => askInline(t, "example")),
    rhizBtn("🌱 Grow a plateau", "grow", (t) => growPlateau(t)),
    rhizBtn("Add resource", "", (t) => {
      const titleInput = document.getElementById("detail-add-title");
      if (titleInput) {
        titleInput.value = t.trim().replace(/\s+/g, " ");
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: "smooth" });
      }
    }),
  );
  document.body.append(rhizMenu);

  // A quick inline gloss — routed through the SAME plateau-scoped companion turn
  // as the study actions (R-0023 trust boundary). No plateau is created.
  function askInline(term, mode) {
    const parent = studyPlateau;
    if (!parent || !activePersona) return;
    const prompt = inlinePrompt(term, parent.name, mode);
    companion.hidden = false;
    appendMessage("user", prompt);
    if (modelConfig.kind === "fake") {
      const msg = `Connect a model (Model setup) for a live answer — or 🌱 grow “${term}” into a plateau to explore it yourself.`;
      appendMessage("bot", msg);
      showStudyReply(msg);
      return;
    }
    showStudyReply("…");
    const rs = doc.to_graph().resources().filter((r) => r.plateau_id === parent.id);
    const groundPlateau = { name: parent.name, description: stripChallenges(parent.description || "") };
    const grounding = buildPlateauStudyContext({ plateau: groundPlateau, resources: rs });
    const messages = assembleMessages(voiceFor(activePersona), grounding, history, prompt);
    sendTurn(modelConfig, messages)
      .then((reply) => {
        appendMessage("bot", reply);
        showStudyReply(reply);
        history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
      })
      .catch((err) => {
        appendMessage("error", `⚠ ${err.message}`);
        showStudyReply(`⚠ ${err.message}`);
      });
  }

  // The rhizome move: grow the selected term into a nested, bridged plateau.
  async function growPlateau(rawTerm) {
    const parent = studyPlateau;
    if (!parent || !activePersona) return;
    const term = rawTerm.trim().replace(/\s+/g, " "); // normalize term once (Slice 4 dedup)

    const graph = doc.to_graph();
    const existing = existingChild(parent, term, graph.plateaus(), graph.bridges());
    if (existing) {
      const child = graph.plateaus().find((p) => p.id === existing);
      if (child) openPlateau(child);
      return;
    }

    // Inherit the parent's domain so the child lands on the same island; fall back
    // to the persona's first faced domain for an authored, domain-less parent.
    const domain = DOMAIN_OF.get(parent.id) ?? parent.domain_id ?? activePersona.orient?.[0]?.domain;
    if (!domain) return;
    const pos = childPosition(parent.position, term);
    let body = starterBody(term, parent.name); // offline default; a model fleshes it out
    if (modelConfig.kind !== "fake") {
      showStudyReply(`🌱 Growing “${term}”…`);
      try {
        const rs = doc.to_graph().resources().filter((r) => r.plateau_id === parent.id);
        const groundPlateau = { name: parent.name, description: stripChallenges(parent.description || "") };
        const grounding = buildPlateauStudyContext({ plateau: groundPlateau, resources: rs });
        const messages = assembleMessages(voiceFor(activePersona), grounding, history, draftPlateauPrompt(term, parent.name));
        const draft = await sendTurn(modelConfig, messages);
        if (draft && draft.trim()) body = `# ${term}\n\n${draft.trim()}`;
      } catch {
        /* keep the honest offline stub */
      }
    }

    const preview = document.getElementById("rhizome-preview");
    const rpName = document.getElementById("rp-name");
    const rpBody = document.getElementById("rp-body");
    const rpCancel = document.getElementById("rp-cancel");
    const rpCreate = document.getElementById("rp-create");
    
    rpName.value = term;
    rpBody.value = body;
    preview.hidden = false;
    
    const cleanup = () => {
      preview.hidden = true;
      rpCancel.removeEventListener("click", onCancel);
      rpCreate.removeEventListener("click", onCreate);
    };

    const onCancel = () => cleanup();
    const onCreate = () => {
      const finalName = rpName.value.trim() || term;
      const finalBody = rpBody.value;
      cleanup();

      let childId;
      try {
        // the wasm CRDT add path — do not use buildPlateau
        childId = doc.add_plateau(finalName, domain, pos.e1, pos.e2, pos.e3, finalBody);
      } catch (err) {
        console.error("[mp] grow plateau:", err);
        return;
      }
      DOMAIN_OF.set(childId, domain);
      try {
        doc.add_bridge(parent.id, childId, term);
      } catch (err) {
        console.error("[mp] grow bridge:", err);
      }
      sync.pump();
      pumpPeer();
      persist();
      draw();
      const child = doc.to_graph().plateaus().find((p) => p.id === childId);
      if (child) openPlateau(child);
    };

    rpCancel.addEventListener("click", onCancel);
    rpCreate.addEventListener("click", onCreate);
  }

  // Show the menu when a term is selected inside the plateau body; hide on scroll
  // or an outside click. Desktop pointer path (mouseup); touch is a follow-up.
  function showRhizMenu(term, rect) {
    rhizTerm = term;
    rhizMenu.hidden = false;
    const mx = Math.min(Math.max(rect.left, 8), window.innerWidth - rhizMenu.offsetWidth - 8);
    const above = rect.top - rhizMenu.offsetHeight - 8;
    const my = Math.min(above < 8 ? rect.bottom + 8 : above, window.innerHeight - rhizMenu.offsetHeight - 8);
    rhizMenu.style.left = `${mx}px`;
    rhizMenu.style.top = `${my}px`;
  }
  detailBody.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    const term = sel && !sel.isCollapsed ? sel.toString().trim() : "";
    if (!isGrowable(term)) {
      hideRhizMenu();
      return;
    }
    showRhizMenu(term, sel.getRangeAt(0).getBoundingClientRect());
  });
  
  let touchTimeout;
  document.addEventListener("selectionchange", () => {
    clearTimeout(touchTimeout);
    touchTimeout = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !detailBody.contains(sel.anchorNode)) return;
      const term = sel.toString().trim();
      if (!isGrowable(term)) return;
      showRhizMenu(term, sel.getRangeAt(0).getBoundingClientRect());
    }, 250);
  });

  detail.addEventListener("scroll", hideRhizMenu);
  document.addEventListener("mousedown", (e) => {
    if (!rhizMenu.contains(e.target)) hideRhizMenu();
  });

  // ── Prove it (R-0032 / SPEC-0032): the AI-checked proof box ─────────────────
  // A LaTeX proof input + symbol palette + live KaTeX preview + Check. On a PASS
  // verdict it signs the SAME mastery as the self-test (signMastery → ✓ + the
  // community count). The model is a JUDGE, not a verifier (the note says so);
  // the verdict parse is fail-safe. Wired once — the box is a static sibling, so
  // a draft survives renderMastery's replaceChildren.
  const PROOF_SYMBOLS = [
    ["∀", "\\forall "],
    ["∃", "\\exists "],
    ["∈", "\\in "],
    ["≤", "\\le "],
    ["≥", "\\ge "],
    ["⇒", "\\Rightarrow "],
    ["⇔", "\\iff "],
    ["√", "\\sqrt{}"],
    ["∑", "\\sum"],
    ["∫", "\\int"],
    ["a/b", "\\frac{}{}"],
    ["lim", "\\lim_{}"],
    ["$ $", "$$"],
  ];
  function insertAtCursor(el, text) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const brace = text.indexOf("{}"); // park the caret inside the first {} if any
    const caret = brace >= 0 ? start + brace + 1 : start + text.length;
    el.selectionStart = el.selectionEnd = caret;
    el.focus();
    el.dispatchEvent(new Event("input")); // refresh the live preview
  }
  for (const [label, latex] of PROOF_SYMBOLS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => insertAtCursor(proofInput, latex));
    proofPalette.append(b);
  }
  proofInput.addEventListener("input", () => {
    // R-0020 SAFE path: same sanitiser as a plateau body — the learner's
    // LaTeX/markdown is inert (no innerHTML injection), then KaTeX typesets it.
    proofPreview.innerHTML = renderMarkdown(proofInput.value);
    typesetMath(proofPreview);
  });
  proofCheck.addEventListener("click", () => {
    if (!studyPlateau || !activePersona) return;
    const proof = proofInput.value;
    if (!proof.trim()) {
      proofFeedback.textContent = "Write a proof or explanation first."; // signs nothing
      return;
    }
    const p = studyPlateau;
    const rs = doc
      .to_graph()
      .resources()
      .filter((r) => r.plateau_id === p.id);
    const groundPlateau = { name: p.name, description: stripChallenges(p.description || "") }; // R-0034: no leaked answer
    const grounding = buildPlateauStudyContext({ plateau: groundPlateau, resources: rs });
    // Empty history ([]) — grading is a stateless turn, not the chat transcript.
    // Only the MODEL's reply reaches parseVerdict (the proof rides in the user
    // message), so a learner can't self-grant by writing the verdict token.
    const messages = assembleMessages(
      voiceFor(activePersona),
      grounding,
      [],
      buildProofGrading({ plateau: p, proof }),
    );
    proofFeedback.textContent = "Checking…";
    sendTurn(modelConfig, messages)
      .then((reply) => {
        const { pass, feedback } = parseVerdict(reply);
        proofFeedback.textContent = feedback;
        if (pass) {
          signMastery(p); // the ONLY sign path — proof mastery == self-test mastery
          saveProof(p.id, "proof", proof); // R-0036 — keep it locally (private)
          renderMastery(p); // #detail-mastery becomes "✓ Mastered"
          renderProofs(p); // R-0036 — show the saved proof + Publish
        }
      })
      .catch((err) => {
        proofFeedback.textContent = `⚠ ${err.message}`; // graceful, signs nothing
      });
  });

  // ── Solve it (R-0034 / SPEC-0034): the CAS-checked answer box ───────────────
  // A problem (author ```solve challenge first, then generated drills), a plain-
  // math answer input + palette + live KaTeX preview, and a Check that runs the
  // LOCAL, deterministic equivalence engine (no model). Correct → signMastery
  // (the same ✓). Wired once — the box is a static sibling.
  const SOLVE_SYMBOLS = [
    ["x", "x"],
    ["^", "^"],
    ["( )", "()"],
    ["/", "/"],
    ["·", "*"],
    ["√", "sqrt()"],
    ["π", "pi"],
    ["sin", "sin()"],
    ["cos", "cos()"],
    ["ln", "ln()"],
  ];
  function solveInsert(text) {
    const el = solveInput;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const paren = text.indexOf("()"); // park the caret inside the first () if any
    const caret = paren >= 0 ? start + paren + 1 : start + text.length;
    el.selectionStart = el.selectionEnd = caret;
    el.focus();
    el.dispatchEvent(new Event("input")); // refresh the live preview
  }
  for (const [label, ins] of SOLVE_SYMBOLS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => solveInsert(ins));
    solvePalette.append(b);
  }
  function renderSolveProblem() {
    if (!solveCurrent) return;
    solvePrompt.innerHTML = renderMarkdown(solveCurrent.prompt || "Solve:"); // app/author markdown — safe sanitiser
    typesetMath(solvePrompt);
  }
  // Build the problem provider for plateau `p`: authored challenges first, then
  // generated drills (cycling the topic's operations with an incrementing seed).
  function openSolve(p) {
    const challenges = parseChallenges(p.description || "");
    const ops = drillsFor(p);
    let idx = 0;
    solveNext = () => {
      if (idx < challenges.length) {
        const c = challenges[idx++];
        return { prompt: c.prompt, reference: c.answer, variable: c.variable, check: c.check };
      }
      if (ops.length === 0) {
        const c = challenges[idx++ % challenges.length]; // only authored — cycle them
        return { prompt: c.prompt, reference: c.answer, variable: c.variable, check: c.check };
      }
      const op = ops[(idx - challenges.length) % ops.length];
      return generateDrill({ operation: op, seed: idx++ }); // pure given the seed
    };
    solveNewBtn.hidden = !(ops.length > 0 || challenges.length > 1); // hide if a single fixed problem
    solveCurrent = solveNext();
    solveInput.value = "";
    solvePreview.replaceChildren();
    solveFeedback.textContent = "";
    renderSolveProblem();
    detailSolve.hidden = false;
    solveInput.focus();
  }
  solveInput.addEventListener("input", () => {
    // Live preview via toTeX(parseExpr(...)) — a parsed bounded AST, rendered by
    // KaTeX (trust:false). Parse failure ⇒ textContent of the raw input (never
    // innerHTML of learner text).
    const src = solveInput.value;
    try {
      const tex = toTeX(parseExpr(src, solveCurrent?.variable || "x"));
      const span = document.createElement("span");
      span.className = "mp-math";
      span.setAttribute("data-tex", tex);
      span.textContent = tex; // fallback if KaTeX is unavailable
      solvePreview.replaceChildren(span);
      typesetMath(solvePreview);
    } catch {
      solvePreview.textContent = src; // inert — never innerHTML
    }
  });
  solveNewBtn.addEventListener("click", () => {
    if (!solveNext) return;
    solveCurrent = solveNext();
    solveInput.value = "";
    solvePreview.replaceChildren();
    solveFeedback.textContent = "";
    renderSolveProblem();
    solveInput.focus();
  });
  solveCheck.addEventListener("click", () => {
    if (!solveCurrent || !studyPlateau) return;
    const ans = solveInput.value;
    if (!ans.trim()) {
      solveFeedback.textContent = "Enter an answer first."; // signs nothing
      return;
    }
    // LOCAL deterministic check (no model). Conservative — a wrong/unparseable
    // answer signs nothing.
    const { equivalent, reason } = checkEquivalence(
      ans,
      solveCurrent.reference,
      solveCurrent.check,
    );
    solveFeedback.textContent = equivalent
      ? "✓ Correct — verified equivalent to the answer."
      : reason;
    if (equivalent) {
      signMastery(studyPlateau); // the ONLY sign path — same mastery as self-test / proof
      saveProof(studyPlateau.id, "solution", ans); // R-0036 — keep it locally (private)
      renderMastery(studyPlateau); // #detail-mastery becomes "✓ Mastered"
      renderProofs(studyPlateau); // R-0036 — show the saved solution + Publish
    }
  });

  document.getElementById("detail-close").addEventListener("click", () => {
    detail.hidden = true;
  });

  // ── Draft Plateau form (SPEC-0011 / R-0011) ─────────────────────────────────
  // The toggle button shows/hides the <details> panel; the form submit wires
  // buildPlateau → WasmCrdtDoc.add_plateau → CRDT sync → draw.

  // Populate the domain <select> from allDomains() — built-ins + authored (R-0038), human
  // labels, no raw UUIDs shown. Clears first so re-populating after an add-lens doesn't
  // duplicate the built-ins (architect finding #5).
  const dpDomain = document.getElementById("dp-domain");
  function populateDomainSelect() {
    dpDomain.replaceChildren();
    for (const d of allDomains()) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.label;
      dpDomain.appendChild(opt);
    }
  }
  populateDomainSelect();
  // Let the creator (a different scope) refresh the select when a lens is authored.
  refreshDomainSelect = populateDomainSelect;

  // Single-source the "Add a lens" suggestions (SPEC-0038) from SUGGESTED_DOMAINS.
  const lensSuggestions = document.getElementById("domain-suggestions");
  if (lensSuggestions) {
    for (const s of SUGGESTED_DOMAINS) {
      const opt = document.createElement("option");
      opt.value = s.name;
      lensSuggestions.appendChild(opt);
    }
  }

  // Toggle button shows/hides the collapsible panel.
  const draftPanel = document.getElementById("draft-plateau");
  document.getElementById("draft-plateau-toggle").addEventListener("click", () => {
    draftPanel.hidden = !draftPanel.hidden;
    if (!draftPanel.hidden) draftPanel.open = true;
  });

  document.getElementById("draft-plateau-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const spec = buildPlateau({
      name: document.getElementById("dp-name").value,
      domain: dpDomain.value,
      e1: parseFloat(document.getElementById("dp-e1").value),
      e2: parseFloat(document.getElementById("dp-e2").value),
      e3: parseFloat(document.getElementById("dp-e3").value),
      description: document.getElementById("dp-body").value, // Markdown body (R-0020), optional
    });
    const errEl = document.getElementById("dp-error");
    if (spec.error) {
      errEl.textContent = spec.error;
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    // Add to the CRDT doc and broadcast (AC2/AC3/AC4). The body rides the
    // plateau's `description` field already serialized into the CRDT (R-0020).
    const id = doc.add_plateau(spec.name, spec.domain, spec.e1, spec.e2, spec.e3, spec.description);
    DOMAIN_OF.set(id, spec.domain); // register for traversal scoring
    sync.pump(); // broadcast the CRDT change to other tabs
    pumpPeer(); // …and to a connected P2P peer (R-0018), if any
    persist(); // R-0012: snapshot to IndexedDB so the drafted plateau survives a reload
    draw();
    // Reset name + body fields; sliders stay at their last positions.
    document.getElementById("dp-name").value = "";
    document.getElementById("dp-body").value = "";
  });

  // ── Draft Bridge form (SPEC-0013 / R-0013) ──────────────────────────────────
  // Connect two existing plateaus with a concept label. The rotor is computed in
  // Rust by Bridge::between; JS passes only (from, to, concept).

  const dbFrom = document.getElementById("db-from");
  const dbTo = document.getElementById("db-to");

  // Rebuild both endpoint selects from the CURRENT graph, so plateaus authored
  // this session (or synced in) are selectable (AC1).
  function refreshBridgeOptions() {
    const ps = doc.to_graph().plateaus(); // [{ id, name, domain_id, position }]
    for (const sel of [dbFrom, dbTo]) {
      sel.replaceChildren(
        ...ps.map((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name;
          return o;
        }),
      );
    }
  }

  const bridgePanel = document.getElementById("draft-bridge");
  document.getElementById("draft-bridge-toggle").addEventListener("click", () => {
    bridgePanel.hidden = !bridgePanel.hidden;
    if (!bridgePanel.hidden) {
      bridgePanel.open = true;
      refreshBridgeOptions();
    }
  });

  document.getElementById("draft-bridge-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const spec = buildBridge({
      from: dbFrom.value,
      to: dbTo.value,
      concept: document.getElementById("db-concept").value,
    });
    const errEl = document.getElementById("db-error");
    if (spec.error) {
      errEl.textContent = spec.error;
      errEl.hidden = false;
      return;
    }
    try {
      // Rotor computed in Rust (AC5). Throws JsError on unknown endpoint/bad UUID.
      doc.add_bridge(spec.from, spec.to, spec.concept);
    } catch {
      errEl.textContent = "Could not add bridge.";
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    sync.pump(); // broadcast to other tabs (AC4)
    pumpPeer(); // …and to a connected P2P peer (R-0018)
    persist(); // durable snapshot (AC4, R-0012)
    draw(); // the labelled line appears same frame (AC2)
    document.getElementById("db-concept").value = "";
  });

  // ── Drop a Marker form (SPEC-0014 / R-0014) ─────────────────────────────────
  // Anchor a note/resource to an existing plateau. State + vote_count are fixed
  // in Rust (Resource::new); JS passes only (plateau, title, kind, uri).

  const dmPlateau = document.getElementById("dm-plateau");
  const dmTitle = document.getElementById("dm-title");
  const dmKind = document.getElementById("dm-kind");
  const dmUri = document.getElementById("dm-uri");

  // The kind set never changes — populate #dm-kind once from RESOURCE_KINDS.
  for (const k of RESOURCE_KINDS) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    dmKind.appendChild(o);
  }

  // Rebuild #dm-plateau from the CURRENT graph on open, so session-authored or
  // synced-in plateaus are anchorable (AC1).
  function refreshMarkerPlateaus() {
    dmPlateau.replaceChildren(
      ...doc
        .to_graph()
        .plateaus()
        .map((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name;
          return o;
        }),
    );
  }

  const markerPanel = document.getElementById("drop-marker");
  document.getElementById("drop-marker-toggle").addEventListener("click", () => {
    markerPanel.hidden = !markerPanel.hidden;
    if (!markerPanel.hidden) {
      markerPanel.open = true;
      refreshMarkerPlateaus();
    }
  });

  document.getElementById("drop-marker-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const spec = buildResource({
      plateau: dmPlateau.value,
      title: dmTitle.value,
      kind: dmKind.value,
      uri: dmUri.value,
    });
    const errEl = document.getElementById("dm-error");
    if (spec.error) {
      errEl.textContent = spec.error;
      errEl.hidden = false;
      return;
    }
    try {
      // State/vote fixed in Rust (AC5). Throws on unknown plateau/bad UUID.
      doc.add_resource(spec.plateau, spec.title, spec.kind, spec.uri);
    } catch {
      errEl.textContent = "Could not add marker.";
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    sync.pump(); // broadcast (AC4)
    pumpPeer(); // …and to a connected P2P peer (R-0018)
    persist(); // durable snapshot (AC4, R-0012)
    draw(); // the marker appears near its plateau same frame (AC2)
    dmTitle.value = "";
    dmUri.value = "";
  });

  // ── Place a Stone form (SPEC-0015 / R-0015) ─────────────────────────────────
  // Vote on a marker; crossing CRYSTALLIZE_THRESHOLD flips it to Crystallized.
  // The voter id is the CANONICAL wizard_id_of(pubkey) — the same id reputation
  // and discovery use (never a parallel mapping). State is computed in to_graph,
  // never set here.

  const myVoterId = wizard_id_of(myPubkey);
  const vsMarker = document.getElementById("vs-marker");
  const vsWeight = document.getElementById("vs-weight");

  // Rebuild the marker select from the current graph on open, showing each
  // marker's running total toward the threshold.
  function refreshVoteMarkers() {
    const threshold = crystallize_threshold();
    vsMarker.replaceChildren(
      ...doc
        .to_graph()
        .resources()
        .map((r) => {
          const o = document.createElement("option");
          o.value = r.id;
          o.textContent = `${r.title} (${Math.round(r.vote_count)}/${threshold})`;
          return o;
        }),
    );
  }

  const stonePanel = document.getElementById("place-stone");
  document.getElementById("place-stone-toggle").addEventListener("click", () => {
    stonePanel.hidden = !stonePanel.hidden;
    if (!stonePanel.hidden) {
      stonePanel.open = true;
      refreshVoteMarkers();
    }
  });

  document.getElementById("place-stone-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const spec = buildVote({ resource: vsMarker.value, weight: vsWeight.value });
    const errEl = document.getElementById("vs-error");
    if (spec.error) {
      errEl.textContent = spec.error;
      errEl.hidden = false;
      return;
    }
    try {
      // Cast this wizard's grow-only weight; crystallization is derived in Rust.
      doc.vote(spec.resource, myVoterId, spec.weight);
    } catch {
      errEl.textContent = "Could not place stone.";
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    sync.pump(); // broadcast the vote (AC4)
    pumpPeer(); // …and to a connected P2P peer (R-0018)
    persist(); // durable snapshot (AC4, R-0012)
    draw(); // vote_count + crystallization re-derive in to_graph() (AC2/AC3)
    refreshVoteMarkers(); // reflect the new total in the open select
  });

  // ── Connect a peer (SPEC-0018 / R-0018) ─────────────────────────────────────
  // Manual copy-paste WebRTC signaling. Every handler try/catches so a bad blob
  // or a failed connection is an inline error, never an uncaught throw (AC4).
  const p2pOffer = document.getElementById("p2p-offer");
  const p2pAnswer = document.getElementById("p2p-answer");
  const p2pStatus = document.getElementById("p2p-status");
  const p2pError = document.getElementById("p2p-error");
  const peerPanel = document.getElementById("connect-peer");

  document.getElementById("connect-peer-toggle").addEventListener("click", () => {
    peerPanel.hidden = !peerPanel.hidden;
    if (!peerPanel.hidden) peerPanel.open = true;
  });

  function p2pFail(msg) {
    p2pError.textContent = msg;
    p2pError.hidden = false;
  }
  function p2pOk() {
    p2pError.hidden = true;
  }
  // On connect, reflect status; the pump (onOpen) catches the peer up automatically.
  function watchPeerOpen() {
    const tick = setInterval(() => {
      if (peer && peer.isOpen()) {
        p2pStatus.textContent = "connected — graphs are syncing peer-to-peer";
        clearInterval(tick);
      }
    }, 500);
  }

  document.getElementById("p2p-create").addEventListener("click", async () => {
    try {
      p2pOk();
      startPeer();
      p2pOffer.value = await peer.createOffer();
      p2pStatus.textContent = "invite created — send it to your peer, then paste their answer";
      watchPeerOpen();
    } catch (e) {
      p2pFail(`could not create invite: ${e}`);
    }
  });
  document.getElementById("p2p-accept").addEventListener("click", async () => {
    try {
      p2pOk();
      startPeer();
      p2pAnswer.value = await peer.acceptOffer(p2pOffer.value.trim());
      p2pStatus.textContent = "answer ready — send it back to the inviter";
      watchPeerOpen();
    } catch (e) {
      p2pFail(`could not accept invite: ${e}`);
    }
  });
  document.getElementById("p2p-complete").addEventListener("click", async () => {
    try {
      if (!peer) throw new Error("create an invite first");
      p2pOk();
      await peer.acceptAnswer(p2pAnswer.value.trim());
      p2pStatus.textContent = "completing handshake…";
      watchPeerOpen();
    } catch (e) {
      p2pFail(`could not complete: ${e}`);
    }
  });

  // Forget my history: clear the local event log so reputation falls back to
  // nothing earned (only trailheads remain lit). Reach is recomputed from the log,
  // so there is no separate fog to reset (R-0010 AC3).
  document.getElementById("reset-fog").addEventListener("click", () => {
    log.clear();
    recompute();
    recomputeProgress(); // progress lives in the log too — reset → every topic unexplored (R-0030/R-0033)
    renderDiscovery();
    if (studyPlateau) renderMastery(studyPlateau); // refresh the open drawer's ✓ state
    draw();
  });

  // ── Import a world (SPEC-0021 / R-0021) ─────────────────────────────────────
  // Load an `mp-host import` save-blob (or any WasmCrdtDoc.save() blob) and MERGE
  // it into the current world (CRDT union — adds, never replaces). On success,
  // rebuild DOMAIN_OF so imported plateaus score on traversal, then broadcast +
  // persist + redraw. A malformed blob is an inline error, never an uncaught throw.
  const importStatus = document.getElementById("import-status");
  const importFile = document.getElementById("import-file");
  function importNote(msg, ok) {
    importStatus.textContent = msg;
    importStatus.style.color = ok ? "#9fd0b4" : "#ffb4a8";
    importStatus.hidden = false;
  }
  document.getElementById("import-world").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      doc.merge_bytes(bytes); // CRDT union; throws on a corrupt/non-Automerge blob
      // Imported plateaus carry their own domain — register it for traversal scoring.
      for (const p of doc.to_graph().plateaus()) DOMAIN_OF.set(p.id, p.domain_id);
      sync.pump(); // share the imported world with other tabs…
      pumpPeer(); // …and a connected P2P peer (R-0018)
      persist(); // durable snapshot (R-0012)
      draw();
      importNote(`imported "${file.name}" — explore the new islands`, true);
    } catch (e) {
      importNote(`could not import: ${e}`, false);
    } finally {
      importFile.value = ""; // allow re-importing the same file
    }
  });

  // ── Relay connect (SPEC-0010 §2.3, R-0010 AC7) ──────────────────────────
  const relayInput = document.getElementById("relay-url");
  relayInput.value = loadRelayUrl();
  document.getElementById("relay-connect").addEventListener("click", () => {
    const url = relayInput.value.trim();
    saveRelayUrl(url); // local only — never synced
    connectRelay(url);
  });
  document.getElementById("discover").addEventListener("click", renderDiscovery);

  // Connect to the saved relay (offline if none) before the first draw.
  connectRelay(loadRelayUrl());

  // Best-effort flush on tab hide so an edit made inside the debounce window is
  // not lost on close (closes the AC2/AC3 loss window; bfcache-safe event).
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") snapshots.flush();
  });

  // ── Learning paths (R-0039) ─────────────────────────────────────────────────
  const pathsPanel = document.getElementById("paths-panel");
  const pathPick = document.getElementById("path-pick");
  const pathTitle = document.getElementById("path-title");
  const pathGoal = document.getElementById("path-goal");
  const pathStepTopic = document.getElementById("path-step-topic");
  const pathStepsList = document.getElementById("path-steps-list");
  const pathProgressEl = document.getElementById("path-progress");
  const pathPublished = document.getElementById("path-published");
  let draftPathSteps = [];

  function plateauById(id) {
    return doc
      .to_graph()
      .plateaus()
      .find((p) => p.id === id);
  }

  function refreshPathTopics() {
    pathStepTopic.replaceChildren(
      ...doc
        .to_graph()
        .plateaus()
        .map((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name;
          return o;
        }),
    );
  }

  function renderDraftPathSteps() {
    pathStepsList.replaceChildren(
      ...draftPathSteps.map((id, i) => {
        const li = document.createElement("li");
        li.textContent = plateauById(id)?.name ?? id;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.textContent = "×";
        rm.style.marginLeft = "8px";
        rm.addEventListener("click", () => {
          draftPathSteps.splice(i, 1);
          renderDraftPathSteps();
        });
        li.append(rm);
        return li;
      }),
    );
    const prog = pathProgress(draftPathSteps, mastered);
    pathProgressEl.textContent = draftPathSteps.length
      ? `Draft progress: ${prog.done}/${prog.total} mastered`
      : "";
  }

  function refreshPathPick() {
    const all = loadPaths();
    const cur = pathPick.value;
    pathPick.replaceChildren(
      Object.assign(document.createElement("option"), { value: "", textContent: "— new path —" }),
      ...Object.values(all).map((p) =>
        Object.assign(document.createElement("option"), { value: p.id, textContent: p.title }),
      ),
    );
    pathPick.value = cur;
  }

  function loadDraftFromPick() {
    const id = pathPick.value;
    if (!id) {
      pathTitle.value = "";
      pathGoal.value = "";
      draftPathSteps = [];
    } else {
      const p = loadPaths()[id];
      if (p) {
        pathTitle.value = p.title;
        pathGoal.value = p.goal ?? "";
        draftPathSteps = [...p.steps];
      }
    }
    renderDraftPathSteps();
  }

  function renderPublishedPaths() {
    pathPublished.replaceChildren();
    for (const p of publishedPaths(log.all())) {
      const row = document.createElement("div");
      row.className = "path-published-item";
      const who = p.pubkey === myPubkey ? "you" : shortKey(p.pubkey);
      row.textContent = `${p.title} — ${who} (${p.steps.length} steps)`;
      const followBtn = document.createElement("button");
      followBtn.type = "button";
      followBtn.textContent = "Follow";
      followBtn.style.marginLeft = "8px";
      followBtn.addEventListener("click", () => {
        draftPathSteps = [...p.steps];
        pathTitle.value = p.title;
        pathGoal.value = p.goal ?? "";
        renderDraftPathSteps();
        followPathId = null;
        draw();
      });
      row.append(followBtn);
      pathPublished.append(row);
    }
  }

  document.getElementById("paths-toggle").addEventListener("click", () => {
    pathsPanel.hidden = !pathsPanel.hidden;
    if (!pathsPanel.hidden) {
      pathsPanel.open = true;
      refreshPathTopics();
      refreshPathPick();
      // Land on the flagship curriculum route so the panel opens on a real
      // journey to Follow, not the blank "— new path —" authoring form.
      if (!pathPick.value && FLAGSHIP_PATH_ID && loadPaths()[FLAGSHIP_PATH_ID]) {
        pathPick.value = FLAGSHIP_PATH_ID;
      }
      renderPublishedPaths();
      loadDraftFromPick();
    }
  });

  pathPick.addEventListener("change", loadDraftFromPick);

  document.getElementById("path-add-step").addEventListener("click", () => {
    const id = pathStepTopic.value;
    if (!id || draftPathSteps.includes(id)) return;
    draftPathSteps.push(id);
    renderDraftPathSteps();
  });

  document.getElementById("path-save").addEventListener("click", () => {
    try {
      const id = pathPick.value || crypto.randomUUID();
      const path = buildPath({
        id,
        title: pathTitle.value,
        goal: pathGoal.value,
        steps: draftPathSteps,
      });
      const all = loadPaths();
      all[path.id] = path;
      savePaths(all);
      pathPick.value = path.id;
      refreshPathPick();
      pathPick.value = path.id;
    } catch (err) {
      console.error("[mp] save path:", err);
    }
  });

  document.getElementById("path-follow").addEventListener("click", () => {
    const id = pathPick.value;
    if (!id || !loadPaths()[id]) return;
    followPathId = id;
    const next = followNext();
    if (next) {
      const p = plateauById(next);
      if (p) {
        const { cx, cy } = centerOn(
          p.position,
          { width: canvas.width, height: canvas.height },
          VIEW.scale,
        );
        VIEW.cx = cx;
        VIEW.cy = cy;
      }
    }
    draw();
  });

  document.getElementById("path-unfollow").addEventListener("click", () => {
    followPathId = null;
    draw();
  });

  document.getElementById("path-publish").addEventListener("click", () => {
    const id = pathPick.value;
    if (!id) return;
    const entry = loadPaths()[id];
    if (!entry || !entry.steps.length) return;
    const plateaus = doc.to_graph().plateaus();
    const domains = pathDomains(plateaus, entry.steps);
    try {
      ingest(identity.sign_path(entry.id, entry.title, entry.goal ?? "", entry.steps, domains));
      renderPublishedPaths();
    } catch (err) {
      console.error("[mp] sign_path failed:", err);
    }
  });

  // ── Travel: focus the camera on a topic (SPEC-0019 / R-0019) ────────────────
  // Pure wayfinding. Re-origins VIEW via centerOn and flashes a transient focus
  // ring. Touches NOTHING reachable/synced/persisted — no reach, no CRDT, no
  // event log — so it works for LIT or FOGGED topics alike (travel is camera
  // focus, not reachability). The only state it mutates is the camera origin.
  const travelSel = document.getElementById("travel-topic");
  const travelPanel = document.getElementById("travel");
  function refreshTravelTopics() {
    // Rebuilt on open from the CURRENT graph, so topics authored/synced this
    // session are travel-able (by name, like the bridge form).
    travelSel.replaceChildren(
      ...doc
        .to_graph()
        .plateaus()
        .map((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name;
          return o;
        }),
    );
  }
  document.getElementById("travel-toggle").addEventListener("click", () => {
    travelPanel.hidden = !travelPanel.hidden;
    if (!travelPanel.hidden) {
      travelPanel.open = true;
      refreshTravelTopics();
    }
  });
  let focusTimer = null;
  document.getElementById("travel-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = doc
      .to_graph()
      .plateaus()
      .find((x) => x.id === travelSel.value);
    if (!p) return;
    // Re-centre the camera so the chosen topic sits at the canvas centre.
    const { cx, cy } = centerOn(
      p.position,
      { width: canvas.width, height: canvas.height },
      VIEW.scale,
    );
    VIEW.cx = cx;
    VIEW.cy = cy;
    focusedId = p.id; // transient highlight ring (render.js); cleared below
    draw();
    if (focusTimer) clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      focusedId = null;
      draw();
    }, 1800);
  });

  // ── First-run tutorial (SPEC-0019 / R-0019) ─────────────────────────────────
  // A stepped welcome overlay, remembered LOCALLY (localStorage only — never
  // synced, never in the CRDT). First entry shows it; "Got it" marks it seen so
  // returning visitors skip straight in; the toolbar "Tour" button replays it
  // unconditionally. Content + the seen-gate are the pure tutorial.js module.
  const tutorialEl = document.getElementById("tutorial");
  const tutTitle = document.getElementById("tutorial-title");
  const tutBody = document.getElementById("tutorial-body");
  const tutDots = document.getElementById("tutorial-dots");
  const tutBack = document.getElementById("tutorial-back");
  const tutNext = document.getElementById("tutorial-next");
  let tutStep = 0;
  function renderTutorial() {
    const step = TUTORIAL_STEPS[tutStep];
    tutTitle.textContent = step.title;
    tutBody.textContent = step.body;
    tutBack.disabled = tutStep === 0;
    tutNext.hidden = tutStep === TUTORIAL_STEPS.length - 1; // last step → only "Got it"
    tutDots.replaceChildren(
      ...TUTORIAL_STEPS.map((_, i) => {
        const dot = document.createElement("span");
        dot.className = i === tutStep ? "dot on" : "dot";
        return dot;
      }),
    );
  }
  function showTutorial(i = 0) {
    tutStep = i;
    renderTutorial();
    tutorialEl.hidden = false;
  }
  function dismissTutorial() {
    tutorialEl.hidden = true;
    markTutorialSeen(localStorage); // remember — returning visitors skip it (AC4)
  }
  tutBack.addEventListener("click", () => {
    if (tutStep > 0) {
      tutStep -= 1;
      renderTutorial();
    }
  });
  tutNext.addEventListener("click", () => {
    if (tutStep < TUTORIAL_STEPS.length - 1) {
      tutStep += 1;
      renderTutorial();
    }
  });
  document.getElementById("tutorial-gotit").addEventListener("click", dismissTutorial);
  document.getElementById("tour").addEventListener("click", () => showTutorial(0)); // replay (AC4)

  // Map legend: a static key of what each line/dot means. Pure toggle, no state.
  const legendPanel = document.getElementById("legend");
  document.getElementById("legend-toggle").addEventListener("click", () => {
    legendPanel.hidden = !legendPanel.hidden;
  });
  document.getElementById("legend-close").addEventListener("click", () => {
    legendPanel.hidden = true;
  });

  // Advertise our initial state so a tab opened later converges with us, and draw
  // the (fogged) world behind the creator overlay.
  sync.pump();
  draw();

  // First entry only (no "seen" flag): welcome the visitor BEFORE the lens
  // picker — the overlay covers it and dismiss reveals it. Returning visitors
  // skip straight in (AC4).
  if (shouldShowTutorial(localStorage)) showTutorial(0);
}

main().catch((err) => {
  console.error("[mp] fatal:", err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err}`;
});

// Installable offline PWA (SPEC-0047 / R-0047): register the module service
// worker AFTER boot kicked off — never blocking, silent where unsupported
// (the app then simply works online, exactly as before). "./sw.js" resolves
// against the DOCUMENT, so it is subpath-safe under /AMillionPlateaus/.
// NOT registered on localhost (shouldRegister) unless ?sw=1 — serve.py's
// no-cache dev contract must keep beating the SW cache during development.
//
// The warm pass: the SW was born after boot, so every module/wasm request
// this load made predates it. We post the boot's same-origin resource URLs
// (perf buffer, cross-origin dropped by warmList — the model call never
// re-fires) plus the lazily-imported KaTeX vendor set; the SW caches them,
// making ONE online load fully offline-ready (R-0047 AC2).
if ("serviceWorker" in navigator && shouldRegister(window.location)) {
  navigator.serviceWorker
    .register("./sw.js", { type: "module" })
    .then(async (reg) => {
      await navigator.serviceWorker.ready;
      const boot = warmList(performance.getEntriesByType("resource"), window.location.origin);
      (reg.active ?? reg.waiting ?? reg.installing)?.postMessage({
        type: "warm",
        urls: [...boot, ...VENDOR_WARM],
      });
      console.log(`[mp] service worker ready — warming ${boot.length + VENDOR_WARM.length} files for offline`);
    })
    .catch((err) => console.warn("[mp] service worker unavailable:", err?.message ?? err));
}
