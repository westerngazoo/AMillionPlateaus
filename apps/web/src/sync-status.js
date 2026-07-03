// sync-status.js — pure formatting for the Godot export-sync readout (Track B6).
//
// The web app mirrors the world for the Godot 3D client by PUTting world.bin /
// focus.json / reputation.json to the dev server. This turns "when did the last
// successful PUT land" into a glanceable toolbar string. Pure: no DOM, no fetch,
// no clock of its own (the caller injects `now`) — so it is node-testable and
// deterministic.

/**
 * Human "synced ✓ …ago" string from the last-success epoch-ms (or 0/undefined for
 * "never synced"). `now` is injected for testability. Coarse buckets: just now →
 * seconds → minutes → hours.
 */
export function formatSyncStatus(lastSyncedAt, now = Date.now()) {
  if (!lastSyncedAt) return "sync ○ idle";
  const secs = Math.max(0, Math.floor((now - lastSyncedAt) / 1000));
  let ago;
  if (secs < 2) ago = "just now";
  else if (secs < 60) ago = `${secs}s ago`;
  else if (secs < 3600) ago = `${Math.floor(secs / 60)}m ago`;
  else ago = `${Math.floor(secs / 3600)}h ago`;
  return `synced ✓ ${ago}`;
}
