import type { Answer, Bug, Item } from "./types.ts";
import {
  correct,
  digitAt,
  digitsOf,
  fracStr,
  fromDigitsLsb,
  lcm,
} from "./procedures.ts";

/* ------------------------------------------------------------ small utils */

type ArithItem = Extract<Item, { kind: "arith" }>;
type ExpandedItem = Extract<Item, { kind: "expanded" }>;
type FracAddItem = Extract<Item, { kind: "fracAdd" }>;
type FracCmpItem = Extract<Item, { kind: "fracCompare" }>;

const isSub = (i: Item): i is ArithItem => i.kind === "arith" && i.op === "-";
const isAdd = (i: Item): i is ArithItem => i.kind === "arith" && i.op === "+";

/** Digit j of s counting from the LEFT, 0 past the right edge. */
function leftDigit(s: string, j: number): number {
  return j < s.length ? s.charCodeAt(j) - 48 : 0;
}

/**
 * Shared skeleton for the two "0 - N" bugs.
 *
 * Both run the CORRECT borrow algorithm and deviate only in a column whose
 * top digit is 0 *and* which has no incoming borrow. The incoming-borrow
 * condition is the whole reason 305-128 comes out correct: the units column
 * borrows first, so by the time we reach the zero it is no longer a zero to
 * the child. See the distinctness invariant below.
 */
function subZeroRule(item: ArithItem, write: (bottom: number) => number): Answer {
  const da = digitsOf(item.a);
  const db = digitsOf(item.b);
  const len = Math.max(da.length, db.length);
  const out: number[] = [];
  let borrow = 0;

  for (let i = 0; i < len; i++) {
    const top = digitAt(da, i);
    const bottom = digitAt(db, i);

    if (top === 0 && borrow === 0 && bottom > 0) {
      out.push(write(bottom)); // bug fires; crucially, no borrow is taken
      continue;
    }

    const t = top - borrow;
    if (t < bottom) {
      out.push(t + 10 - bottom);
      borrow = 1;
    } else {
      out.push(t - bottom);
      borrow = 0;
    }
  }
  return fromDigitsLsb(out);
}

/* ------------------------------------------------------------------- bugs */

