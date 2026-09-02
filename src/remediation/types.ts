/**
 * Remediation — what the app says once the bug is known.
 *
 * It runs strictly AFTER diagnosis. Nothing here feeds the inference path.
 *
 * EVERY NUMBER SHOWN IS COMPUTED by the engine, and the sentences around
 * those numbers are assembled by this app from the bug's own description.
 * There is no generation step and no service call, so the only arithmetic a
 * child can ever be shown is arithmetic the engine performed — and the
 * validator in validate.ts holds that line even for text we wrote ourselves.
 */

export type Counterexample = {
  itemId: string;
  /** "40 - 27" */
  problem: string;
  /** What the broken procedure writes. Computed, never generated. */
  robotAnswer: string;
  /** What the taught procedure writes. Computed, never generated. */
  correctAnswer: string;
};

export type Remediation = {
  bugId: string;
  /** For the child: 2-4 short sentences, <= 320 characters. */
  childExplanation: string;
  /** The counterexample that makes the bug visible. */
  example: Counterexample;
  /** One problem for the child to try, of the same shape. */
  practice: Counterexample | null;
  /** Plain English for the adult, <= 700 characters. */
  parentNote: string;
};
