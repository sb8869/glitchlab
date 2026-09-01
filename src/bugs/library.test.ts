import test from "node:test";
import assert from "node:assert/strict";

import { BUGS, bugById, predict } from "./library.ts";
import { BANK } from "./bank.ts";
import { correct } from "./procedures.ts";
import type { Item } from "./types.ts";

/* Helpers so each case reads like the arithmetic it pins. */
const sub = (a: number, b: number): Item =>
  ({ id: "t", band: "sub_regroup", kind: "arith", op: "-", a, b });
const add = (a: number, b: number): Item =>
  ({ id: "t", band: "add_regroup", kind: "arith", op: "+", a, b });
const exp = (parts: number[]): Item =>
  ({ id: "t", band: "place_value", kind: "expanded", parts });
const fadd = (an: number, ad: number, bn: number, bd: number): Item =>
  ({ id: "t", band: "fraction_number", kind: "fracAdd", a: { n: an, d: ad }, b: { n: bn, d: bd } });
const fcmp = (an: number, ad: number, bn: number, bd: number): Item =>
  ({ id: "t", band: "fraction_number", kind: "fracCompare", a: { n: an, d: ad }, b: { n: bn, d: bd } });

/** Assert the bug is live on the item AND produces the expected answer. */
function fires(bugId: string, item: Item, expected: string): void {
  const bug = bugById(bugId);
  assert.equal(
    bug.applies(item),
    true,
    `${bugId} should apply to ${JSON.stringify(item)}`,
  );
  assert.equal(bug.compute(item), expected);
}

/* ---------------------------------------------------------- subtraction */

test("sub_smaller_from_larger", () => {
  fires("sub_smaller_from_larger", sub(71, 28), "57");
  fires("sub_smaller_from_larger", sub(62, 35), "33");
});

test("sub_borrow_no_decrement", () => {
  fires("sub_borrow_no_decrement", sub(71, 28), "53");
  fires("sub_borrow_no_decrement", sub(62, 35), "37");
});

test("sub_zero_minus_n_is_n", () => {
  fires("sub_zero_minus_n_is_n", sub(40, 27), "27");
});

test("sub_zero_minus_n_is_zero", () => {
  fires("sub_zero_minus_n_is_zero", sub(40, 27), "20");
});

/* ------------------------------------------------------------- addition */

test("add_carry_dropped", () => {
  fires("add_carry_dropped", add(37, 45), "72");
});

test("add_carry_written_both", () => {
  fires("add_carry_written_both", add(37, 45), "712");
});

/* ---------------------------------------------------------- place value */

test("add_left_align", () => {
  fires("add_left_align", add(24, 7), "94");
});

test("pv_concatenate", () => {
  fires("pv_concatenate", exp([300, 40, 2]), "300402");
});

test("pv_drop_empty_place", () => {
  fires("pv_drop_empty_place", exp([300, 5]), "35");
});

/* ------------------------------------------------------------ fractions */

test("frac_add_across", () => {
  fires("frac_add_across", fadd(1, 2, 1, 3), "2/5");
});

test("frac_common_denom_keep_numerators", () => {
  // 2/6 stays unreduced on purpose: reducing to 1/3 erases the signal.
  fires("frac_common_denom_keep_numerators", fadd(1, 2, 1, 3), "2/6");
});

test("frac_bigger_denominator_wins", () => {
  fires("frac_bigger_denominator_wins", fcmp(1, 3, 1, 8), "1/8");
});

test("frac_numerator_only", () => {
  fires("frac_numerator_only", fcmp(3, 8, 1, 2), "3/8");
});

/* -------------------------------------------- the distinctness invariant */

test("a bug never applies to an item where it produces the correct answer", () => {
  for (const item of BANK) {
    for (const bug of BUGS) {
      if (bug.applies(item)) {
        assert.notEqual(
          bug.compute(item),
          correct(item),
          `${bug.id} claims ${item.id} but does not discriminate on it`,
        );
      }
    }
  }
});

test("305-128 is the regression case: the zero bugs must NOT apply", () => {
  // The units column borrows first, so the tens column has an incoming
  // borrow and its top digit is no longer a bare 0. Both zero-rules fall
  // through to the correct algorithm and return 177. This was a modeling
  // question, not a code bug, and it is what motivated the invariant.
  const item = sub(305, 128);
  assert.equal(correct(item), "177");
  assert.equal(bugById("sub_zero_minus_n_is_n").applies(item), false);
  assert.equal(bugById("sub_zero_minus_n_is_zero").applies(item), false);
  assert.equal(predict("sub_zero_minus_n_is_n", item), "177");
});

test("a bug that does not apply predicts the correct answer", () => {
  // This is what makes non-discriminating items carry zero evidence.
  const noRegroup = add(23, 45);
  for (const bug of BUGS) {
    if (!bug.applies(noRegroup)) {
      assert.equal(predict(bug.id, noRegroup), correct(noRegroup));
    }
  }
});

/* --------------------------------------------------------- bank coverage */

test("every bug applies to at least one item in the bank", () => {
  const uncovered = BUGS.filter((b) => !BANK.some((i) => b.applies(i)));
  assert.deepEqual(
    uncovered.map((b) => b.id),
    [],
    "these bugs are unreachable in the probe bank",
  );
});

test("every bug has both a technical label and a child label", () => {
  for (const bug of BUGS) {
    assert.ok(bug.label.length > 0, `${bug.id} missing label`);
    assert.ok(bug.childLabel.length > 0, `${bug.id} missing childLabel`);
    assert.notEqual(bug.childLabel, bug.label);
    // The technical id must never surface to a child.
    assert.ok(!bug.childLabel.includes("_"), `${bug.id} childLabel leaks an id`);
  }
});

test("the library holds exactly the 13 documented bugs", () => {
  assert.equal(BUGS.length, 13);
  assert.equal(new Set(BUGS.map((b) => b.id)).size, 13);
});
