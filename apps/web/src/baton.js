// baton.js — hand the topic you're studying to your OTHER device (R-0105). Pure.
//
// The R-0058 Scan Note flow is camera-first: the laptop shows a QR, your PHONE
// scans it and sends a photo back. That is useless on a Boox e-ink tablet — it has
// no camera — and it points the wrong way anyway: the Boox is the device you most
// want to WRITE on (stylus, no glare), while the laptop is where you read.
//
// So: no camera, and no typing either. The laptop passes a BATON — a tiny pointer
// saying "I'm on this topic" — through the profile you already sync (R-0101). The
// Boox picks it up and opens that topic's notepad directly. Notes themselves keep
// flowing over the existing markdown channel (R-0075); this only carries the
// pointer, so it stays a few bytes.
//
// WHY AN ARRAY, NOT AN OBJECT — this is the load-bearing detail. profile.js merges
// with deepMergeUnion, where scalars are LOCAL-WINS: a plain `{topicId}` object
// would keep the receiving device's own stale value and the hand-off would silently
// never arrive. Arrays union by `id`, so one entry PER DEVICE survives the merge and
// the reader simply picks the freshest entry that isn't its own.
//
// PURE: plain data in, plain data out — no DOM, no storage, no Date.now() (the
// caller passes `now`, keeping this resumable and testable).

export const BATON_KEY = "mp.baton";
export const BATON_V = 1;
/** A baton older than this is stale — you moved on; don't nag about it. */
export const BATON_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
/** Keep the list tiny: one entry per device, a few devices. */
export const BATON_MAX = 8;

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * A friendly default name for THIS device, guessed from a user-agent string. Boox
 * tablets identify as Android but usually carry "onyx"/"boox"; everything else
 * falls back to a coarse form factor. The owner can rename it — this is only the
 * default so the banner reads "Laptop is on …" instead of a device id.
 */
export function deviceLabel(ua = "") {
  const u = String(ua).toLowerCase();
  if (/boox|onyx/.test(u)) return "Boox";
  if (/ipad|tablet|kindle|remarkable/.test(u)) return "Tablet";
  if (/iphone|android.*mobile|mobile/.test(u)) return "Phone";
  return "Laptop";
}

/**
 * Build a baton entry. `id` is device+timestamp so the array union dedupes exact
 * repeats, and `pushBaton` keeps only the newest per device. Returns null when
 * there's nothing to point at.
 */
export function makeBaton({ device, topicId, name, at } = {}) {
  const d = str(device) || "Device";
  const id = str(topicId);
  const t = Number.isFinite(at) ? at : 0;
  if (!id) return null;
  return { id: `${d}@${t}`, device: d, topicId: id, name: str(name), at: t, v: BATON_V };
}

/** Valid baton entries from a parsed localStorage value; junk is dropped. */
export function parseBatons(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.filter(
    (b) => b && typeof b === "object" && str(b.topicId) && str(b.device) && Number.isFinite(b.at),
  );
}

/**
 * Add a baton to the list: drops this device's PREVIOUS entries (one live pointer
 * per device — you're only ever on one topic), appends the new one, and caps the
 * list. Returns a new array; never mutates. Pure.
 */
export function pushBaton(list, baton, { max = BATON_MAX } = {}) {
  if (!baton) return parseBatons(list);
  const kept = parseBatons(list).filter((b) => b.device !== baton.device);
  return [...kept, baton].slice(-max);
}

/**
 * The freshest baton from a device OTHER than `myDevice`, within `ttl` of `now`.
 * This is "what my other device wants me to open". Null when there is nothing
 * fresh — so the banner stays quiet rather than nagging about yesterday.
 */
export function latestFrom(list, myDevice, now, { ttl = BATON_TTL_MS } = {}) {
  const me = str(myDevice);
  const t = Number.isFinite(now) ? now : 0;
  const candidates = parseBatons(list)
    .filter((b) => b.device !== me && t - b.at <= ttl && b.at <= t)
    .sort((a, b) => b.at - a.at);
  return candidates[0] ?? null;
}

/** One line for the banner: which device is on what. */
export function describeBaton(baton) {
  if (!baton) return "";
  const name = str(baton.name) || "a topic";
  return `${str(baton.device) || "Your other device"} is on “${name}”`;
}

/**
 * Drop this device's own baton (used when you open the handed-off topic, so the
 * pointer doesn't bounce back and re-prompt the other device). Pure.
 */
export function clearBatonFrom(list, device) {
  const d = str(device);
  return parseBatons(list).filter((b) => b.device !== d);
}
