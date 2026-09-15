import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../bugs/library.ts";
import { predict } from "../bugs/library.ts";
import { correct } from "../bugs/procedures.ts";
import type { Item } from "../bugs/types.ts";
import { traceFraction } from "./trace.ts";
import {
  counterexampleFor,
  exampleItemFor,
  extractClaims,
  practiceFor,
  remediationFor,
  validateCopy,
} from "./index.ts";

const BUG = "sub_smaller_from_larger";
const ex = () => counterexampleFor(BUG)!;

const childOpts = (bugId = BUG) => ({
  bugId,
  example: counterexampleFor(bugId)!,
  maxChars: 320,
  childReadability: true,
  requireBothAnswers: true,
});

/* ------------------------------------------------- the counterexample ---- */

test("every bug has a counterexample where the robot and the truth differ", () => {
  for (const bug of BUGS) {
    const c = counterexampleFor(bug.id);
    assert.ok(c, `${bug.id} has no counterexample`);
    assert.notEqual(c!.robotAnswer, c!.correctAnswer, `${bug.id} counterexample proves nothing`);
  }
});

test("practice is a different problem from the worked example", () => {
  for (const bug of BUGS) {
    const c = counterexampleFor(bug.id)!;
    const p = practiceFor(bug.id, [c.itemId]);
    if (p) assert.notEqual(p.itemId, c.itemId);
  }
});

/* ------------------------------------------------------- the gate -------- */

test("a hallucinated number is rejected", () => {
  const bad = `Rivet writes 223 but the real answer is 177. Remember that 6 + 3 is 10.`;
  const r = validateCopy(bad, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("arithmetic_true")), r.failures.join("; "));
});

test("quoting the robot's WRONG answer is allowed — that is the whole point", () => {
  // 71 - 28 is 43; smaller-from-larger writes 57. The sentence is false as
  // arithmetic and true as a description of the robot, so it must pass.
  const good = `Rivet says 71 - 28 is 57. Really 71 - 28 = 43. Here it writes 223 and the answer is 177.`;
  const claims = extractClaims(good);
  assert.equal(claims.length, 2, "both claims should be found");
  const r = validateCopy(good, childOpts());
  assert.ok(
    !r.failures.some((f) => f.startsWith("arithmetic_true")),
    `arithmetic should pass: ${r.failures.join("; ")}`,
  );
});

test("a wrong answer that is not even this bug's answer is rejected", () => {
  // 71 - 28 is 43 and smaller-from-larger writes 57. 99 is nobody's answer.
  const bad = `Rivet says 71 - 28 is 99. Really it is 223 and 177.`;
  const r = validateCopy(bad, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("arithmetic_true")));
});

test("technical ids never reach the copy", () => {
  const r = validateCopy(`The bug sub_smaller_from_larger writes 223 not 177.`, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("no_technical_id")), r.failures.join("; "));
});

test("nothing that scolds the child gets through", () => {
  const r = validateCopy(`You're wrong. Rivet writes 223, really 177.`, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("no_scolding")), r.failures.join("; "));
});

test("model artifacts are caught", () => {
  const r = validateCopy(`Sure! Here's the explanation: 223 versus 177.`, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("no_model_artifacts")));
});

test("copy that never names both answers is not a counterexample", () => {
  const r = validateCopy(`Rivet takes the small number from the big one every time.`, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("names_")), r.failures.join("; "));
});

test("overlong and unreadable copy is rejected", () => {
  const long = `Rivet 223 177 ` + "extraordinarily ".repeat(30);
  const r = validateCopy(long, childOpts());
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.startsWith("length")));
  assert.ok(r.failures.some((f) => f.startsWith("simple_words")));
});

test("claim extraction handles the phrasings a model actually writes", () => {
  const forms = [
    "40 - 27 = 13", "40 take away 27 is 13", "40 minus 27 leaves 13",
    "37 + 45 = 82", "37 plus 45 is 82", "40 - 27 comes out 13",
  ];
  for (const f of forms) {
    assert.equal(extractClaims(f).length, 1, `did not parse: ${f}`);
  }
});

/* ------------------------------------------------- the shipped copy ----- */

test("the deterministic copy passes the validator it was built to satisfy", () => {
  // Copy nobody checks is just an unvalidated string with a nicer name.
  for (const bug of BUGS) {
    const r = remediationFor(bug.id);
    const child = validateCopy(r.childExplanation, childOpts(bug.id));
    assert.ok(child.ok, `${bug.id} child copy: ${child.failures.join("; ")}`);

    const parent = validateCopy(r.parentNote, {
      bugId: bug.id,
      example: counterexampleFor(bug.id)!,
      maxChars: 700,
      requireBothAnswers: true,
    });
    assert.ok(parent.ok, `${bug.id} parent note: ${parent.failures.join("; ")}`);
  }
});

test("every bug has remediation, with no network and no key", () => {
  for (const bug of BUGS) {
    const r = remediationFor(bug.id);
    assert.ok(r.childExplanation.length > 0);
    assert.ok(r.parentNote.length > 0);
  }
});

/* ------------------------------------------------------- fraction working - */

test("the taught side of a fraction shows the common-denominator step", () => {
  const item: Item = {
    id: "t-fa", band: "fraction_number", kind: "fracAdd",
    a: { n: 1, d: 3 }, b: { n: 1, d: 2 },
  };
  const t = traceFraction(item, correct(item), true);
  assert.equal(t.kind, "steps");
  if (t.kind !== "steps") return;
  assert.deepEqual(t.steps.map((s) => s.text), ["1/3 + 1/2", "2/6 + 3/6", "5/6"]);
  assert.equal(t.steps[2]!.hot, true);
  assert.match(t.caption!, /make both bottoms 6/);
});

test("the robot's side is never given a middle step it did not take", () => {
  const item: Item = {
    id: "t-fa2", band: "fraction_number", kind: "fracAdd",
    a: { n: 1, d: 3 }, b: { n: 1, d: 2 },
  };
  const t = traceFraction(item, predict("frac_add_across", item), false);
  assert.equal(t.kind, "steps");
  if (t.kind !== "steps") return;
  // Its problem and what it wrote. Nothing in between, because nothing in
  // between is derivable from a bug object.
  assert.deepEqual(t.steps.map((s) => s.text), ["1/3 + 1/2", "2/5"]);
  assert.equal(t.caption, null);
});

test("a compare item ends on which one is bigger, not on an equals", () => {
  const item: Item = {
    id: "t-fc", band: "fraction_number", kind: "fracCompare",
    a: { n: 3, d: 5 }, b: { n: 1, d: 3 },
  };
  const t = traceFraction(item, correct(item), true);
  assert.equal(t.kind, "steps");
  if (t.kind !== "steps") return;
  assert.deepEqual(t.steps.map((s) => s.text), ["3/5 vs 1/3", "9/15 vs 5/15", "3/5 is bigger"]);
});

test("every fraction bug's counterexample gets a working, not a bare answer", () => {
  for (const bug of BUGS) {
    if (bug.band !== "fraction_number") continue;
    const item = exampleItemFor(bug.id)!;
    const taught = traceFraction(item, correct(item), true);
    assert.equal(taught.kind, "steps", `${bug.id} has no working`);
  }
});