const RAW: Bug[] = [
  /* ============================ SUBTRACTION ============================ */
  {
    id: "sub_smaller_from_larger",
    band: "sub_regroup",
    label: "Smaller-from-larger",
    childLabel: "Always takes the small number from the big one",
    description:
      "In every column the robot subtracts the smaller digit from the larger one, whichever is on top. It never regroups, so 71 - 28 comes out 57.",
    applies: isSub,
    compute(item) {
      const it = item as ArithItem;
      const da = digitsOf(it.a);
      const db = digitsOf(it.b);
      const len = Math.max(da.length, db.length);
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        out.push(Math.abs(digitAt(da, i) - digitAt(db, i)));
      }
      return fromDigitsLsb(out);
    },
  },
  {
    id: "sub_borrow_no_decrement",
    band: "sub_regroup",
    label: "Borrow without decrementing",
    childLabel: "Takes ten but forgets to pay it back",
    description:
      "The robot adds ten to the top digit when it needs to, but never crosses out and reduces the column to the left. It borrows without repaying, so 71 - 28 comes out 53.",
    applies: isSub,
    compute(item) {
      const it = item as ArithItem;
      const da = digitsOf(it.a);
      const db = digitsOf(it.b);
      const len = Math.max(da.length, db.length);
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        const t = digitAt(da, i);
        const bottom = digitAt(db, i);
        out.push(t < bottom ? t + 10 - bottom : t - bottom);
      }
      return fromDigitsLsb(out);
    },
  },
  {
    id: "sub_zero_minus_n_is_n",
    band: "sub_regroup",
    label: "Zero minus N is N",
    childLabel: "Thinks zero take away something is that something",
    description:
      "When the top digit is a 0, the robot just copies the bottom digit down instead of regrouping. 40 - 27 comes out 27.",
    applies(item) {
      if (!isSub(item)) return false;
      const da = digitsOf(item.a);
      const db = digitsOf(item.b);
      return da.some((d, i) => d === 0 && digitAt(db, i) > 0);
    },
    compute: (item) => subZeroRule(item as ArithItem, (bottom) => bottom),
  },
  {
    id: "sub_zero_minus_n_is_zero",
    band: "sub_regroup",
    label: "Zero minus N is zero",
    childLabel: "Thinks zero take away anything is still zero",
    description:
      "When the top digit is a 0, the robot writes a 0 instead of regrouping. 40 - 27 comes out 20.",
    applies(item) {
      if (!isSub(item)) return false;
      const da = digitsOf(item.a);
      const db = digitsOf(item.b);
      return da.some((d, i) => d === 0 && digitAt(db, i) > 0);
    },
    compute: (item) => subZeroRule(item as ArithItem, () => 0),
  },

  /* ============================== ADDITION ============================= */
  {
    id: "add_carry_dropped",
    band: "add_regroup",
    label: "Carry dropped",
    childLabel: "Forgets to carry the one",
    description:
      "The robot writes the ones digit of each column sum and throws the carry away. 37 + 45 comes out 72.",
    applies: isAdd,
    compute(item) {
      const it = item as ArithItem;
      const da = digitsOf(it.a);
      const db = digitsOf(it.b);
      const len = Math.max(da.length, db.length);
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        out.push((digitAt(da, i) + digitAt(db, i)) % 10);
      }
      return fromDigitsLsb(out);
    },
  },
  {
    id: "add_carry_written_both",
    band: "add_regroup",
    label: "Both carry digits written in column",
    childLabel: "Writes the whole number in one box",
    description:
      "The robot writes the entire column sum into that column instead of carrying. 37 + 45 comes out 712.",
    applies: isAdd,
    compute(item) {
      const it = item as ArithItem;
      const da = digitsOf(it.a);
      const db = digitsOf(it.b);
      const len = Math.max(da.length, db.length);
      const cols: string[] = [];
      for (let i = len - 1; i >= 0; i--) {
        cols.push(String(digitAt(da, i) + digitAt(db, i)));
      }
      return cols.join("").replace(/^0+(?=\d)/, "");
    },
  },

  /* ============================ PLACE VALUE ============================ */
  {
    id: "add_left_align",
    band: "place_value",
    label: "Left-aligned addends",
    childLabel: "Lines the numbers up on the wrong side",
    description:
      "Addends of different lengths get lined up on the left instead of on the ones column, so the 7 in 24 + 7 lands under the tens. Comes out 94. Filed under place value because that is what it actually diagnoses.",
    applies(item) {
      if (!isAdd(item)) return false;
      return String(item.a).length !== String(item.b).length;
    },
    compute(item) {
      const it = item as ArithItem;
      const sa = String(it.a);
      const sb = String(it.b);
      const len = Math.max(sa.length, sb.length);
      const colSums: number[] = [];
      for (let j = 0; j < len; j++) {
        colSums.push(leftDigit(sa, j) + leftDigit(sb, j));
      }
      const out: number[] = [];
      let carry = 0;
      for (let j = len - 1; j >= 0; j--) {
        const s = (colSums[j] ?? 0) + carry;
        out.push(s % 10);
        carry = Math.floor(s / 10);
      }
      while (carry > 0) {
        out.push(carry % 10);
        carry = Math.floor(carry / 10);
      }
      return fromDigitsLsb(out);
    },
  },
  {
    id: "pv_concatenate",
    band: "place_value",
    label: "Expanded parts concatenated",
    childLabel: "Glues the numbers together instead of adding",
    description:
      "The robot writes the expanded parts side by side instead of combining them. 300 + 40 + 2 comes out 300402.",
    applies: (item) => item.kind === "expanded" && item.parts.length >= 2,
    compute(item) {
      const it = item as ExpandedItem;
      return it.parts.join("").replace(/^0+(?=\d)/, "");
    },
  },
  {
    id: "pv_drop_empty_place",
    band: "place_value",
    label: "Empty place closed up",
    childLabel: "Skips the empty box instead of writing zero",
    description:
      "The robot writes one digit per part and closes the gap where a place is missing, instead of holding it with a zero. 300 + 5 comes out 35.",
    applies(item) {
      return (
        item.kind === "expanded" &&
        item.parts.length >= 2 &&
        item.parts.every((p) => /^[1-9]0*$/.test(String(p)))
      );
    },
    compute(item) {
      const it = item as ExpandedItem;
      return it.parts.map((p) => String(p)[0] ?? "0").join("");
    },
  },

  /* ============================= FRACTIONS ============================= */
  {
    id: "frac_add_across",
    band: "fraction_number",
    label: "Adds numerators and denominators",
    childLabel: "Adds the tops and the bottoms",
    description:
      "The robot treats a fraction as two separate numbers and adds straight across. 1/2 + 1/3 comes out 2/5.",
    applies: (item) => item.kind === "fracAdd",
    compute(item) {
      const it = item as FracAddItem;
      return fracStr({ n: it.a.n + it.b.n, d: it.a.d + it.b.d });
    },
  },
  {
    id: "frac_common_denom_keep_numerators",
    band: "fraction_number",
    label: "Common denominator, numerators unscaled",
    childLabel: "Fixes the bottoms but forgets the tops",
    description:
      "The robot correctly finds the common denominator and then forgets to scale the numerators to match. 1/2 + 1/3 comes out 2/6.",
    applies: (item) => item.kind === "fracAdd" && item.a.d !== item.b.d,
    compute(item) {
      const it = item as FracAddItem;
      return fracStr({ n: it.a.n + it.b.n, d: lcm(it.a.d, it.b.d) });
    },
  },
  {
    id: "frac_bigger_denominator_wins",
    band: "fraction_number",
    label: "Bigger denominator wins",
    childLabel: "Thinks a bigger bottom means a bigger piece",
    description:
      "The robot compares fractions by the bottom number alone, so more pieces reads as more. It picks 1/8 over 1/3.",
    applies: (item) => item.kind === "fracCompare" && item.a.d !== item.b.d,
    compute(item) {
      const it = item as FracCmpItem;
      return fracStr(it.a.d > it.b.d ? it.a : it.b);
    },
  },
  {
    id: "frac_numerator_only",
    band: "fraction_number",
    label: "Numerator only",
    childLabel: "Only looks at the top number",
    description:
      "The robot compares fractions by the top number alone and ignores the size of the pieces. It picks 3/8 over 1/2.",
    applies: (item) => item.kind === "fracCompare" && item.a.n !== item.b.n,
    compute(item) {
      const it = item as FracCmpItem;
      return fracStr(it.a.n > it.b.n ? it.a : it.b);
    },
  },
];

