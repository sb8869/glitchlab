import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../../bugs/library.ts";
import { mulberry32 } from "../../engine/session.ts";
import {
  RETESTS_PER_WARMUP,
  STREAK_TO_PROBATION,
  beginSession,
  createLearner,
  dueRetests,
  nextRetest,
  recordDiagnosis,
  recordPractice,
  retestDue,
  type LearnerState,
} from "../../learner/index.ts";
import { WARMUP_SIZE, buildWarmup } from "./warmup.ts";

const BUG = "sub_smaller_from_larger";
const OTHER = "sub_borrow_no_decrement";

function toProbation(s: LearnerState, bugId: string): LearnerState {
  let next = recordDiagnosis(s, bugId);
  for (let i = 0; i < STREAK_TO_PROBATION; i++) next = recordPractice(next, bugId, true);
  return next;
}

/** Advance sessions until this bug's retest is allowed — jitter makes it 2 or 3. */
function untilDue(s: LearnerState, bugId: string): LearnerState {
  let next = s;
  for (let i = 0; i < 8 && !retestDue(next, bugId); i++) next = beginSession(next);
  assert.ok(retestDue(next, bugId), `${bugId} never came due`);
  return next;
}

const readyForRetest = () => untilDue(toProbation(beginSession(createLearner()), BUG), BUG);

/* ------------------------------------------------------------ camouflage */

test("a warm-up is built every session, due retest or not", () => {
  // Appearing only when something is due would announce the probe by existing.
  const quiet = buildWarmup(beginSession(createLearner()), "add_regroup", mulberry32(1));
  assert.equal(quiet.retesting, null);
  assert.equal(quiet.slots.length, WARMUP_SIZE);
});

test("a warm-up is the same length whether or not a retest rides in it", () => {
  const quiet = buildWarmup(beginSession(createLearner()), "sub_regroup", mulberry32(4));
  const loaded = buildWarmup(readyForRetest(), "sub_regroup", mulberry32(4));
  assert.equal(loaded.slots.length, quiet.slots.length);
  assert.equal(loaded.retesting, BUG);
});

test("a due retest rides along inside ordinary warm-up problems", () => {
  const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(3));
  assert.equal(w.slots.filter((s) => s.retestFor).length, 1);
  assert.ok(w.slots.length > 1, "a retest alone would be an exam, not a warm-up");
});

test("the retest is never the first problem the child sees", () => {
  for (let seed = 0; seed < 200; seed++) {
    const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(seed));
    assert.equal(w.slots[0]!.retestFor, null, `seed ${seed} led with the retest`);
  }
});

test("every warm-up slot carries its own correct answer", () => {
  const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(9));
  for (const slot of w.slots) assert.ok(slot.answer.length > 0);
});

/* ------------------------------------------------------------- the queue */

test("only one retest ever rides in a warm-up, however many are due", () => {
  let s = beginSession(createLearner());
  s = toProbation(s, BUG);
  s = toProbation(s, OTHER);
  s = untilDue(s, BUG);
  s = untilDue(s, OTHER);
  assert.equal(dueRetests(s).length, 2, "both should be due");

  const w = buildWarmup(s, "sub_regroup", mulberry32(11));
  assert.equal(w.slots.filter((x) => x.retestFor).length, RETESTS_PER_WARMUP);
  assert.equal(w.slots.length, WARMUP_SIZE, "the queue must not lengthen the warm-up");
});

test("the longest-waiting retest goes first, and the other keeps its place", () => {
  let s = beginSession(createLearner());
  s = toProbation(s, BUG);
  for (let i = 0; i < 3; i++) s = beginSession(s); // BUG waits while OTHER is earned
  s = toProbation(s, OTHER);
  s = untilDue(s, OTHER);

  assert.equal(nextRetest(s), BUG, "the one that has been waiting longer");
  assert.deepEqual(dueRetests(s), [BUG, OTHER]);
});

/* ----------------------------------------------------------- the jitter */

test("robots repaired in the same sitting do not all come due in the same one", () => {
  let s = beginSession(createLearner());
  for (const b of BUGS.slice(0, 8)) s = toProbation(s, b.id);
  const when = BUGS.slice(0, 8).map((b) => {
    let n = s;
    let sessions = 0;
    while (!retestDue(n, b.id) && sessions < 8) { n = beginSession(n); sessions++; }
    return sessions;
  });
  assert.ok(new Set(when).size > 1, `all eight came due together: ${when.join(",")}`);
  // Still never sooner than the rule allows.
  assert.ok(Math.min(...when) >= 2, `something came due after only ${Math.min(...when)}`);
});
