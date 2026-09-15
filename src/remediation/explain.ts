/**
 * The remediation for a bug: what the child is told, and what a parent reads.
 *
 * There is one source and it is this app. The sentences are assembled from the
 * bug's own description and the counterexample the engine computed, so they
 * are always available, always correct, offline, and cost nothing. Nothing
 * here calls out to a service, and nothing here can say a thing about
 * arithmetic that the engine has not already computed.
 *
 * Every sentence is held to `validate.ts` anyway, for all thirteen bugs, in
 * the test suite. Text nobody checks is just an unvalidated string with a
 * nicer name, and "we wrote it ourselves" is not a proof that the arithmetic
 * in it is right.
 */

import { bugById } from "../bugs/library.ts";
import { SKINS } from "../ui/assets/palette.ts";
import { counterexampleFor, practiceFor } from "./example.ts";
import type { Remediation } from "./types.ts";

export function remediationFor(bugId: string): Remediation {
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
