/**
 * Progression and mastery.
 *
 * The rule this module exists to enforce: a bug is retired only after
 * DELAYED, INTERLEAVED retesting. Three correct in a row looks fixed, but
 * two or three sessions later that bug's discriminating item quietly reappears mixed
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
  /**
   * Session in which this robot was FIRST drilled to probation. Never cleared,
   * unlike probationSince — the band ladder reads it, and a robot that cracks
   * open later must not roll a rung back up.
   */
  drilledInSession: number | null;
  /**
   * The session from which this retest is allowed to appear. Stored rather
   * than derived because it carries a jitter: see retestSession().
   */
  retestAfter: number | null;
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

/**
 * Up to one extra session of slack, chosen per robot.
 *
 * Without it, three robots repaired in one sitting all come due in the same
 * later sitting, and since only one retest rides in any warm-up the rest queue
 * up behind it. Spreading them at the source keeps warm-ups looking alike.
 */
export const RETEST_JITTER_SESSIONS = 1;

/** At most one retest rides in a warm-up. See buildWarmup for why. */
export const RETESTS_PER_WARMUP = 1;

export const STATE_VERSION = 1;

export type RetestOutcome = "repaired" | "cracked";
