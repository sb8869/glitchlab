/**
 * Persistence. localStorage only — no auth, no accounts, no backend, because
 * those cost days and prove nothing for this submission.
 *
 * Every access is guarded. Storage throws in private windows and is simply
 * absent under Node, and a child losing a session to an exception would be a
 * far worse failure than losing the repair log.
 */

import { BUGS } from "../bugs/library.ts";
import { createLearner } from "./mastery.ts";
import { STATE_VERSION, type LearnerState, type RepairRecord } from "./types.ts";

export const STORAGE_KEY = "glitchlab.learner.v1";

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether this browser has been shown the how-to-play screen.
 *
 * Kept apart from LearnerState on purpose: that is the mastery record, with a
 * version and a migration story, and "has read the instructions" is neither
 * mastery nor worth versioning.
 */
export const GUIDE_KEY = "glitchlab.seen-guide.v1";

export function hasSeenGuide(storage: StorageLike | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(GUIDE_KEY) === "1";
  } catch {
    // Storage unavailable: show the guide. Better twice than never.
    return false;
  }
}

export function markGuideSeen(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(GUIDE_KEY, "1");
  } catch {
    /* nothing to do */
  }
}

/**
 * Whether this lab has already had its finale.
 *
 * The empty bench is a STATE, and the celebration is an EVENT — so it cannot
 * be driven by the state alone. Hanging it off "the bench is clear" meant that
 * every trip to the repair log and back set off the confetti and a second
 * fanfare, and a moment whose entire pitch is that it happens once was
 * happening on a loop.
 *
 * Deliberately not part of the learner: the repair log records what the child
 * did, and whether a party has already been thrown is not that.
 */
export const CHEERED_KEY = "glitchlab.cheered.v1";

export function hasCheered(storage: StorageLike | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(CHEERED_KEY) === "1";
  } catch {
    // Storage unavailable: cheer. Better twice than never, for this one.
    return false;
  }
}

export function markCheered(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(CHEERED_KEY, "1");
  } catch {
    /* nothing to do */
  }
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** In-memory fallback so the game still works with storage unavailable. */
/**
 * Bring a stored state up to date with the current bug library, so adding a
 * bug later does not strand a returning child with a state that is missing it.
 */
function reconcile(state: LearnerState): LearnerState {
  const fresh = createLearner(BUGS.map((b) => b.id));
  const records: Record<string, RepairRecord> = { ...fresh.records };
  for (const [id, r] of Object.entries(state.records)) {
    if (records[id]) records[id] = r;
  }
  return { ...state, records };
}

export function loadLearner(storage: StorageLike | null = defaultStorage()): LearnerState {
  if (!storage) return createLearner();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createLearner();
    const parsed = JSON.parse(raw) as Partial<LearnerState>;
    if (parsed.version !== STATE_VERSION || typeof parsed.records !== "object") {
      return createLearner();
    }
    return reconcile({
      version: STATE_VERSION,
      sessionIndex: typeof parsed.sessionIndex === "number" ? parsed.sessionIndex : 0,
      records: parsed.records as Record<string, RepairRecord>,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    });
  } catch {
    // Corrupt or unreadable: start clean rather than crash into a child's face.
    return createLearner();
  }
}

/** Returns whether the write actually landed, so the UI can stay honest. */
export function saveLearner(
  state: LearnerState,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLearner(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
    // A new lab starts from the beginning, instructions included — and gets to
    // earn its own finale.
    storage?.removeItem(GUIDE_KEY);
    storage?.removeItem(CHEERED_KEY);
  } catch {
    /* nothing to do */
  }
}
