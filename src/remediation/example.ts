/**
 * The counterexample. Chosen and computed by the engine, so the numbers on
 * screen are never the model's opinion.
 *
 * Generated rather than drawn from the probe bank, so the problem a child is
 * shown is the same kind of problem they were actually playing. Both seeds are
 * fixed: generation has to be reproducible, because the validation gate ties
 * a piece of generated copy to the exact example it was written about.
 */

import { bugById, predict } from "../bugs/library.ts";
import { generateForBug } from "../bugs/generate.ts";
import { correct, itemLabel } from "../bugs/procedures.ts";
import type { Item } from "../bugs/types.ts";
import type { Counterexample } from "./types.ts";

const EXAMPLE_SEED = 4242;
const PRACTICE_SEED = 8686;

function toCounterexample(bugId: string, item: Item): Counterexample {
  return {
    itemId: item.id,
    problem: itemLabel(item),
    robotAnswer: predict(bugId, item),
    correctAnswer: correct(item),
  };
}

/**
 * The clearest single problem for showing this bug: the sharpest generated
 * item it is live on — the one whose wrong answer points at this bug and as
 * few others as possible. If the child can only be shown one problem, it
 * should be that one.
 */
export function counterexampleFor(bugId: string): Counterexample | null {
  const item = generateForBug(bugId, EXAMPLE_SEED, 1)[0];
  return item ? toCounterexample(bugId, item) : null;
}

/** A second problem of the same shape, for the child to try themselves. */
export function practiceFor(bugId: string, exclude: string[] = []): Counterexample | null {
  const skip = new Set(exclude);
  const bug = bugById(bugId);
  const item = generateForBug(bugId, PRACTICE_SEED, 8).find((i) => !skip.has(i.id));
  if (!item) return null;
  void bug;
  return toCounterexample(bugId, item);
}

/** Every number the generated prose is allowed to mention, for the validator. */
export function knownNumbers(ex: Counterexample): string[] {
  return [ex.robotAnswer, ex.correctAnswer];
}
