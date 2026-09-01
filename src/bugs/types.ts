/**
 * Core vocabulary for the diagnostic engine.
 *
 * A `Bug` is not a description of a misconception — it is an *executable*
 * misconception. `compute` runs the child's broken procedure and returns
 * exactly what that child would write down. That is what makes the whole
 * inference path deterministic: predicting an answer is a function call,
 * not a model prompt.
 */

/** The four skill bands, in ladder order. */
export type Band =
  | "place_value"
  | "add_regroup"
  | "sub_regroup"
  | "fraction_number";

export const BAND_ORDER: readonly Band[] = [
  "place_value",
  "add_regroup",
  "sub_regroup",
  "fraction_number",
];

export type Frac = { n: number; d: number };

/**
 * Items carry `id` and `band` in common; `kind` discriminates the payload.
 */
export type ItemBase = { id: string; band: Band };

export type Item =
  | (ItemBase & { kind: "arith"; op: "+" | "-"; a: number; b: number })
  /** Expanded form: 300 + 40 + 2 = ? */
  | (ItemBase & { kind: "expanded"; parts: number[] })
  | (ItemBase & { kind: "fracAdd"; a: Frac; b: Frac })
  | (ItemBase & { kind: "fracCompare"; a: Frac; b: Frac });

export type ItemKind = Item["kind"];

/**
 * Answers are normalized strings. Keeping every answer in one flat
 * representation makes P(answer | bug) a string equality check, which is
 * what lets the posterior update stay trivial and total.
 *
 * Fractions are "n/d" and stay UNREDUCED where the bug produces them that
 * way: 2/6 is what the child writes, and reducing it to 1/3 erases the
 * signal that identifies frac_common_denom_keep_numerators.
 */
export type Answer = string;

export type Bug = {
  id: string;
  band: Band;
  /** Technical / parent-facing name. Never shown to a child. */
  label: string;
  /** What the UI shows a child, e.g. "Takes ten but forgets to pay it back". */
  childLabel: string;
  /** One or two sentences for the parent note and the writeup. */
  description: string;
  /** True when this bug is *live* on the item: it fires AND it is wrong. */
  applies(item: Item): boolean;
  /** The answer a child running this procedure writes down. */
  compute(item: Item): Answer;
};

/** The "no bug" hypothesis. Always in the hypothesis space. */
export const CORRECT = "CORRECT" as const;

export type HypothesisId = typeof CORRECT | string;
