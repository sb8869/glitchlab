/**
 * The mastery state machine. Pure: every function takes state in and returns
 * a new state, so the UI, the tests and any future replay tooling share one
 * implementation with no branching.
 */

import { BUGS } from "../bugs/library.ts";
import { BAND_ORDER, type Band } from "../bugs/types.ts";
import {
  RETEST_DELAY_SESSIONS,
  RETEST_JITTER_SESSIONS,
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
    drilledInSession: null,
    retestAfter: null,
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
      return {
        ...r,
        state: "probation",
        streak,
        probationSince: state.sessionIndex,
        drilledInSession: r.drilledInSession ?? state.sessionIndex,
        retestAfter: retestSession(bugId, state.sessionIndex),
      };
    }
    return { ...r, state: r.state === "unseen" ? "diagnosed" : r.state, streak };
  });
}

/**
 * When this robot's retest is allowed to appear: two sessions, plus up to one
 * more chosen per robot. The jitter is deterministic — a pure function of the
 * bug id and the session it went on probation — so the same state always
 * schedules the same way and nothing has to be threaded through an rng.
 */
export function retestSession(bugId: string, probationSince: number): number {
  let h = 0;
  for (let i = 0; i < bugId.length; i++) h = (Math.imul(h, 31) + bugId.charCodeAt(i)) | 0;
  const slack = Math.abs(h + probationSince) % (RETEST_JITTER_SESSIONS + 1);
  return probationSince + RETEST_DELAY_SESSIONS + slack;
}

/** True once enough sessions have passed for the retest to be allowed. */
export function retestDue(state: LearnerState, bugId: string): boolean {
  const r = getRecord(state, bugId);
  if (r.state !== "probation" || r.probationSince === null) return false;
  const after = r.retestAfter ?? retestSession(bugId, r.probationSince);
  return state.sessionIndex >= after;
}

/** Every due retest, longest-waiting first. Ties broken by id, never by luck. */
export function dueRetests(state: LearnerState): string[] {
  const dueAt = (id: string) => {
    const r = getRecord(state, id);
    return r.retestAfter ?? retestSession(id, r.probationSince ?? 0);
  };
  return Object.keys(state.records)
    .filter((id) => retestDue(state, id))
    .sort((a, b) => dueAt(a) - dueAt(b) || a.localeCompare(b));
}

/**
 * The one retest a warm-up may carry, or null.
 *
 * One, not all of them: a warm-up where most of the problems are probes is
 * not camouflage, it is a test with decoration. The rest keep their place in
 * the queue and ride along on later visits — waiting longer than the minimum
 * is stronger evidence of retention, not weaker.
 */
