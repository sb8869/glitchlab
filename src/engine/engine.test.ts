import test from "node:test";
import assert from "node:assert/strict";

import { BANK, BANK_BY_ID } from "../bugs/bank.ts";
import { BUGS, predict } from "../bugs/library.ts";
import {
  CORRECT,
  DEFAULT_CONFIG,
  argmax,
  expectedInfoGain,
  hypothesisSpace,
  initialPosterior,
  predictionsFor,
  update,
} from "./infer.ts";
import { mulberry32 } from "../rng.ts";
import { infoGainSelector, createSession, runSession, randomSelector } from "./session.ts";

const item = (id: string) => {
  const it = BANK_BY_ID.get(id);
  if (!it) throw new Error(`no such item ${id}`);
  return it;
};

test("hypothesis space is CORRECT plus every bug reachable in the bank", () => {
  const hyps = hypothesisSpace(BANK);
  assert.equal(hyps[0], CORRECT);
  assert.equal(hyps.length, BUGS.length + 1);
});

test("prior puts about half the mass on CORRECT and spreads the rest", () => {
  const post = initialPosterior(hypothesisSpace(BANK));
  assert.ok(Math.abs((post[CORRECT] ?? 0) - 0.5) < 1e-9);
  const total = Object.values(post).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("a control item with no live bug carries zero information", () => {
  const post = initialPosterior(hypothesisSpace(BANK));
  // 23 + 45 needs no regrouping, so every hypothesis predicts 68.
  assert.equal(predictionsFor(item("add-23+45"), Object.keys(post)).distinct.length, 1);
  assert.equal(expectedInfoGain(post, item("add-23+45")), 0);
});

test("THE headline claim: 62-35 separates two bugs that 40-27 cannot", () => {
  // Both bugs predict 27 on 40-27. The item cannot tell them apart at all.
  assert.equal(predict("sub_smaller_from_larger", item("sub-40-27")), "27");
  assert.equal(predict("sub_zero_minus_n_is_n", item("sub-40-27")), "27");

  // On 62-35 they come apart: 33 versus the correct 27 (the zero rule does
  // not fire there, so that child answers correctly).
  assert.equal(predict("sub_smaller_from_larger", item("sub-62-35")), "33");
  assert.equal(predict("sub_zero_minus_n_is_n", item("sub-62-35")), "27");

  // Now the engine's own judgement. After 40-27 answered "27", belief is
  // split between those two; 62-35 must have strictly more expected
  // information than re-asking anything that leaves them fused.
  const post0 = initialPosterior(hypothesisSpace(BANK));
  const post1 = update(post0, item("sub-40-27"), "27");
  const two = [post1["sub_smaller_from_larger"] ?? 0, post1["sub_zero_minus_n_is_n"] ?? 0];
  assert.ok(two[0]! > 0.2 && two[1]! > 0.2, "both suspects should survive 40-27");

  assert.ok(
    expectedInfoGain(post1, item("sub-62-35")) > expectedInfoGain(post1, item("sub-90-45")),
    "62-35 must beat 90-45, where three of the suspects collide on 55",
  );
});

test("difficulty cannot do this: the confusable bugs are accuracy-identical", () => {
  const A = "sub_smaller_from_larger";
  const B = "sub_zero_minus_n_is_n";
  const bugA = BUGS.find((b) => b.id === A)!;
  const bugB = BUGS.find((b) => b.id === B)!;

  // On EVERY item where both procedures are live, they write the same
  // wrong answer. Both children are wrong, equally often, with identical
  // response strings. Accuracy is a scalar and it cannot separate them.
  const bothLive = BANK.filter((i) => bugA.applies(i) && bugB.applies(i));
  assert.ok(bothLive.length >= 4, "need several confusable items to make the point");
  for (const i of bothLive) {
    assert.equal(predict(A, i), predict(B, i), `${i.id} should not discriminate`);
    assert.notEqual(predict(A, i), predict(CORRECT, i));
  }

  // Separation is only ever available from an item where exactly ONE of
  // them is live. Choosing that item is an information-gain decision, not
  // a difficulty decision: 62-35 is no harder than 40-27.
  const separating = BANK.filter((i) => bugA.applies(i) !== bugB.applies(i));
  assert.ok(separating.length > 0);
  for (const i of bothLive) assert.ok(!separating.includes(i));

  const post = update(initialPosterior(hypothesisSpace(BANK)), item("sub-40-27"), "27");
  const bestSeparating = Math.max(...separating.map((i) => expectedInfoGain(post, i)));
  const bestConfusable = Math.max(
    ...bothLive.filter((i) => i.id !== "sub-40-27").map((i) => expectedInfoGain(post, i)),
  );
  assert.ok(
    bestSeparating > bestConfusable,
    `separating ${bestSeparating} should beat confusable ${bestConfusable}`,
  );
});

test("information gain is never negative and is zero when nothing splits", () => {
  const post = initialPosterior(hypothesisSpace(BANK));
  for (const it of BANK) assert.ok(expectedInfoGain(post, it) >= 0);
});

test("no hypothesis is ever eliminated outright", () => {
  let post = initialPosterior(hypothesisSpace(BANK));
  // Feed six responses that are wrong for everybody.
  for (const id of ["sub-40-27", "sub-71-28", "sub-62-35", "add-37+45", "pv-300-5", "fr-1/2+1/3"]) {
    post = update(post, item(id), "999999");
  }
  for (const [h, p] of Object.entries(post)) {
    assert.ok(p > 0, `${h} was eliminated`);
  }
});

test("one unlucky slip does not permanently lose the truth", () => {
  // A smaller-from-larger child slips on the first item, then answers in
  // character. The engine must still land on the right bug.
  let first = true;
  const d = runSession(BANK, (it) => {
    if (first) {
      first = false;
      return "0"; // a slip nobody predicts
    }
    return predict("sub_smaller_from_larger", it);
  });
  assert.equal(d.hypothesis, "sub_smaller_from_larger");
});

test("every bug in the library is identifiable from a clean responder", () => {
  const failures: string[] = [];
  for (const bug of BUGS) {
    const d = runSession(BANK, (it) => predict(bug.id, it));
    if (d.hypothesis !== bug.id) failures.push(`${bug.id} -> ${d.hypothesis}`);
  }
  assert.deepEqual(failures, []);
});

test("a child with no bug is diagnosed CORRECT, not given easier problems", () => {
  const d = runSession(BANK, (it) => predict(CORRECT, it));
  assert.equal(d.hypothesis, CORRECT);
  assert.ok(d.confidence >= DEFAULT_CONFIG.threshold);
});

test("the trace is complete enough for the UI to animate belief narrowing", () => {
  const d = runSession(BANK, (it) => predict("add_carry_dropped", it));
  assert.ok(d.trace.length > 0);
  for (const step of d.trace) {
    assert.ok(Object.keys(step.posteriorBefore).length > 0);
    assert.ok(Object.keys(step.posteriorAfter).length > 0);
    assert.equal(typeof step.expectedGain, "number");
    assert.equal(step.wasCorrect, step.observed === step.correctAnswer);
  }
  // Uncertainty falls overall across the session.
  const firstStep = d.trace[0]!;
  const lastStep = d.trace[d.trace.length - 1]!;
  assert.ok(lastStep.entropyAfter < firstStep.entropyBefore);
});

test("the engine is stateless: the same inputs give the same session", () => {
  const a = runSession(BANK, (it) => predict("frac_add_across", it));
  const b = runSession(BANK, (it) => predict("frac_add_across", it));
  assert.deepEqual(a.trace.map((s) => s.itemId), b.trace.map((s) => s.itemId));
  assert.equal(a.confidence, b.confidence);
});

test("selection never repeats an item", () => {
  const d = runSession(BANK, (it) => predict("sub_borrow_no_decrement", it));
  assert.equal(new Set(d.trace.map((s) => s.itemId)).size, d.trace.length);
});

test("info gain reaches a diagnosis in no more items than random does", () => {
  // Not the headline number (that is scripts/simulate.ts) — just a guard
  // that the selector is not actively worse than picking blind.
  const rng = mulberry32(7);
  let smart = 0;
  let blind = 0;
  for (const bug of BUGS) {
    smart += runSession(BANK, (it) => predict(bug.id, it)).itemsUsed;
    blind += runSession(BANK, (it) => predict(bug.id, it), DEFAULT_CONFIG, randomSelector(rng)).itemsUsed;
  }
  assert.ok(smart <= blind, `info gain ${smart} vs random ${blind}`);
});

test("selector returns null when no item can teach us anything", () => {
  const state = createSession([item("add-23+45")]);
  assert.equal(infoGainSelector(state, [item("add-23+45")], DEFAULT_CONFIG), null);
});
