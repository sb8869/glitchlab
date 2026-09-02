/**
 * Column traces — the working, not just the answer.
 *
 * A buggy procedure is a procedure, so showing only "the robot wrote 324, the
 * answer is 214" hides the entire thing being taught. What a child needs to
 * see is WHERE the two methods diverge: which column, and what happened there.
 *
 * Everything here is computed. The digits, the borrows, the carries and the
 * column that differs all come from the engine, exactly like the answers do,
 * so no model is ever in a position to invent a step.
 */

import { digitAt, digitsOf, fracStr, itemLabel, lcm } from "../bugs/procedures.ts";
import type { Frac, Item } from "../bugs/types.ts";

export type Cell = {
  digit: string;
  /** Superscript to the LEFT: the ten that was traded in. */
  borrowIn?: string;
  /** Superscript to the RIGHT: what this digit became after lending. */
  becomes?: string;
  /** Superscript to the LEFT on an addition: the carried one. */
  carryIn?: string;
};

export type ColumnTrace = {
  kind: "columns";
  op: "+" | "-";
  /** All MSB-first, padded to the same width. */
  top: Cell[];
  bottom: Cell[];
  /** Result digits, MSB-first. Longer than the columns if the bug overflows. */
  result: string[];
  /** Per result column, true where this method departs from the correct one. */
  differs: boolean[];
  caption: string | null;
};

/**
 * Fractions have no columns, but they do have a procedure, and skipping a
 * step of it is exactly what three of the four fraction bugs are. So the
 * working here is the steps: rewrite over a common bottom, then act.
 */
export type StepTrace = {
  kind: "steps";
  steps: { text: string; hot?: boolean }[];
  caption: string | null;
};

export type PlainTrace = { kind: "plain" };
export type Trace = ColumnTrace | StepTrace | PlainTrace;

const pad = (xs: string[], width: number) =>
  Array.from({ length: width - xs.length }, () => "").concat(xs);

/**
 * The taught procedure, step by step: where a ten is traded and what the
 * lending column becomes. This is the half a child is trying to learn.
 */
function correctCells(item: Extract<Item, { kind: "arith" }>): {
  top: Cell[];
  bottom: Cell[];
  caption: string | null;
} {
  const da = digitsOf(item.a);
  const db = digitsOf(item.b);
  const width = Math.max(da.length, db.length);
  const top: Cell[] = [];
  const bottom: Cell[] = [];
  let caption: string | null = null;
  let carry = 0;

  for (let i = 0; i < width; i++) {
    const t = digitAt(da, i);
    const b = digitAt(db, i);
    const cell: Cell = { digit: String(t) };

    if (item.op === "-") {
      const effective = t - carry;
      if (carry === 1) cell.becomes = String(effective);
      if (effective < b) {
        cell.borrowIn = "1";
        if (caption === null) {
          caption = `trade a ten: ${effective + 10} take away ${b} is ${effective + 10 - b}`;
        }
        carry = 1;
      } else {
        carry = 0;
      }
    } else {
      if (carry === 1) cell.carryIn = "1";
      const sum = t + b + carry;
      if (sum >= 10 && caption === null) {
        caption = `${t} and ${b} is ${t + b}, so carry the one`;
      }
      carry = sum >= 10 ? 1 : 0;
    }

    top.unshift(cell);
    bottom.unshift({ digit: i < db.length ? String(b) : "" });
  }
  return { top, bottom, caption };
}

/**
 * A trace of one method's working. `against` is the other method's answer, so
 * the columns where the two part company can be marked.
 */
export function traceArith(
  item: Item,
  answer: string,
  against: string,
  annotate: boolean,
): Trace {
  if (item.kind !== "arith") return { kind: "plain" };

  const { top, bottom, caption } = correctCells(item);
  const width = top.length;
  const mine = [...answer];
  const theirs = [...against];
  const w = Math.max(width, mine.length, theirs.length);

  const paddedMine = pad(mine, w);
  const paddedTheirs = pad(theirs, w);

  return {
    kind: "columns",
    op: item.op,
    top: pad(top.map((c) => c.digit), w).map((digit, i) => {
      const src = top[i - (w - width)];
      return annotate && src ? { ...src, digit } : { digit };
    }),
    bottom: pad(bottom.map((c) => c.digit), w).map((digit) => ({ digit })),
    result: paddedMine,
    differs: paddedMine.map((d, i) => d !== paddedTheirs[i]),
    caption: annotate ? caption : null,
  };
}

/**
 * The working for a fraction problem.
 *
 * `annotate` marks the taught side, which is the only side whose intermediate
 * steps we are entitled to show: the common-denominator line is a step the
 * correct procedure genuinely takes. A buggy procedure's middle is not
 * something we can derive, so the robot's side is its problem and its answer,
 * captioned with the bug's own words — inventing a plausible middle step for
 * it would be the one thing this whole layer exists to avoid.
 */
export function traceFraction(item: Item, answer: string, annotate: boolean): Trace {
  if (item.kind !== "fracAdd" && item.kind !== "fracCompare") return { kind: "plain" };

  const label = itemLabel(item);
  if (!annotate) {
    return { kind: "steps", steps: [{ text: label }, { text: answer, hot: true }], caption: null };
  }

  const L = lcm(item.a.d, item.b.d);
  const over = (f: Frac): string => fracStr({ n: f.n * (L / f.d), d: L });
  const already = item.a.d === L && item.b.d === L;
  const joiner = item.kind === "fracAdd" ? " + " : " vs ";
  const rewrite = { text: `${over(item.a)}${joiner}${over(item.b)}` };

  if (item.kind === "fracAdd") {
    return {
      kind: "steps",
      steps: already
        ? [{ text: label }, { text: answer, hot: true }]
        : [{ text: label }, rewrite, { text: answer, hot: true }],
      caption: already
        ? "the bottoms already match, so add the tops and keep the bottom"
        : `make both bottoms ${L}, then add the tops and keep the bottom`,
    };
  }

  return {
    kind: "steps",
    steps: already
      ? [{ text: label }, { text: `${answer} is bigger`, hot: true }]
      : [{ text: label }, rewrite, { text: `${answer} is bigger`, hot: true }],
    caption: already
      ? "same bottoms, so the bigger top is the bigger piece"
      : `make both bottoms ${L}, then the bigger top wins`,
  };
}
