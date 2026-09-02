/**
 * The counterexample. Chosen and computed by the engine, so the numbers on
 * screen are never the model's opinion.
 */

import { BANK } from "../bugs/bank.ts";
import { bugById, predict } from "../bugs/library.ts";
import { correct, itemLabel } from "../bugs/procedures.ts";
import { bestRetestItem } from "../learner/schedule.ts";
import type { Counterexample } from "./types.ts";

function toCounterexample(bugId: string, itemId: string): Counterexample | null {
  const item = BANK.find((i) => i.id === itemId);
  if (!item) return null;
  return {
    itemId: item.id,
    problem: itemLabel(item),
    robotAnswer: predict(bugId, item),
    correctAnswer: correct(item),
  };
}

/**
 * The clearest single problem for showing this bug: the least ambiguous item
 * it is live on, which is the same choice the retest scheduler makes. If the
 * child can only be shown one problem, it should be the one whose wrong
 * answer points at this bug and no other.
 */
export function counterexampleFor(bugId: string): Counterexample | null {
  const item = bestRetestItem(bugId);
  return item ? toCounterexample(bugId, item.id) : null;
}

/** A second problem of the same shape, for the child to try themselves. */
export function practiceFor(bugId: string, exclude: string[] = []): Counterexample | null {
  const skip = new Set(exclude);
  const bug = bugById(bugId);
  const item = BANK.find((i) => !skip.has(i.id) && bug.applies(i));
  return item ? toCounterexample(bugId, item.id) : null;
}

/** Every number the generated prose is allowed to mention, for the validator. */
export function knownNumbers(ex: Counterexample): string[] {
  return [ex.robotAnswer, ex.correctAnswer];
}
