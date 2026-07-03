import test from "node:test";
import assert from "node:assert/strict";
import { formatSyncStatus } from "./sync-status.js";

test("formatSyncStatus reports idle when never synced", () => {
  assert.equal(formatSyncStatus(0, 1000), "sync ○ idle");
  assert.equal(formatSyncStatus(undefined, 1000), "sync ○ idle");
});

test("formatSyncStatus buckets the elapsed time", () => {
  const now = 1_000_000;
  assert.equal(formatSyncStatus(now, now), "synced ✓ just now"); // 0s
  assert.equal(formatSyncStatus(now - 5_000, now), "synced ✓ 5s ago");
  assert.equal(formatSyncStatus(now - 90_000, now), "synced ✓ 1m ago");
  assert.equal(formatSyncStatus(now - 7_200_000, now), "synced ✓ 2h ago");
});

test("formatSyncStatus never shows negative time (clock skew)", () => {
  assert.equal(formatSyncStatus(2000, 1000), "synced ✓ just now");
});
