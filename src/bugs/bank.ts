import type { Band, Item } from "./types.ts";

/**
 * The probe bank.
 *
 * Items are chosen for DISCRIMINATION, not for difficulty. 40 - 27 and
 * 62 - 35 are the same difficulty by any conventional measure; the first
 * cannot separate smaller-from-larger from zero-minus-N (both predict 27)
 * and the second can (33 vs 27). That distinction is the product.
 */

const sub = (id: string, a: number, b: number): Item => ({
  id,
  band: "sub_regroup",
  kind: "arith",
  op: "-",
  a,
  b,
});

const add = (id: string, a: number, b: number, band: Band = "add_regroup"): Item => ({
  id,
  band,
  kind: "arith",
  op: "+",
  a,
  b,
});

const exp = (id: string, parts: number[]): Item => ({
  id,
  band: "place_value",
  kind: "expanded",
  parts,
});

const fadd = (id: string, an: number, ad: number, bn: number, bd: number): Item => ({
  id,
  band: "fraction_number",
  kind: "fracAdd",
  a: { n: an, d: ad },
  b: { n: bn, d: bd },
});

const fcmp = (id: string, an: number, ad: number, bn: number, bd: number): Item => ({
  id,
  band: "fraction_number",
  kind: "fracCompare",
  a: { n: an, d: ad },
  b: { n: bn, d: bd },
});

export const BANK: readonly Item[] = [
  /* --------------------------------------------------- place value ----- */
  exp("pv-300-40-2", [300, 40, 2]),
  exp("pv-300-5", [300, 5]),
  exp("pv-500-60-7", [500, 60, 7]),
  exp("pv-700-8", [700, 8]),
  exp("pv-200-30", [200, 30]),
  exp("pv-600-70-4", [600, 70, 4]),
  add("pv-24+7", 24, 7, "place_value"),
  add("pv-8+45", 8, 45, "place_value"),
  add("pv-63+9", 63, 9, "place_value"),
  add("pv-5+62", 5, 62, "place_value"),

  /* ------------------------------------------- addition w/ regrouping -- */
  add("add-37+45", 37, 45),
  add("add-58+26", 58, 26),
  add("add-46+27", 46, 27),
  add("add-29+34", 29, 34),
  add("add-23+45", 23, 45), // control: no regrouping, no bug fires
  add("add-68+57", 68, 57),

  /* ---------------------------------------- subtraction w/ regrouping -- */
  sub("sub-71-28", 71, 28),
  sub("sub-62-35", 62, 35),
  sub("sub-40-27", 40, 27),
  sub("sub-50-16", 50, 16),
  sub("sub-90-45", 90, 45),
  sub("sub-405-132", 405, 132),
  sub("sub-305-128", 305, 128), // the distinctness-invariant item
  sub("sub-604-137", 604, 137),
  sub("sub-83-27", 83, 27),
  sub("sub-64-31", 64, 31), // control: no regrouping

  /* ------------------------------------------ fractions as numbers ----- */
  fadd("fr-1/2+1/3", 1, 2, 1, 3),
  fadd("fr-1/4+1/3", 1, 4, 1, 3),
  fadd("fr-1/2+1/4", 1, 2, 1, 4),
  fadd("fr-2/3+1/6", 2, 3, 1, 6),
  fadd("fr-1/5+1/2", 1, 5, 1, 2),
  fcmp("fr-1/3?1/8", 1, 3, 1, 8),
  fcmp("fr-3/8?1/2", 3, 8, 1, 2),
  fcmp("fr-2/5?3/4", 2, 5, 3, 4),
  fcmp("fr-3/10?1/2", 3, 10, 1, 2),
  fcmp("fr-2/5?2/7", 2, 5, 2, 7),
  fcmp("fr-5/8?2/3", 5, 8, 2, 3),
];

export const BANK_BY_ID: ReadonlyMap<string, Item> = new Map(
  BANK.map((i) => [i.id, i]),
);

export function bankForBand(band: Band): readonly Item[] {
  return BANK.filter((i) => i.band === band);
}
