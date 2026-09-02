/**
 * Remediation — the only place a model belongs in this app.
 *
 * It runs strictly AFTER the bug is known. Nothing here feeds the inference
 * path; diagnosis has already finished and is deterministic.
 *
 * The division of labor is deliberate and is what makes the output safe to
 * put in front of a child: EVERY NUMBER IS COMPUTED, and the model only
 * writes the words around them. A model that hallucinates arithmetic can
 * therefore only produce prose that contradicts numbers we already hold — and
 * that contradiction is exactly what the validator catches.
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
  source: "generated" | "fallback";
  models?: { child: string; parent: string };
};

export type Usage = { inputTokens: number; outputTokens: number };

export type CostLine = {
  model: string;
  usage: Usage;
  /** Null when the model is not in the price table — never guessed. */
  usd: number | null;
};

export type GenerationRecord = {
  generatedAt: string;
  entries: Record<string, Remediation>;
  costs: CostLine[];
  totalUsd: number | null;
};
