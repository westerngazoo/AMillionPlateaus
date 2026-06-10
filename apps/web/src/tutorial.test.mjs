// tutorial.test.mjs — node --test, no wasm, no browser. Proves the first-run
// seen-gate (SPEC-0019 §2.3, R-0019 AC4/AC5): fresh storage shows the tutorial,
// after markTutorialSeen it hides, and a throwing storage degrades to "don't
// show" rather than crashing. Storage is injected (mirrors events.test.mjs).
// Run: `node --test apps/web/src/*.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { shouldShowTutorial, markTutorialSeen, TUTORIAL_KEY, TUTORIAL_STEPS } from "./tutorial.js";

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

function throwingStorage() {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

test("first run (no flag) ⇒ show the tutorial (AC4)", () => {
  assert.equal(shouldShowTutorial(fakeStorage()), true);
});

test("after markTutorialSeen ⇒ hide, and the flag is persisted under the key (AC4)", () => {
  const storage = fakeStorage();
  markTutorialSeen(storage);
  assert.equal(shouldShowTutorial(storage), false);
  assert.equal(storage.getItem(TUTORIAL_KEY), "1");
});

test("a pre-set flag ⇒ returning visitor skips the tutorial (AC4)", () => {
  assert.equal(shouldShowTutorial(fakeStorage({ [TUTORIAL_KEY]: "1" })), false);
});

test("a throwing storage ⇒ don't show, don't crash (private mode, AC5)", () => {
  const storage = throwingStorage();
  assert.equal(shouldShowTutorial(storage), false);
  assert.doesNotThrow(() => markTutorialSeen(storage));
});

test("the tutorial has real, non-empty steps to render (AC4)", () => {
  assert.ok(TUTORIAL_STEPS.length >= 4);
  for (const s of TUTORIAL_STEPS) {
    assert.equal(typeof s.title, "string");
    assert.ok(s.title.length > 0);
    assert.equal(typeof s.body, "string");
    assert.ok(s.body.length > 0);
  }
  // The career-lens reframing is part of the onboarding copy (AC1 spirit).
  assert.ok(TUTORIAL_STEPS.some((s) => /career lens/i.test(s.title) || /career lens/i.test(s.body)));
});
