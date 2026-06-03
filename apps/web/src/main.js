// main.js — wire wasm + render + input + sync + identity + the persona creator
// (SPEC-0005/0006/0007/0009, extended by SPEC-0010 for Nostr identity).
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
} from "../pkg/mp_wasm.js";
import { render, RADIUS } from "./render.js";
import { createSync } from "./sync.js";
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
} from "./persona.js";
import { PRESETS, PROVIDERS, isConfigured } from "./model.js";
import { buildGroundingContext } from "./companion-context.js";
import { voiceFor } from "./companion-voice.js";
import { assembleMessages, sendTurn } from "./companion.js";

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

// Two domains in different GA regions so domain choice means something
// (R-0006 AC3): Mathematics lives on the e1 axis, Music on the e3 axis. e2 is a
// small shared "depth" jitter for visual spread and never discriminates at these
// magnitudes. This seed supersedes the SPEC-0005 single-domain seed.
//
// Fixed (deterministic) ids so two independently-loaded tabs converge to ONE
// shared map rather than doubling it (see WasmCrdtDoc::seed_plateau).
const SEED_PLATEAUS = [
  // Mathematics (e1 axis)
  { id: "00000000-0000-0000-0000-0000000000a1", name: "Arithmetic", domain: MATH_DOMAIN, e1: 1.0, e2: 0.05, e3: 0.05 },
  { id: "00000000-0000-0000-0000-0000000000a2", name: "Algebra", domain: MATH_DOMAIN, e1: 0.8, e2: 0.2, e3: 0.1 },
  { id: "00000000-0000-0000-0000-0000000000a3", name: "Geometry", domain: MATH_DOMAIN, e1: 0.7, e2: 0.1, e3: 0.35 },
  { id: "00000000-0000-0000-0000-0000000000a4", name: "Calculus", domain: MATH_DOMAIN, e1: 0.6, e2: 0.3, e3: 0.3 },
  // Music (e3 axis)
  { id: "00000000-0000-0000-0000-0000000000c1", name: "Rhythm", domain: MUSIC_DOMAIN, e1: 0.05, e2: 0.05, e3: 1.0 },
  { id: "00000000-0000-0000-0000-0000000000c2", name: "Melody", domain: MUSIC_DOMAIN, e1: 0.1, e2: 0.2, e3: 0.8 },
  { id: "00000000-0000-0000-0000-0000000000c3", name: "Harmony", domain: MUSIC_DOMAIN, e1: 0.35, e2: 0.1, e3: 0.7 },
  { id: "00000000-0000-0000-0000-0000000000c4", name: "Counterpoint", domain: MUSIC_DOMAIN, e1: 0.3, e2: 0.3, e3: 0.6 },
];

// Bridges are decorative — reachability is positional, not adjacency-based, so a
// bridge only draws a labelled line. One cross-domain bridge hints the domains
// connect.
const P = Object.fromEntries(SEED_PLATEAUS.map((p) => [p.name, p.id]));
const SEED_BRIDGES = [
  { id: "00000000-0000-0000-0000-0000000000b1", from: P.Arithmetic, to: P.Algebra, concept: "variables" },
  { id: "00000000-0000-0000-0000-0000000000b2", from: P.Algebra, to: P.Geometry, concept: "coordinates" },
  { id: "00000000-0000-0000-0000-0000000000b3", from: P.Algebra, to: P.Calculus, concept: "rates of change" },
  { id: "00000000-0000-0000-0000-0000000000b4", from: P.Geometry, to: P.Calculus, concept: "limits" },
  { id: "00000000-0000-0000-0000-0000000000b5", from: P.Rhythm, to: P.Melody, concept: "pitch" },
  { id: "00000000-0000-0000-0000-0000000000b6", from: P.Melody, to: P.Harmony, concept: "chords" },
  { id: "00000000-0000-0000-0000-0000000000b7", from: P.Harmony, to: P.Counterpoint, concept: "voice-leading" },
  { id: "00000000-0000-0000-0000-0000000000b8", from: P.Rhythm, to: P.Counterpoint, concept: "meter" },
  // cross-domain — purely visual
  { id: "00000000-0000-0000-0000-0000000000b9", from: P.Geometry, to: P.Harmony, concept: "ratio" },
];

