// review-queue.js — spaced review scheduling (R-0078), SM-2 style.
//
// The testing + spacing effects are the two best-evidenced accelerants in the
// learning literature: retrieving a fact from memory at growing intervals beats
// re-reading it every time. This module schedules that retrieval over the
// topics you have actually engaged with (mastered, lesson-done, or noted):
// each review is graded Again/Hard/Good/Easy and the next due date stretches
// or resets SM-2-fashion. Reviews are interleaved across lenses (mixing
// domains in one session also measurably beats blocking by domain).
//
// PURE: every function operates on a plain queue map
//   { [plateauId]: { reps, ease, interval, due, introduced } }
// and returns new ones — no localStorage, no DOM, no Date.now(); `now` is
// always a parameter. The impure read/write edge lives in main.js
// (loadReviewQueue/saveReviewQueue), same split as lesson-progress.js.
// Unit-tested in review-queue.test.mjs.

export const GRADES = { AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 };

const DAY_MS = 86_400_000;
const AGAIN_DELAY_MS = 10 * 60_000; // a lapsed card comes back within the session
const MIN_EASE = 1.3; // SM-2's floor — below this intervals stop growing at all
const START_EASE = 2.5;

/** The saved entry for a topic, or null if it was never reviewed. Defensive:
 *  a malformed map or entry (junk reps/ease/due) reads as null, never throws. */
export function entryOf(queue, id) {
  const e = queue && typeof queue === "object" ? queue[id] : null;
  if (!e || typeof e !== "object") return null;
  if (![e.reps, e.ease, e.interval, e.due].every(Number.isFinite)) return null;
  return {
    reps: Math.max(0, Math.trunc(e.reps)),
    ease: Math.max(MIN_EASE, e.ease),
    interval: Math.max(0, e.interval),
    due: e.due,
    introduced: Number.isFinite(e.introduced) ? e.introduced : e.due,
  };
}

/**
 * A NEW queue with topic `id` graded `q` (a GRADES value) at `now` — the SM-2
 * update. q < 3 (Again) is a lapse: reps reset, ease drops (floored), the card
 * returns in ~10 minutes. Otherwise the interval ladder is 1 day → 3 days →
 * previous × ease, with ease nudged by how comfortable the recall was
 * (Easy grows it, Hard shrinks it, floored at 1.3).
 */
export function graded(queue, id, q, now) {
  const base = queue && typeof queue === "object" ? queue : {};
  const cur = entryOf(base, id) ?? { reps: 0, ease: START_EASE, interval: 0, introduced: now };
  const grade = Number.isFinite(q) ? q : GRADES.GOOD;
  let next;
  if (grade < 3) {
    next = {
      reps: 0,
      ease: Math.max(MIN_EASE, cur.ease - 0.2),
      interval: 0,
      due: now + AGAIN_DELAY_MS,
    };
  } else {
    const ease = Math.max(
      MIN_EASE,
      cur.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
    );
    const reps = cur.reps + 1;
    const interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(cur.interval * ease);
    next = { reps, ease, interval, due: now + interval * DAY_MS };
  }
  next.introduced = cur.introduced;
  return { ...base, [id]: next };
}

/** Enrolled topics (they have queue state) whose review is due, most overdue
 *  first. `ids` scopes the result to topics that still exist in the graph —
 *  a queue entry whose plateau was deleted simply never surfaces. */
export function dueEntries(queue, ids, now) {
  return ids
    .map((id) => ({ id, entry: entryOf(queue, id) }))
    .filter((x) => x.entry && x.entry.due <= now)
    .sort((a, b) => a.entry.due - b.entry.due);
}

/** How many NEW topics (no queue state yet) may enter today, and which. The
 *  daily cap keeps a big backlog (111 seeded topics, months of notes) from
 *  flooding day one — entries whose `introduced` falls on the same UTC day as
 *  `now` count against the cap. Order is the caller's (path/curriculum order). */
export function freshIds(queue, ids, now, cap = 5) {
  const base = queue && typeof queue === "object" ? queue : {};
  const today = Math.floor(now / DAY_MS);
  const introducedToday = Object.keys(base).filter((id) => {
    const e = entryOf(base, id);
    return e && Math.floor(e.introduced / DAY_MS) === today;
  }).length;
  const allowance = Math.max(0, cap - introducedToday);
  return ids.filter((id) => !entryOf(base, id)).slice(0, allowance);
}

/** Round-robin the items across the groups `keyOf` assigns (their lens/domain),
 *  preserving each group's internal order — interleaving beats blocking. */
export function interleave(items, keyOf) {
  const groups = new Map();
  for (const it of items) {
    const k = keyOf(it) ?? "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const lists = [...groups.values()];
  const out = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

/** The earliest FUTURE due among enrolled `ids`, or null — "come back <then>". */
export function nextDue(queue, ids, now) {
  let best = null;
  for (const id of ids) {
    const e = entryOf(queue, id);
    if (e && e.due > now && (best === null || e.due < best)) best = e.due;
  }
  return best;
}
