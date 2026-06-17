// tutorial.js — first-run welcome content + a local-only seen-gate (SPEC-0019,
// R-0019 AC4). Pure data + injected storage (mirrors events.js's pattern): the
// "seen" flag is localStorage-only — never synced, never in the CRDT. Replay is
// a UI action (open regardless of the flag), so it is not gated here.

export const TUTORIAL_KEY = "mp.tutorialSeen";

export const TUTORIAL_STEPS = [
  {
    title: "Welcome to the world",
    body: "Every island is a topic; bridges connect related ideas. You fly through a map of knowledge, not a course.",
  },
  {
    title: "Your career lens",
    body: "Pick a career lens — it orients you and lights where you start. A geometer wakes facing maths; a composer, music. Change it anytime.",
  },
  {
    title: "Colour is your progress",
    body: "Every topic is open — click any to study it. Colour shows how far you've got: unexplored, studying, then mastered once you quiz yourself. Your covered trail lights between the topics you've walked.",
  },
  {
    title: "Grow & travel",
    body: "Draft your own topics and bridges, drop markers, vote them into bedrock — and Travel to focus the map on any island.",
  },
  {
    title: "Off you go",
    body: "That's it. Choose your career lens and start exploring.",
  },
];

// First run (no stored flag) ⇒ show. A throwing storage (private mode / no
// localStorage) ⇒ don't show — onboarding is a nicety, never a crash.
export function shouldShowTutorial(storage) {
  try {
    return !storage.getItem(TUTORIAL_KEY);
  } catch {
    return false;
  }
}

// Remember that the visitor has seen it. A throwing storage is swallowed: the
// tutorial simply shows again next visit — harmless.
export function markTutorialSeen(storage) {
  try {
    storage.setItem(TUTORIAL_KEY, "1");
  } catch {
    /* private mode — show each visit, harmless */
  }
}
