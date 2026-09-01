/**
 * Progression and mastery.
 *
 * The rule this module exists to enforce: a bug is retired only after
 * DELAYED, INTERLEAVED retesting. Three correct in a row looks fixed, but
 * two sessions later that bug's discriminating item quietly reappears mixed
 * into new material. Pass it and the repair is permanent. Fail it and the
 * robot cracks back open.
 *
 * Rewarding consecutive correct answers measures short-term recall.
 * This measures retention, which is what mastery actually means.
 */

export type RepairState =
  /** Never diagnosed. The child has not met this robot. */
  | "unseen"
  /** The engine named the bug. The child is working on it. */
  | "diagnosed"
  /** A streak was achieved. It LOOKS fixed. It is not trusted yet. */
  | "probation"
  /** Survived the delayed, interleaved retest. Permanently retired. */
  | "repaired";

export type RepairRecord = {
  bugId: string;
  state: RepairState;
  /** Consecutive correct answers this session. Streaks do not cross sessions. */
  streak: number;
  diagnosedInSession: number | null;
  /** Session in which the streak was achieved. The retest clock starts here. */
  probationSince: number | null;
  retestsPassed: number;
  /** Every time this robot cracked back open. Shown in the repair log. */
  retestsFailed: number;
  repairedInSession: number | null;
};

export type LearnerState = {
  version: number;
  /** 0 before the first session begins. */
  sessionIndex: number;
  records: Record<string, RepairRecord>;
  updatedAt: string;
};

/** Consecutive correct answers that move a bug to probation — NOT to repaired. */
export const STREAK_TO_PROBATION = 3;

/** Sessions that must pass before the retest is allowed to appear. */
export const RETEST_DELAY_SESSIONS = 2;

export const STATE_VERSION = 1;

export type RetestOutcome = "repaired" | "cracked";
