import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../bugs/library.ts";
import {
  RETEST_DELAY_SESSIONS,
  STREAK_TO_PROBATION,
  beginSession,
  createLearner,
  currentBand,
  dueRetests,
  getRecord,
  isBandComplete,
  progress,
  recordDiagnosis,
  recordPractice,
  recordRetest,
  repairLog,
  retestDue,
  type LearnerState,
} from "./index.ts";

const BUG = "sub_smaller_from_larger";

/** Diagnose, then answer correctly enough times to reach the streak. */
function toProbation(state: LearnerState, bugId = BUG): LearnerState {
  let s = recordDiagnosis(state, bugId);
  for (let i = 0; i < STREAK_TO_PROBATION; i++) s = recordPractice(s, bugId, true);
  return s;
}

/** Take a bug all the way to repaired, including the delay. */
function fullyRepair(state: LearnerState, bugId: string): LearnerState {
  let s = toProbation(state, bugId);
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) s = beginSession(s);
  return recordRetest(s, bugId, true).state;
}

/* ------------------------------------------- the rule the product rests on */

test("a streak does NOT repair a bug — it only earns probation", () => {
  // This single assertion is the difference between this and every system
  // that rewards consecutive correct answers.
  const s = toProbation(beginSession(createLearner()));
  const r = getRecord(s, BUG);
  assert.equal(r.state, "probation");
  assert.notEqual(r.state, "repaired");
  assert.equal(progress(s).repaired, 0, "nothing is retired on a streak alone");
});

test("the retest is delayed: it cannot appear in the session that earned it", () => {
  let s = toProbation(beginSession(createLearner()));
  assert.equal(retestDue(s, BUG), false);
  assert.deepEqual(dueRetests(s), []);

  // Still too early one session later.
  s = beginSession(s);
  assert.equal(retestDue(s, BUG), false);

  // Two sessions later it is due, exactly as specified.
  s = beginSession(s);
  assert.equal(retestDue(s, BUG), true);
  assert.deepEqual(dueRetests(s), [BUG]);
});

test("passing the delayed retest makes the repair permanent", () => {
  let s = toProbation(beginSession(createLearner()));
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) s = beginSession(s);
  const { state, outcome } = recordRetest(s, BUG, true);
  assert.equal(outcome, "repaired");
  assert.equal(getRecord(state, BUG).state, "repaired");
  assert.equal(progress(state).repaired, 1);
  // And it never comes back around.
  assert.deepEqual(dueRetests(beginSession(state)), []);
});

test("failing the delayed retest cracks the robot back open", () => {
  let s = toProbation(beginSession(createLearner()));
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) s = beginSession(s);
  const { state, outcome } = recordRetest(s, BUG, false);
  assert.equal(outcome, "cracked");

  const r = getRecord(state, BUG);
  assert.equal(r.state, "diagnosed", "back into the repair loop");
  assert.equal(r.streak, 0, "progress toward probation is wiped");
  assert.equal(r.probationSince, null, "the retest clock is cleared");
  assert.equal(r.retestsFailed, 1);
  assert.equal(progress(state).repaired, 0);
});

test("a cracked robot can be repaired again, and the log remembers", () => {
  let s = toProbation(beginSession(createLearner()));
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) s = beginSession(s);
  s = recordRetest(s, BUG, false).state;
  s = fullyRepair(beginSession(s), BUG);

  const r = getRecord(s, BUG);
  assert.equal(r.state, "repaired");
  assert.equal(r.retestsFailed, 1);
  const entry = repairLog(s).find((e) => e.bugId === BUG)!;
  assert.equal(entry.crackedBefore, true, "the history is worth showing");
});

/* ------------------------------------------------------ guards on the rule */

test("streaks do not survive across sessions", () => {
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, BUG);
  s = recordPractice(s, BUG, true);
  s = recordPractice(s, BUG, true);
  assert.equal(getRecord(s, BUG).streak, 2);

  s = beginSession(s);
  assert.equal(getRecord(s, BUG).streak, 0, "a streak must mean one sitting");

  // So a third correct answer the next day does not tip it into probation.
  s = recordPractice(s, BUG, true);
  assert.equal(getRecord(s, BUG).state, "diagnosed");
});

test("a wrong answer resets the streak", () => {
  let s = recordDiagnosis(beginSession(createLearner()), BUG);
  s = recordPractice(s, BUG, true);
  s = recordPractice(s, BUG, true);
  s = recordPractice(s, BUG, false);
  assert.equal(getRecord(s, BUG).streak, 0);
  assert.equal(getRecord(s, BUG).state, "diagnosed");
});

test("practice cannot fast-track a bug already on probation", () => {
  // Otherwise incidental exposure before the delay elapses would quietly
  // become the retest, defeating the whole mechanism.
  let s = toProbation(beginSession(createLearner()));
  const before = getRecord(s, BUG);
  for (let i = 0; i < 10; i++) s = recordPractice(s, BUG, true);
  const after = getRecord(s, BUG);
  assert.equal(after.state, "probation");
  assert.equal(after.probationSince, before.probationSince, "clock must not restart");
  assert.equal(progress(s).repaired, 0);
});

test("a repaired bug is never re-diagnosed or reset by later practice", () => {
  let s = fullyRepair(beginSession(createLearner()), BUG);
  s = recordDiagnosis(s, BUG);
  s = recordPractice(s, BUG, false);
  assert.equal(getRecord(s, BUG).state, "repaired");
});

/* --------------------------------------------------- log, progress, ladder */

test("progress is finite and made of competencies, not points", () => {
  const s = createLearner();
  const p = progress(s);
  assert.equal(p.total, BUGS.length, "the bar has an end the child can see");
  assert.equal(p.repaired, 0);
  assert.equal(p.fraction, 0);

  const done = fullyRepair(beginSession(s), BUG);
  assert.equal(progress(done).repaired, 1);
  assert.ok(progress(done).fraction > 0 && progress(done).fraction < 1);
});

test("the repair log lists repaired robots first", () => {
  const s = fullyRepair(beginSession(createLearner()), BUG);
  const log = repairLog(s);
  assert.equal(log.length, BUGS.length);
  assert.equal(log[0]!.bugId, BUG);
  assert.equal(log[0]!.state, "repaired");
});

test("the band ladder advances only when a whole band is repaired", () => {
  let s = beginSession(createLearner());
  assert.equal(currentBand(s), "place_value");

  const placeValue = BUGS.filter((b) => b.band === "place_value").map((b) => b.id);
  for (const id of placeValue.slice(0, -1)) s = fullyRepair(beginSession(s), id);
  assert.equal(currentBand(s), "place_value", "one bug short is not a completed band");
  assert.equal(isBandComplete(s, "place_value"), false);

  s = fullyRepair(beginSession(s), placeValue[placeValue.length - 1]!);
  assert.equal(isBandComplete(s, "place_value"), true);
  assert.equal(currentBand(s), "add_regroup", "next rung of the ladder");
});

test("the ladder runs place value -> addition -> subtraction -> fractions", () => {
  let s = beginSession(createLearner());
  const seen: string[] = [currentBand(s)];
  for (const band of ["place_value", "add_regroup", "sub_regroup"] as const) {
    for (const b of BUGS.filter((x) => x.band === band)) s = fullyRepair(beginSession(s), b.id);
    seen.push(currentBand(s));
  }
  assert.deepEqual(seen, ["place_value", "add_regroup", "sub_regroup", "fraction_number"]);
});
