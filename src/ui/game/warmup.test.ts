import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../../bugs/library.ts";
import { mulberry32 } from "../../rng.ts";
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
  workedBands,
  type LearnerState,
} from "../../learner/index.ts";
import { WARMUP_SIZE, buildWarmup } from "./warmup.ts";

const BUG = "sub_smaller_from_larger";
const OTHER = "sub_borrow_no_decrement";
const ADD = "add_carry_dropped";

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
  const quiet = buildWarmup(beginSession(createLearner()), mulberry32(1));
  assert.equal(quiet.retesting, null);
  assert.equal(quiet.slots.length, WARMUP_SIZE);
});

test("a warm-up is the same length whether or not a retest rides in it", () => {
  const quiet = buildWarmup(beginSession(createLearner()), mulberry32(4));
  const loaded = buildWarmup(readyForRetest(), mulberry32(4));
  assert.equal(loaded.slots.length, quiet.slots.length);
  assert.equal(loaded.retesting, BUG);
});

test("a due retest rides along inside ordinary warm-up problems", () => {
  const w = buildWarmup(readyForRetest(), mulberry32(3));
  assert.equal(w.slots.filter((s) => s.retestFor).length, 1);
  assert.ok(w.slots.length > 1, "a retest alone would be an exam, not a warm-up");
});

test("the retest is never the first problem the child sees", () => {
  for (let seed = 0; seed < 200; seed++) {
    const w = buildWarmup(readyForRetest(), mulberry32(seed));
    assert.equal(w.slots[0]!.retestFor, null, `seed ${seed} led with the retest`);
  }
});

test("every warm-up slot carries its own correct answer", () => {
  const w = buildWarmup(readyForRetest(), mulberry32(9));
  for (const slot of w.slots) assert.ok(slot.answer.length > 0);
});

/* -------------------------------------------- the probe is not the odd one */

test("the retest always has a twin: same band, same kind", () => {
  /*
   * This is the property that makes the probe unfindable without doing the
   * arithmetic. Warm-ups used to come from the current rung of the ladder, so
   * they were nearly all addition — and a subtraction retest was then the only
   * subtraction on the page. A child could point at it having learned nothing.
   */
  for (const bug of BUGS) {
    let s = toProbation(beginSession(createLearner()), bug.id);
    // Give them a second band to have worked in, as a real player would.
    const other = BUGS.find((b) => b.band !== bug.band)!;
    s = recordDiagnosis(s, other.id);
    s = untilDue(s, bug.id);

    for (let seed = 0; seed < 12; seed++) {
      const w = buildWarmup(s, mulberry32(seed));
      const probe = w.slots.find((x) => x.retestFor);
      assert.ok(probe, `${bug.id}: no probe at seed ${seed}`);
      const twins = w.slots.filter(
        (x) => x !== probe && x.item.band === probe.item.band && x.item.kind === probe.item.kind,
      );
      assert.ok(
        twins.length >= 1,
        `${bug.id} seed ${seed}: probe ${probe.item.band}/${probe.item.kind} stood alone in ` +
          w.slots.map((x) => `${x.item.band}/${x.item.kind}`).join(", "),
      );
    }
  }
});

test("warm-up material comes from bands the child has worked in", () => {
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, BUG); // subtraction only
  const only = buildWarmup(s, mulberry32(5));
  assert.deepEqual(workedBands(s), ["sub_regroup"]);
  for (const slot of only.slots) assert.equal(slot.item.band, "sub_regroup");

  s = recordDiagnosis(s, ADD); // now addition too
  const mixed = buildWarmup(s, mulberry32(5));
  const bands = new Set(mixed.slots.map((x) => x.item.band));
  assert.ok(bands.size >= 1 && [...bands].every((b) => workedBands(s).includes(b)));
});

/* ------------------------------------------------------------- the queue */

test("only one retest ever rides in a warm-up, however many are due", () => {
  let s = beginSession(createLearner());
  s = toProbation(s, BUG);
  s = toProbation(s, OTHER);
  s = untilDue(s, BUG);
  s = untilDue(s, OTHER);
  assert.equal(dueRetests(s).length, 2, "both should be due");

  const w = buildWarmup(s, mulberry32(11));
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
