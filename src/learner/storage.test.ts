import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../bugs/library.ts";
import {
  RETEST_DELAY_SESSIONS,
  STORAGE_KEY,
  STREAK_TO_PROBATION,
  beginSession,
  clearLearner,
  createLearner,
  getRecord,
  loadLearner,
  memoryStorage,
  recordDiagnosis,
  recordPractice,
  recordRetest,
  saveLearner,
  type StorageLike,
} from "./index.ts";

/** Storage that throws on every access, like a locked-down private window. */
function hostileStorage(): StorageLike {
  return {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
}

test("a learner round-trips through storage", () => {
  const store = memoryStorage();
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, "add_carry_dropped");
  for (let i = 0; i < STREAK_TO_PROBATION; i++) s = recordPractice(s, "add_carry_dropped", true);
  assert.equal(saveLearner(s, store), true);

  const loaded = loadLearner(store);
  assert.equal(loaded.sessionIndex, s.sessionIndex);
  assert.equal(getRecord(loaded, "add_carry_dropped").state, "probation");
  assert.equal(
    getRecord(loaded, "add_carry_dropped").probationSince,
    getRecord(s, "add_carry_dropped").probationSince,
    "the retest clock must survive a reload — that is the whole point",
  );
});

test("the delayed retest still fires after a reload", () => {
  // The mastery rule spans sessions, so it has to span page loads too.
  const store = memoryStorage();
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, "frac_add_across");
  for (let i = 0; i < STREAK_TO_PROBATION; i++) s = recordPractice(s, "frac_add_across", true);
  saveLearner(s, store);

  let reloaded = loadLearner(store);
  for (let i = 0; i < RETEST_DELAY_SESSIONS; i++) {
    reloaded = beginSession(reloaded);
    saveLearner(reloaded, store);
    reloaded = loadLearner(store);
  }
  const { outcome, state } = recordRetest(reloaded, "frac_add_across", true);
  assert.equal(outcome, "repaired");
  assert.equal(getRecord(state, "frac_add_across").state, "repaired");
});

test("storage that throws never breaks the game", () => {
  const store = hostileStorage();
  assert.doesNotThrow(() => loadLearner(store));
  const fresh = loadLearner(store);
  assert.equal(fresh.sessionIndex, 0);
  assert.equal(saveLearner(fresh, store), false, "the UI is told the write failed");
  assert.doesNotThrow(() => clearLearner(store));
});

test("no storage at all still yields a working learner", () => {
  const s = loadLearner(null);
  assert.equal(Object.keys(s.records).length, BUGS.length);
  assert.equal(saveLearner(s, null), false);
});

test("corrupt or foreign data starts clean instead of crashing", () => {
  for (const junk of ["not json", "{}", '{"version":999}', '{"version":1}', "[]"]) {
    const store = memoryStorage();
    store.setItem(STORAGE_KEY, junk);
    const s = loadLearner(store);
    assert.equal(s.sessionIndex, 0);
    assert.equal(Object.keys(s.records).length, BUGS.length);
  }
});

test("a state saved before a bug was added is backfilled, not discarded", () => {
  // Adding a 14th bug later must not strand a returning child.
  const store = memoryStorage();
  let s = beginSession(createLearner());
  s = recordDiagnosis(s, "pv_concatenate");
  const trimmed = { ...s, records: { pv_concatenate: getRecord(s, "pv_concatenate") } };
  store.setItem(STORAGE_KEY, JSON.stringify(trimmed));

  const loaded = loadLearner(store);
  assert.equal(Object.keys(loaded.records).length, BUGS.length, "missing bugs backfilled");
  assert.equal(getRecord(loaded, "pv_concatenate").state, "diagnosed", "existing progress kept");
  assert.equal(getRecord(loaded, "frac_numerator_only").state, "unseen");
});
