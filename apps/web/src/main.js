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
} from "../pkg/mp_wasm.js";
import { render, RADIUS } from "./render.js";
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
  DOMAINS,
  AXES,
  MATH_DOMAIN,
  MUSIC_DOMAIN,
  PHYSICS_DOMAIN,
} from "./persona.js";
import { SEED_PLATEAUS, SEED_BRIDGES, P } from "./seeds.js";
import { PRESETS, PROVIDERS, isConfigured } from "./model.js";
import { buildGroundingContext } from "./companion-context.js";
import { voiceFor } from "./companion-voice.js";
import { assembleMessages, sendTurn } from "./companion.js";
import { buildPlateau } from "./plateau.js";
import { renderMarkdown, safeHref } from "./markdown.js";
import { typesetMath } from "./katex.js";
import { rankResources, buildPlateauStudyContext, STUDY_ACTIONS } from "./study.js";
import { buildBridge } from "./bridge.js";
import { buildResource, RESOURCE_KINDS } from "./resource.js";
import { buildVote } from "./vote.js";
import { createPresence, HEARTBEAT_MS } from "./presence.js";
import { centerOn } from "./wayfinding.js";
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
  for (const p of SEED_PLATEAUS) doc.seed_plateau(p.id, p.name, p.domain, p.e1, p.e2, p.e3);
  for (const b of SEED_BRIDGES) doc.seed_bridge(b.id, b.from, b.to, b.concept);

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
  const ctx = canvas.getContext("2d");
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
    // EARNED reach comes purely from the recomputed reputation (empty log ⇒ none).
    const earned = new Set(graph.reachable_plateaus(JSON.stringify(reputation)));
    // Trailheads are lit on top as a navigable start (orientation-gated, not reach).
    const lit = new Set(earned);
    for (const id of trailheadIds()) lit.add(id);
    points = render(ctx, {
      plateaus,
      bridges,
      reachable: lit,
      view: VIEW,
      resources,
      peers: presence.peers(), // ephemeral remote-wizard silhouettes (R-0016)
      focusedId, // transient travel highlight (R-0019); null most of the time
    });
    const who = activePersona ? `${activePersona.name} · ` : "";
    hud.textContent = `${who}${lit.size}/${plateaus.length} plateaus lit · ${bridges.length} bridges · ${resources.length} markers`;
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

  // ── Discovery + vouch (SPEC-0010 §2.3, R-0010 AC5/AC7) ──────────────────
  function shortKey(pk) {
    return pk && pk.length > 12 ? `${pk.slice(0, 6)}…${pk.slice(-4)}` : pk || "?";
  }
  function labelForDomain(id) {
    return DOMAINS.find((d) => d.id === id)?.label ?? "Uncharted";
  }
  function canonicalAxis(domain) {
    const c = DOMAINS.find((d) => d.id === domain)?.canonical ?? { e1: 0, e2: 0, e3: 0 };
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
    div.className = role === "user" ? "msg msg-user" : role === "error" ? "msg msg-err" : "msg msg-bot";
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
    const domainControls = DOMAINS.map((d) => {
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
      "Sliders set direction only — which way the lens faces, never how strong it is. Face nothing and the world stays fogged until you explore.";

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
      const orient = domainControls
        .filter((c) => c.toggle.checked)
        .map((c) => ({
          domain: c.domain,
          dir: {
            e1: Number(c.sliders.e1.value),
            e2: Number(c.sliders.e2.value),
            e3: Number(c.sliders.e3.value),
          },
        }));
      const seed = { name: nameIn.value, orient, tone: toneIn.value };
      authoredSeed = seed;
      saveAuthored(seed); // local only — never synced (AC5)
      choosePersona(authorPersona(seed));
    });
    actions.append(back, enter);

    form.append(nameField, ...domainControls.map((c) => c.block), toneField, hint, actions);
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
    if (authoredSeed) cards.append(personaCard(authorPersona(authoredSeed)));
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

  canvas.addEventListener("click", (e) => {
    if (!activePersona) return; // not interactive until a persona is chosen (AC1)
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const graph = doc.to_graph();
    // Clickable = EARNED reach plus the always-navigable trailheads, so the very
    // first traversal (with an empty log) is reachable from a trailhead.
    const clickable = new Set(graph.reachable_plateaus(JSON.stringify(reputation)));
    for (const id of trailheadIds()) clickable.add(id);

    // Hit-test the nearest LIT plateau within its disc.
    let hit = null;
    let best = RADIUS * RADIUS;
    for (const p of graph.plateaus()) {
      if (!clickable.has(p.id)) continue;
      const pt = points.get(p.id);
      const d = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
      if (d <= best) {
        best = d;
        hit = p;
      }
    }
    if (hit) {
      // Focusing a plateau is the wizard's position — announce it to peers
      // (ephemeral presence, R-0016 AC4). This is NOT a graph edit or an event.
      myPlateau = hit.id;
      announcePresence();
      // Sign a traversal toward the plateau (R-0010 AC2/AC3). Grow the plateau's OWN
      // domain bucket (fallback: the persona's first faced domain — an authored
      // persona may face nothing, R-0009 AC6). The signed event — never any graph
      // edit — feeds reputation, so reach stays off the CRDT (AC6).
      const domain = DOMAIN_OF.get(hit.id) ?? activePersona.orient[0]?.domain;
      if (domain) signTraversal(domain, hit);
      // Visiting a topic is reading it: open the read view (R-0020). Purely
      // presentational — it does not edit the graph or change reachability.
      openPlateau(hit);
    }
  });

  // ── Plateau read view (SPEC-0020 / R-0020) ──────────────────────────────────
  // Render a plateau's Markdown body (typeset math via lazy vendored KaTeX) plus
  // the resources anchored to it. Pure view over the DTO — no mutation. The body
  // is rendered through markdown.js's injection-safe renderer before innerHTML.
  const detail = document.getElementById("plateau-detail");
  const detailName = document.getElementById("detail-name");
  const detailBody = document.getElementById("detail-body");
  const detailResources = document.getElementById("detail-resources");
  const STONE_WEIGHT = 10; // the existing place-stone default (R-0015); grow-only
  let studyPlateau = null; // the plateau currently open in the Study view

  function openPlateau(p) {
    studyPlateau = p;
    detailName.textContent = p.name; // textContent — never trust the name as HTML
    detailBody.innerHTML = renderMarkdown(p.description || "_No description yet._");
    typesetMath(detailBody); // lazy, fire-and-forget; falls back to raw TeX
    renderStudyResources();
    detail.hidden = false;
  }

  // Resources anchored to the open plateau, ranked best-first (R-0023): each row
  // shows the weighted-vote count (rounded for display only — it is the R-0015
  // weighted SUM, not an integer tally), a bedrock badge when Crystallized, and a
  // ＋ stone button on the audited grow-only vote path. Reuses the safeHref
  // chokepoint for the link, exactly as the old flat list did.
  function renderStudyResources() {
    if (!studyPlateau) return;
    const rs = doc
      .to_graph()
      .resources()
      .filter((r) => r.plateau_id === studyPlateau.id);
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
      stones.textContent = crystallized ? `◆ ${Math.round(r.vote_count)}` : `● ${Math.round(r.vote_count)}`;
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
    sync.pump();
    pumpPeer();
    persist();
    draw();
    renderStudyResources();
    addTitle.value = "";
    addUri.value = "";
  });

  // Study with the companion (R-0023 AC4): each action sends a prompt grounded in
  // a PLATEAU-SCOPED context (this topic's body + its resources) through the same
  // bring-your-own model turn the global companion uses. The plateau body —
  // possibly imported/synced peer content — rides to the configured endpoint under
  // the SAME trust boundary as R-0007 (the visitor's own endpoint, key in-browser).
  function studyAction(prompt) {
    if (!studyPlateau || !activePersona) return;
    const rs = doc
      .to_graph()
      .resources()
      .filter((r) => r.plateau_id === studyPlateau.id);
    const grounding = buildPlateauStudyContext({ plateau: studyPlateau, resources: rs });
    companion.hidden = false;
    appendMessage("user", prompt);
    const messages = assembleMessages(voiceFor(activePersona), grounding, history, prompt);
    sendTurn(modelConfig, messages)
      .then((reply) => {
        appendMessage("bot", reply);
        // Shares the global transcript by design — one companion, one history
        // (R-0023): a plateau answer can context a later global turn, and vice-versa.
        history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
      })
      .catch((err) => appendMessage("error", `⚠ ${err.message}`)); // graceful (R-0007 AC4)
  }
  const studyButtons = document.getElementById("detail-study");
  for (const a of STUDY_ACTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = a.label;
    btn.addEventListener("click", () => studyAction(a.prompt));
    studyButtons.append(btn);
  }

  document.getElementById("detail-close").addEventListener("click", () => {
    detail.hidden = true;
  });

  // ── Draft Plateau form (SPEC-0011 / R-0011) ─────────────────────────────────
  // The toggle button shows/hides the <details> panel; the form submit wires
  // buildPlateau → WasmCrdtDoc.add_plateau → CRDT sync → draw.

  // Populate the domain <select> from DOMAINS (human labels, no raw UUIDs shown).
  const dpDomain = document.getElementById("dp-domain");
  for (const d of DOMAINS) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.label;
    dpDomain.appendChild(opt);
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
      name:   document.getElementById("dp-name").value,
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
      ...doc.to_graph().plateaus().map((p) => {
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
      ...doc.to_graph().resources().map((r) => {
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
    renderDiscovery();
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
    const { cx, cy } = centerOn(p.position, { width: canvas.width, height: canvas.height }, VIEW.scale);
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