// id → domain, so traverse grows the plateau's OWN domain bucket. Foreign synced
// plateaus (added in another tab) fall back to the active persona's first domain
// — a best-effort heuristic, harmless to the positional fog math.
const DOMAIN_OF = new Map(SEED_PLATEAUS.map((p) => [p.id, p.domain]));

// Each faced domain's on-axis origin plateau is always drawn as a navigable
// trailhead (SPEC-0010 §2.3): with an empty log reputation reaches nothing, but a
// trailhead lets the visitor sign their FIRST traversal. This is a render/interaction
// affordance gated on persona ORIENTATION, never on reputation — so "empty log ⇒
// empty domain_reps ⇒ reaches nothing" stays true at the reputation layer.
const TRAILHEAD_OF = { [MATH_DOMAIN]: P.Arithmetic, [MUSIC_DOMAIN]: P.Rhythm };

// Math on the upper-right (high e1), Music on the lower-left (high e3).
const VIEW = { cx: 230, cy: 150, scale: 320 };

async function main() {
  await init();

  const doc = WasmCrdtDoc.new(); // fallible ctor — throws on Err
  const session = new WasmSyncSession();

  for (const p of SEED_PLATEAUS) doc.seed_plateau(p.id, p.name, p.domain, p.e1, p.e2, p.e3);
  for (const b of SEED_BRIDGES) doc.seed_bridge(b.id, b.from, b.to, b.concept);

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
    // EARNED reach comes purely from the recomputed reputation (empty log ⇒ none).
    const earned = new Set(graph.reachable_plateaus(JSON.stringify(reputation)));
    // Trailheads are lit on top as a navigable start (orientation-gated, not reach).
    const lit = new Set(earned);
    for (const id of trailheadIds()) lit.add(id);
    points = render(ctx, { plateaus, bridges, reachable: lit, view: VIEW });
    const who = activePersona ? `${activePersona.name} · ` : "";
    hud.textContent = `${who}${lit.size}/${plateaus.length} plateaus lit · ${bridges.length} bridges`;
  }

  // After any LOCAL graph edit, ship the change to the other tab.
  const sync = createSync(doc, session, draw);

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
    nameIn.placeholder = "Your persona";
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
    title.textContent = "Choose your persona";
    const sub = document.createElement("p");
    sub.className = "creator-sub";
    sub.textContent =
      "Your persona is a lens: it orients you in the knowledge geometry and lights a different starting map.";
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
    create.textContent = "Create your own";
    create.addEventListener("click", () => {
      creator.innerHTML = "";
      const t = document.createElement("h2");
      t.textContent = "Author your persona";
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
      // Sign a traversal toward the plateau (R-0010 AC2/AC3). Grow the plateau's OWN
      // domain bucket (fallback: the persona's first faced domain — an authored
      // persona may face nothing, R-0009 AC6). The signed event — never any graph
      // edit — feeds reputation, so reach stays off the CRDT (AC6).
      const domain = DOMAIN_OF.get(hit.id) ?? activePersona.orient[0]?.domain;
      if (domain) signTraversal(domain, hit);
    }
  });

  // A synced graph edit: add a user-authored plateau (fresh random id) under the
  // active persona's domain and a bridge from it, then pump to the other tab.
  let added = 0;
  document.getElementById("add").addEventListener("click", () => {
    if (!activePersona) return;
    // An authored persona may face nothing (orient: []); without a domain to file
    // the new plateau under there is nothing to add, so no-op rather than throw
    // (R-0009 AC6 — keep the world console-clean for an empty persona).
    const domain = activePersona.orient[0]?.domain;
    if (!domain) return;
    added += 1;
    const e1 = Math.random() * 1.2 - 0.1;
    const e2 = Math.random() * 0.5;
    const e3 = Math.random() * 1.2;
    const id = doc.add_plateau(`Idea ${added}`, domain, e1, e2, e3);
    DOMAIN_OF.set(id, domain);
    doc.add_bridge(SEED_PLATEAUS[0].id, id, `link ${added}`);
    sync.pump(); // broadcast the CRDT change
    draw();
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

  // Advertise our initial state so a tab opened later converges with us, and draw
  // the (fogged) world behind the creator overlay.
  sync.pump();
  draw();
}

main().catch((err) => {
  console.error("[mp] fatal:", err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err}`;
});
