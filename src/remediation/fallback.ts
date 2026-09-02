/**
 * Deterministic remediation — the only remediation this app has.
 *
 * It is written from the bug's own description and the computed
 * counterexample, so it is always available, always correct, offline, and
 * costs nothing.
 *
 * It is deliberately held to the validator anyway. Text nobody checks is just
 * an unvalidated string with a nicer name, and "we wrote it ourselves" is not
 * a proof that the arithmetic in it is right.
 */

import { bugById } from "../bugs/library.ts";
import { SKINS } from "../ui/assets/palette.ts";
import { counterexampleFor, practiceFor } from "./example.ts";
import type { Remediation } from "./types.ts";

export function fallbackFor(bugId: string): Remediation {
  const bug = bugById(bugId);
  const name = SKINS[bugId]?.name ?? "The robot";
  const ex = counterexampleFor(bugId);

  if (!ex) {
    return {
      bugId,
      childExplanation: `${name} ${bug.childLabel.toLowerCase()}.`,
      example: { itemId: "", problem: "", robotAnswer: "", correctAnswer: "" },
      practice: null,
      parentNote: bug.description,
    };
  }

  return {
    bugId,
    childExplanation:
      `${name} ${bug.childLabel.toLowerCase()}. ` +
      `Look at ${ex.problem}. ${name} writes ${ex.robotAnswer}, ` +
      `but the real answer is ${ex.correctAnswer}. ` +
      `Work that one out slowly and you will catch it.`,
    example: ex,
    practice: practiceFor(bugId, [ex.itemId]),
    parentNote:
      `${bug.description} ` +
      `On ${ex.problem} this shows up as ${ex.robotAnswer} instead of ${ex.correctAnswer}. ` +
      `It is a consistent rule rather than carelessness, which is why the same ` +
      `problem will come back in a later session to check the repair held.`,
  };
}
