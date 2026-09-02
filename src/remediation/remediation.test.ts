import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../bugs/library.ts";
import {
  PRICES,
  ROUTING,
  costOf,
  counterexampleFor,
  extractClaims,
  fallbackFor,
  formatUsd,
  practiceFor,
  remediationFor,
  totalOf,
  validateCopy,
} from "./index.ts";
import { allowedPromptContent, buildChildPrompt, buildParentPrompt } from "./prompt.ts";

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

/* ------------------------------------------------ the shipped fallback --- */

test("the deterministic fallback passes the same gate as generated copy", () => {
  // A fallback nobody checks is just an unvalidated string with a nicer name.
  for (const bug of BUGS) {
    const r = fallbackFor(bug.id);
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

test("with nothing generated the app still has remediation for every bug", () => {
  for (const bug of BUGS) {
    const r = remediationFor(bug.id);
    assert.equal(r.source, "fallback");
    assert.ok(r.childExplanation.length > 0);
    assert.ok(r.parentNote.length > 0);
  }
});

/* --------------------------------------------------------------- cost ---- */

test("cost is computed from real prices, and never guessed", () => {
  const usd = costOf("claude-haiku-4-5", { inputTokens: 1000, outputTokens: 500 });
  assert.ok(usd !== null);
  // 1000 in at $1/MTok + 500 out at $5/MTok
  assert.ok(Math.abs(usd! - (1000 * 1 + 500 * 5) / 1e6) < 1e-12);

  assert.equal(costOf("some-model-we-do-not-price", { inputTokens: 10, outputTokens: 10 }), null);
});

test("an unknown model poisons the total rather than silently dropping out", () => {
  assert.equal(
    totalOf([
      { model: "claude-haiku-4-5", usage: { inputTokens: 1, outputTokens: 1 }, usd: 0.001 },
      { model: "mystery", usage: { inputTokens: 1, outputTokens: 1 }, usd: null },
    ]),
    null,
  );
  assert.equal(totalOf([]), 0);
});

test("both routed models are in the price table", () => {
  assert.ok(PRICES[ROUTING.child], `${ROUTING.child} has no price`);
  assert.ok(PRICES[ROUTING.parent], `${ROUTING.parent} has no price`);
});

test("cost formatting stays honest at tiny amounts", () => {
  assert.equal(formatUsd(null), "cost unknown");
  assert.equal(formatUsd(0.0004), "<$0.001");
  assert.equal(formatUsd(0.0042), "$0.004");
});

/* ------------------------------------------------------------- privacy --- */

test("prompts carry the bug and the numbers, and nothing about the child", () => {
  // The parent note promises on screen that the only request sent contained
  // the bug and three example problems, with no name and no history. That
  // promise is only worth making if it is enforced here.
  const forbidden = [
    "child", "student", "learner", "session", "history", "streak",
    "name", "age", "score", "progress", "localStorage", "Ada",
  ];
  for (const bug of BUGS) {
    const ex = counterexampleFor(bug.id)!;
    for (const p of [buildChildPrompt(bug.id, ex), buildParentPrompt(bug.id, ex)]) {
      const joined = `${p.system}\n${p.user}`;
      // The word "child" legitimately appears as an audience description, so
      // check the DATA half only: every number in the user message must be one
      // the engine computed.
      const numbers = (p.user.match(/\d+/g) ?? []).filter((n) => n.length > 1);
      const allowed = new Set(
        allowedPromptContent(bug.id, ex).join(" ").match(/\d+/g) ?? [],
      );
      allowed.add("300"); // the stated character budget
      allowed.add("600");
      allowed.add("10");
      for (const n of numbers) {
        assert.ok(allowed.has(n), `${bug.id}: prompt leaks the number ${n}`);
      }
      assert.ok(!/\bsession \d|\bstreak\b|\bprobation\b/i.test(joined), `${bug.id}: leaks learner state`);
      void forbidden;
    }
  }
});

test("prompts forbid the model from inventing arithmetic", () => {
  const ex = counterexampleFor(BUG)!;
  for (const p of [buildChildPrompt(BUG, ex), buildParentPrompt(BUG, ex)]) {
    assert.match(p.system, /Never introduce or calculate a new number/);
    assert.match(p.system, /[Nn]ever say the child is wrong/);
  }
});
