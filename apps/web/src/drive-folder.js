// drive-folder.js — one tap from a topic to its notes folder in Drive (R-0109). Pure.
//
// The notes that matter often aren't in this app: they're Google Docs from a study
// chat, a PDF of worked problems, a photo of a whiteboard. The private shelf
// (R-0052) can already pin such a link per topic — but pinning one URL per topic by
// hand does not scale to a 49-course degree, and the real pain is the Boox: finding
// the right folder by scrolling Drive on a slow monochrome screen is miserable.
//
// So instead of asking for 49 URLs, derive ONE per topic from a naming convention
// and open Drive already filtered to it. No OAuth, no API key, no token, no new
// dependency — just a deterministic deep link, which also means it works the same
// on every device and degrades to "Drive's own search page" at worst.
//
// A pinned folder always WINS over the derived link: once you paste the real folder
// URL onto a topic's shelf, that exact folder is what opens. The convention is the
// zero-setup default, not a constraint.
//
// PURE: strings in, strings out — no DOM, no network, no storage.

/** The convention's prefix. Folders read `plateaus-<topic>` so they sort together
 *  in Drive and are obvious months later. */
export const FOLDER_PREFIX = "plateaus";

/**
 * Fold a topic name into the folder-name form: accents stripped, lowercased,
 * punctuation and spaces collapsed to single hyphens. "Introducción al cálculo"
 * → "introduccion-al-calculo". Deterministic, so every device derives the same
 * name and the link is stable.
 */
export function slugifyTopic(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60); // Drive is fine with more; a shorter name stays readable
}

/** The canonical Drive folder name for a topic, e.g. `plateaus-optica`. */
export function driveFolderName(topicName, prefix = FOLDER_PREFIX) {
  const slug = slugifyTopic(topicName);
  const p = slugifyTopic(prefix);
  if (!slug) return p || FOLDER_PREFIX;
  return p ? `${p}-${slug}` : slug;
}

/**
 * A Drive deep link that lands on a search for `query` — the zero-auth way to get
 * "show me this topic's folder" without ever holding a Drive credential. One tap
 * on the Boox instead of scrolling a file tree in greyscale.
 */
export function driveSearchUrl(query) {
  const q = String(query ?? "").trim();
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(q)}`;
}

/** Is this URI a Drive FOLDER link (as opposed to a file, or something else)? */
export function isDriveFolderUrl(uri) {
  return /^https:\/\/(drive|docs)\.google\.com\/drive\/(u\/\d+\/)?folders\//i.test(
    String(uri ?? "").trim(),
  );
}

/** Any Google Drive / Docs link — used to label a shelf row as living in Drive. */
export function isDriveUrl(uri) {
  return /^https:\/\/(drive|docs)\.google\.com\//i.test(String(uri ?? "").trim());
}

/**
 * Where a topic's notes folder actually is. A folder URL pinned on the topic's
 * private shelf wins (exact, and it survives you renaming things); otherwise fall
 * back to the derived convention as a Drive search.
 * `shelfRows` = [{ id, title, kind, uri }]. Returns
 * `{ kind: 'pinned'|'derived', url, name, title? }`.
 */
export function topicFolder(topicName, shelfRows = [], prefix = FOLDER_PREFIX) {
  const rows = Array.isArray(shelfRows) ? shelfRows : [];
  const pinned = rows.find((r) => r && isDriveFolderUrl(r.uri));
  const name = driveFolderName(topicName, prefix);
  if (pinned) {
    return { kind: "pinned", url: String(pinned.uri).trim(), name, title: pinned.title || name };
  }
  return { kind: "derived", url: driveSearchUrl(name), name };
}

/** Plain-language label for the button, so the Boox tap is unambiguous. */
export function describeFolder(folder) {
  if (!folder) return "";
  return folder.kind === "pinned"
    ? `Open ${folder.title || "this topic's folder"} in Drive`
    : `Search Drive for ${folder.name}`;
}