export function nextRetest(state: LearnerState): string | null {
  return dueRetests(state)[0] ?? null;
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
          retestAfter: null,
          retestsPassed: r.retestsPassed + 1,
          repairedInSession: state.sessionIndex,
        }
      : {
          /*
           * A failed retest sends the robot back to the repair loop, not back
           * to the retest queue. Probing the same gap again without teaching
           * anything in between would just measure the same miss twice.
           */
          ...r,
          state: "diagnosed",
          streak: 0,
          probationSince: null,
          retestAfter: null,
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

/**
 * Has this robot been found AND drilled, at any point?
 *
 * Monotonic on purpose: a robot that cracks open on a failed retest drops
 * back to `diagnosed`, and if the ladder read the live state a crack in place
 * value would re-lock addition underneath a child already working there.
 * `retestsFailed` only ever grows, so once true this stays true.
 */
export function hasBeenDrilled(state: LearnerState, bugId: string): boolean {
  const r = getRecord(state, bugId);
  return r.state === "probation" || r.state === "repaired" || r.retestsFailed > 0;
}

/**
 * The session by which every robot on this rung had been drilled, or null if
 * some still have not been. Reading `drilledInSession` rather than
 * `probationSince` keeps this monotonic across a crack.
 */
export function bandDrilledInSession(state: LearnerState, band: Band): number | null {
  const ids = BUGS.filter((b) => b.band === band).map((b) => b.id);
  let latest = 0;
  for (const id of ids) {
    if (!hasBeenDrilled(state, id)) return null;
    const r = getRecord(state, id);
    // A save written before this field existed: treat as long ago, so a
    // returning child is never locked out of a rung they had already opened.
    latest = Math.max(latest, r.drilledInSession ?? 0);
  }
  return ids.length > 0 ? latest : null;
}

/**
 * A rung opens the session AFTER every robot on the rung below has been found
 * and drilled.
 *
 * Drilled, not repaired: gating on repair would hold each rung hostage to a
 * two-to-three session retest delay for every robot beneath it, so addition
 * would not appear for five or more visits. Reaching probation is the child's
 * own work and takes one sitting.
 *
 * But not the SAME sitting. A child who blitzes place value in twenty minutes
 * would otherwise roll straight into addition, and then subtraction, and
 * finish the whole ladder in one go — which is cramming, and cramming is the
 * thing this app spends its entire mastery rule refusing to reward. One rung
 * per visit. Sleep on it.
 *
 * The gate is monotonic: `hasBeenDrilled` counts a robot that has since
 * cracked open, and `drilledInSession` is never cleared, so a failed retest
 * in place value can never re-lock addition underneath a child working there.
 */
export function isBandOpen(state: LearnerState, band: Band): boolean {
  for (const earlier of BAND_ORDER) {
    if (earlier === band) return true;
    const drilled = bandDrilledInSession(state, earlier);
    if (drilled === null || state.sessionIndex <= drilled) return false;
  }
  return true;
}

/** True when this rung is one good night's sleep away. Only the copy cares. */
/**
 * The bands that opened THIS session — open now, and locked one session ago.
 *
 * Derived rather than stored. `isBandOpen` is a pure function of the session
 * index and what has been drilled, so asking it the same question about
 * yesterday answers "did this rung open while the child was away?" without a
 * flag to keep in sync or migrate.
 *
 * Finishing a rung is the only milestone between the first robot and the last,
 * and it used to arrive as the sentence "these open next time you come in".
 */
export function bandsOpenedThisSession(state: LearnerState): Band[] {
  if (state.sessionIndex <= 1) return [];
  const yesterday: LearnerState = { ...state, sessionIndex: state.sessionIndex - 1 };
  return BAND_ORDER.filter((b) => isBandOpen(state, b) && !isBandOpen(yesterday, b));
}

export function bandOpensNextSession(state: LearnerState, band: Band): boolean {
  if (isBandOpen(state, band)) return false;
  for (const earlier of BAND_ORDER) {
    if (earlier === band) return true;
    if (bandDrilledInSession(state, earlier) === null) return false;
  }
  return true;
}

/** The rung a locked band is waiting on, for the copy that explains it. */
export function bandBelow(band: Band): Band | null {
  const i = BAND_ORDER.indexOf(band);
  return i > 0 ? (BAND_ORDER[i - 1] ?? null) : null;
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

/**
 * The bands the child has actually worked in — where warm-up material comes
 * from.
 *
 * Warm-ups used to draw from `currentBand`, the first rung not yet finished,
 * which meant they were nearly all addition and place value. A subtraction
 * retest riding in one was then the only subtraction on the page, and being
 * the odd one out is a label. Material from every band they have touched
 * gives the probe somewhere to hide.
 */
export function workedBands(state: LearnerState): Band[] {
  const seen = new Set<Band>();
  for (const b of BUGS) if (getRecord(state, b.id).state !== "unseen") seen.add(b.band);
  return BAND_ORDER.filter((b) => seen.has(b));
}

export function bandProgress(state: LearnerState, band: Band): { repaired: number; total: number } {
  const ids = BUGS.filter((b) => b.band === band).map((b) => b.id);
  return {
    repaired: ids.filter((id) => getRecord(state, id).state === "repaired").length,
    total: ids.length,
  };
}