/* ------------------------------------------------ distinctness invariant */

/**
 * CRITICAL INVARIANT, enforced structurally at registration rather than
 * inside each bug.
 *
 * A hypothesis may only claim an item it actually DISCRIMINATES on. If a
 * bug's procedure happens to land on the correct answer for some item, that
 * bug is indistinguishable from CORRECT there, and letting it "apply" would
 * turn a correct response into spurious evidence *for* the bug.
 *
 * This is not hypothetical. sub_zero_minus_n_is_n on 305 - 128 never fires:
 * the units column borrows first, the rule requires no incoming borrow, and
 * the procedure silently returns the correct 177. That was discovered as a
 * failing test and is a modeling question, not a code bug — which is why the
 * fix lives here, once, instead of as a special case in one bug.
 */
function register(bug: Bug): Bug {
  return {
    ...bug,
    applies(item: Item): boolean {
      if (!bug.applies(item)) return false;
      let produced: Answer;
      try {
        produced = bug.compute(item);
      } catch {
        return false;
      }
      return produced !== correct(item);
    },
  };
}

export const BUGS: readonly Bug[] = RAW.map(register);

const BUGS_BY_ID: ReadonlyMap<string, Bug> = new Map(
  BUGS.map((b) => [b.id, b]),
);

export function bugById(id: string): Bug {
  const b = BUGS_BY_ID.get(id);
  if (!b) throw new Error(`Unknown bug id: ${id}`);
  return b;
}

/**
 * What a learner holding hypothesis `h` writes for `item`.
 * A bug that does not apply produces the correct answer, which is exactly
 * right: that child gets this item right, and the item carries no evidence.
 */
export function predict(hypothesisId: string, item: Item): Answer {
  if (hypothesisId === "CORRECT") return correct(item);
  const bug = bugById(hypothesisId);
  return bug.applies(item) ? bug.compute(item) : correct(item);
}
