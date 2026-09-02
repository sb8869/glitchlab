/**
 * Control problems: items on which NO bug in the library fires.
 *
 * Every offered hand includes one, because discovering that some questions
 * cannot tell you anything is half the numeracy work. The bank only contained
 * one such item per band, so the same dud appeared in 100% of hands — the
 * variety fix made the informative slots vary and left the useless one frozen.
 *
 * These live OUTSIDE the probe bank on purpose. Padding BANK with dud items
 * would make random item selection waste more turns and would flatter the
 * information-gain result in scripts/simulate.ts without the method being any
 * better. The evaluation bank stays exactly as it was measured; these are for
 * the game's offer layer only.
 *
 * `controls.test.ts` asserts every one of them is genuinely inert. A control
 * that quietly discriminated would be a lie told to the child.
 */

import type { Item } from "./types.ts";

const sub = (a: number, b: number): Item => ({
  id: `ctl-${a}-${b}`,
  band: "sub_regroup",
  kind: "arith",
  op: "-",
  a,
  b,
});

const add = (a: number, b: number, band: Item["band"]): Item => ({
  id: `ctl-${a}+${b}`,
  band,
  kind: "arith",
  op: "+",
  a,
  b,
});

const cmp = (an: number, ad: number, bn: number, bd: number): Item => ({
  id: `ctl-${an}/${ad}?${bn}/${bd}`,
  band: "fraction_number",
  kind: "fracCompare",
  a: { n: an, d: ad },
  b: { n: bn, d: bd },
});

export const CONTROLS: readonly Item[] = [
  // Subtraction with no regrouping: every column works, so nothing fires.
  sub(75, 32),
  sub(88, 41),
  sub(96, 53),
  sub(69, 24),
  sub(47, 15),

  // Addition with no carry.
  add(31, 46, "add_regroup"),
  add(52, 27, "add_regroup"),
  add(14, 25, "add_regroup"),
  add(63, 25, "add_regroup"),

  // Same-length addends with no carry: left-aligning changes nothing.
  add(24, 13, "place_value"),
  add(41, 35, "place_value"),
  add(62, 27, "place_value"),

  // Equal denominators: comparing by denominator cannot apply, and comparing
  // by numerator happens to be right, so neither fraction bug discriminates.
  cmp(3, 8, 5, 8),
  cmp(2, 7, 5, 7),
  cmp(4, 9, 7, 9),
];

export function controlsForBand(band: Item["band"]): Item[] {
  return CONTROLS.filter((i) => i.band === band);
}
