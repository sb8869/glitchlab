import test from "node:test";
import assert from "node:assert/strict";

import { mulberry32 } from "../../engine/session.ts";
import {
  RETEST_DELAY_SESSIONS,
  STREAK_TO_PROBATION,
  beginSession,
  createLearner,
  recordDiagnosis,
  recordPractice,
} from "../../learner/index.ts";
import { buildWarmup } from "./warmup.ts";

const BUG = "sub_smaller_from_larger";

function readyForRetest() {
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, BUG);
  for (let i = 0; i < STREAK_TO_PROBATION; i++) s = recordPractice(s, BUG, true);
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) s = beginSession(s);
  return s;
}

test("no warm-up is built when nothing is due", () => {
  const s = beginSession(createLearner());
  assert.equal(buildWarmup(s, "add_regroup", mulberry32(1)), null);
});

test("a due retest rides along inside ordinary warm-up problems", () => {
  const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(3))!;
  assert.ok(w);
  assert.equal(w.retesting.length, 1);
  assert.equal(w.slots.filter((s) => s.retestFor).length, 1);
  assert.ok(w.slots.length > 1, "a retest alone would be an exam, not a warm-up");
});

test("the retest is never the first problem the child sees", () => {
  for (let seed = 0; seed < 200; seed++) {
    const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(seed))!;
    assert.equal(w.slots[0]!.retestFor, null, `seed ${seed} led with the retest`);
  }
});

test("every warm-up slot carries its own correct answer", () => {
  const w = buildWarmup(readyForRetest(), "add_regroup", mulberry32(9))!;
  for (const slot of w.slots) assert.ok(slot.answer.length > 0);
});
