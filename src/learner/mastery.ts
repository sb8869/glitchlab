/**
 * The mastery state machine. Pure: every function takes state in and returns
 * a new state, so the UI, the tests and any future replay tooling share one
 * implementation with no branching.
 */

import { BUGS } from "../bugs/library.ts";
import { BAND_ORDER, type Band } from "../bugs/types.ts";
import {
  RETEST_DELAY_SESSIONS,
  STATE_VERSION,
  STREAK_TO_PROBATION,
  type LearnerState,
  type RepairRecord,
  type RetestOutcome,
} from "./types.ts";

const now = () => new Date().toISOString();

function blank(bugId: string): RepairRecord {
  return {
    bugId,
    state: "unseen",
    streak: 0,
    diagnosedInSession: null,
    probationSince: null,
    retestsPassed: 0,
    retestsFailed: 0,
    repairedInSession: null,
  };
}

export function createLearner(
  bugIds: readonly string[] = BUGS.map((b) => b.id),
): LearnerState {
  const records: Record<string, RepairRecord> = {};
  for (const id of bugIds) records[id] = blank(id);
  return { version: STATE_VERSION, sessionIndex: 0, records, updatedAt: now() };
}

function withRecord(
  state: LearnerState,
  bugId: string,
  fn: (r: RepairRecord) => RepairRecord,
): LearnerState {
  const current = state.records[bugId] ?? blank(bugId);
  return {
    ...state,
    records: { ...state.records, [bugId]: fn(current) },
    updatedAt: now(),
  };
}

export function getRecord(state: LearnerState, bugId: string): RepairRecord {
  return state.records[bugId] ?? blank(bugId);
}

/**
 * Advance the session clock. Streaks are deliberately reset: "three in a row"
 * only means anything within a sitting, and letting it accumulate across days
 * would quietly turn this back into a streak counter.
 */
export function beginSession(state: LearnerState): LearnerState {
  const records: Record<string, RepairRecord> = {};
  for (const [id, r] of Object.entries(state.records)) records[id] = { ...r, streak: 0 };
  return { ...state, sessionIndex: state.sessionIndex + 1, records, updatedAt: now() };
}

export function recordDiagnosis(state: LearnerState, bugId: string): LearnerState {
  return withRecord(state, bugId, (r) =>
    r.state === "repaired" || r.state === "probation"
      ? r
      : { ...r, state: "diagnosed", diagnosedInSession: r.diagnosedInSession ?? state.sessionIndex },
  );
}

/**
 * An ordinary practice answer on a bug's discriminating item.
 *
 * Reaching the streak moves the bug to PROBATION, never to repaired. That one
 * line is the whole difference between this and every streak-based system.
 */
export function recordPractice(
  state: LearnerState,
  bugId: string,
  correct: boolean,
): LearnerState {
  return withRecord(state, bugId, (r) => {
    // Probation and repaired bugs are settled; only the delayed retest moves
    // them. Practice exposure must not fast-track the clock.
    if (r.state === "probation" || r.state === "repaired") return r;
    const streak = correct ? r.streak + 1 : 0;
    if (streak >= STREAK_TO_PROBATION) {
      return { ...r, state: "probation", streak, probationSince: state.sessionIndex };
    }
    return { ...r, state: r.state === "unseen" ? "diagnosed" : r.state, streak };
  });
}

/** True once enough sessions have passed for the retest to be allowed. */
export function retestDue(state: LearnerState, bugId: string): boolean {
  const r = getRecord(state, bugId);
  if (r.state !== "probation" || r.probationSince === null) return false;
  return state.sessionIndex - r.probationSince >= RETEST_DELAY_SESSIONS;
}

export function dueRetests(state: LearnerState): string[] {
  return Object.keys(state.records).filter((id) => retestDue(state, id));
}

/**
 * The moment that decides mastery. Pass and the repair is permanent; fail and
 * the robot cracks back open and re-enters the repair loop with its streak
 * wiped.
 */
export function recordRetest(
  state: LearnerState,
  bugId: string,
  correct: boolean,
): { state: LearnerState; outcome: RetestOutcome } {
  const outcome: RetestOutcome = correct ? "repaired" : "cracked";
  const next = withRecord(state, bugId, (r) =>
    correct
      ? {
          ...r,
          state: "repaired",
          streak: 0,
          retestsPassed: r.retestsPassed + 1,
          repairedInSession: state.sessionIndex,
        }
      : {
          ...r,
          state: "diagnosed",
          streak: 0,
          probationSince: null,
          retestsFailed: r.retestsFailed + 1,
        },
  );
  return { state: next, outcome };
}

/* ------------------------------------------------------------ repair log */

export type RepairLogEntry = {
  bugId: string;
  band: Band;
  state: RepairRecord["state"];
  /** True if this robot has ever cracked back open. Worth showing. */
  crackedBefore: boolean;
  repairedInSession: number | null;
};

/**
 * Better than XP because the progress bar is made of competencies, and it is
 * finite, so the child can see the end.
 */
export function repairLog(state: LearnerState): RepairLogEntry[] {
  const bandOf = new Map(BUGS.map((b) => [b.id, b.band]));
  const rank: Record<RepairRecord["state"], number> = {
    repaired: 0, probation: 1, diagnosed: 2, unseen: 3,
  };
  return Object.values(state.records)
    .map((r) => ({
      bugId: r.bugId,
      band: bandOf.get(r.bugId) ?? "place_value",
      state: r.state,
      crackedBefore: r.retestsFailed > 0,
      repairedInSession: r.repairedInSession,
    }))
    .sort((a, b) => rank[a.state] - rank[b.state] || a.bugId.localeCompare(b.bugId));
}

export function progress(state: LearnerState): {
  repaired: number;
  total: number;
  fraction: number;
} {
  const all = Object.values(state.records);
  const repaired = all.filter((r) => r.state === "repaired").length;
  return {
    repaired,
    total: all.length,
    fraction: all.length === 0 ? 0 : repaired / all.length,
  };
}

/* ------------------------------------------------------------ band ladder */

export function bandOfBug(bugId: string): Band {
  return BUGS.find((b) => b.id === bugId)?.band ?? "place_value";
}

export function isBandComplete(state: LearnerState, band: Band): boolean {
  const ids = BUGS.filter((b) => b.band === band).map((b) => b.id);
  return ids.length > 0 && ids.every((id) => getRecord(state, id).state === "repaired");
}

/**
 * place value -> addition regrouping -> subtraction regrouping -> fractions.
 * The current rung is the first band not yet fully repaired.
 */
export function currentBand(state: LearnerState): Band {
  for (const band of BAND_ORDER) if (!isBandComplete(state, band)) return band;
  return BAND_ORDER[BAND_ORDER.length - 1]!;
}

export function bandProgress(state: LearnerState, band: Band): { repaired: number; total: number } {
  const ids = BUGS.filter((b) => b.band === band).map((b) => b.id);
  return {
    repaired: ids.filter((id) => getRecord(state, id).state === "repaired").length,
    total: ids.length,
  };
}
