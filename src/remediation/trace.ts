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

import { digitAt, digitsOf } from "../bugs/procedures.ts";
import type { Item } from "../bugs/types.ts";

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

export type PlainTrace = { kind: "plain" };
export type Trace = ColumnTrace | PlainTrace;

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
