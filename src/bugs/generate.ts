/**
 * Procedural item generation.
 *
 * The probe bank holds ten subtraction problems. A child fixing one robot sees
 * roughly twelve (three offer rounds of three, plus three practice drills), so
 * a fixed bank is exhausted inside a single case and every retest afterwards is
 * a rerun. Shuffling the order does not help: it permutes the same numbers.
 *
 * So the game generates its problems. The engine does not change at all —
 * items are generated, then CLASSIFIED by running the real bug library over
 * them, so an item's diagnostic role is measured rather than assumed. The
 * distinctness invariant does the rest: a generated item on which a bug
 * happens not to discriminate is automatically not claimed by it.
 *
 * The evaluation bank in bank.ts stays exactly as measured. Generation feeds
 * the game; scripts/simulate.ts still reports the hand-verified numbers, and
 * a second arm checks the result is not an artifact of that particular bank.
 */

import { BUGS, predict } from "./library.ts";
import { correct, fracValue, gcd, lcm, numDigits } from "./procedures.ts";
import type { Band, Frac, Item } from "./types.ts";

/* ------------------------------------------------------------ classifying */

export type Role =
  /** No bug fires. Useful precisely because it can teach nothing. */
  | "control"
  /** Two or more live bugs write the SAME wrong answer: a deadlock item. */
  | "tie"
  /** Every live bug writes a different answer: one response identifies. */
  | "solve";

export type Classified = {
  item: Item;
  live: string[];
  role: Role;
};

export function classify(item: Item): Classified {
  const live = BUGS.filter((b) => b.applies(item)).map((b) => b.id);
  if (live.length === 0) return { item, live, role: "control" };

  const byAnswer = new Map<string, number>();
  for (const id of live) {
    const a = predict(id, item);
    byAnswer.set(a, (byAnswer.get(a) ?? 0) + 1);
  }
  const collides = [...byAnswer.values()].some((n) => n > 1);
  return { item, live, role: collides ? "tie" : "solve" };
}

/** How many OTHER bugs write the same thing as `bugId` here. Lower is sharper. */
export function ambiguity(bugId: string, item: Item): number {
  const mine = predict(bugId, item);
  return BUGS.filter((b) => b.id !== bugId && predict(b.id, item) === mine).length;
}

/* -------------------------------------------------------------- shape gen */

type Rng = () => number;
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
const between = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

const sub = (a: number, b: number): Item => ({
  id: `g-sub-${a}-${b}`, band: "sub_regroup", kind: "arith", op: "-", a, b,
});
const add = (a: number, b: number, band: Band): Item => ({
  id: `g-add-${a}-${b}`, band, kind: "arith", op: "+", a, b,
});
const expanded = (parts: number[]): Item => ({
  id: `g-pv-${parts.join("-")}`, band: "place_value", kind: "expanded", parts,
});
const fadd = (a: Frac, b: Frac): Item => ({
  id: `g-fa-${a.n}-${a.d}-${b.n}-${b.d}`, band: "fraction_number", kind: "fracAdd", a, b,
});
const fcmp = (a: Frac, b: Frac): Item => ({
  id: `g-fc-${a.n}-${a.d}-${b.n}-${b.d}`, band: "fraction_number", kind: "fracCompare", a, b,
});

/** Grade 1-4 numbers: two- and three-digit, always a positive answer. */
function subtractionCandidate(rng: Rng): Item {
  const shape = pick(rng, ["two", "two", "twoZero", "three", "threeZero"] as const);
  if (shape === "two" || shape === "twoZero") {
    const t1 = between(rng, 2, 9);
    const t2 = between(rng, 1, t1 - 1);
    const u1 = shape === "twoZero" ? 0 : between(rng, 0, 9);
    const u2 = between(rng, u1 === 0 ? 1 : 0, 9);
    return sub(t1 * 10 + u1, t2 * 10 + u2);
  }
  const h1 = between(rng, 2, 9);
  const h2 = between(rng, 1, h1 - 1);
  const t1 = shape === "threeZero" ? 0 : between(rng, 0, 9);
  const t2 = between(rng, 1, 9);
  const u1 = between(rng, 0, 9);
  const u2 = between(rng, 0, 9);
  return sub(h1 * 100 + t1 * 10 + u1, h2 * 100 + t2 * 10 + u2);
}

function additionCandidate(rng: Rng, band: Band): Item | null {
  if (band === "place_value") {
    // Unequal lengths are what left-aligning gets wrong.
    return rng() < 0.6
      ? add(between(rng, 12, 89), between(rng, 3, 9), band)
      : add(between(rng, 3, 9), between(rng, 12, 89), band);
  }
  /*
   * The sum may not spill into a new place.
   *
   * "56 + 53, and Bolt says 9" is technically what forgetting the carry does,
   * but the carry it forgot was the one out of the LEFTMOST column — there is
   * no next column for it to be missing from, so the answer just loses a digit
   * and reads as nonsense rather than as a procedure. Requiring the sum to
   * keep the same number of places makes every carry an internal one, which is
   * the thing being taught and the thing a child can see going missing.
   */
  for (let tries = 0; tries < 24; tries++) {
    if (rng() < 0.3) {
      const a = between(rng, 113, 799);
      const b = between(rng, 113, 799);
      if (numDigits(a + b) === 3) return add(a, b, band);
      continue;
    }
    /*
     * Two-digit sums are built column by column rather than sampled, because
     * sampling two numbers under 100 and throwing away the ones that spill
     * leaves a pool that mostly does not carry at all — and a problem with no
     * carry in it is a problem where the carry bugs cannot show themselves.
     */
    const wantCarry = rng() < 0.65;
    const u1 = between(rng, wantCarry ? 2 : 0, 9);
    const u2 = wantCarry ? between(rng, 10 - u1, 9) : between(rng, 0, 9 - u1);
    const carried = u1 + u2 >= 10 ? 1 : 0;
    const t1 = between(rng, 1, 8);
    const t2 = between(rng, 1, 9);
    if (t1 + t2 + carried > 9) continue;
    return add(t1 * 10 + u1, t2 * 10 + u2, band);
  }
  return null;
}

function placeValueCandidate(rng: Rng): Item | null {
  /*
   * Same-length addends with no carry: left-aligning them changes nothing and
   * no carry rule has anything to drop, so nothing fires. Without this shape
   * the band generated no controls at all, because every expanded form gets
   * glued together and every unequal-length sum gets mis-aligned.
   */
  if (rng() < 0.25) {
    const t1 = between(rng, 1, 4);
    const t2 = between(rng, 1, 9 - t1);
    const u1 = between(rng, 0, 4);
    const u2 = between(rng, 0, 9 - u1);
    return add(t1 * 10 + u1, t2 * 10 + u2, "place_value");
  }
  if (rng() < 0.5) return additionCandidate(rng, "place_value");
  const h = between(rng, 1, 9) * 100;
  const t = between(rng, 1, 9) * 10;
  const u = between(rng, 1, 9);
  // Sometimes skip a place: that gap is what "closing it up" gets wrong.
  const shape = rng();
  if (shape < 0.4) return expanded([h, t, u]);
  if (shape < 0.7) return expanded([h, u]);
  return expanded([h, t]);
}

const DENOMS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function fractionCandidate(rng: Rng): Item | null {
  if (rng() < 0.5) {
    const d1 = pick(rng, DENOMS);
    const d2 = pick(rng, DENOMS);
    const a = { n: between(rng, 1, d1 - 1), d: d1 };
    const b = { n: between(rng, 1, d2 - 1), d: d2 };
    const L = lcm(d1, d2);
    const n = a.n * (L / d1) + b.n * (L / d2);
    /*
     * Only keep sums already in lowest terms. Otherwise "the" correct answer
     * is ambiguous — a child who writes 1/2 for 2/4 is right, and would be
     * marked wrong. The hand-built bank was curated this way; generation has
     * to keep the same promise.
     */
    if (n >= L || gcd(n, L) !== 1) return null;
    return fadd(a, b);
  }
  const a = { n: between(rng, 1, 9), d: pick(rng, DENOMS) };
  const b = { n: between(rng, 1, 9), d: pick(rng, DENOMS) };
  if (a.n >= a.d || b.n >= b.d) return null;
  if (fracValue(a) === fracValue(b)) return null; // no unique answer
  return fcmp(a, b);
}

function candidate(rng: Rng, band: Band): Item | null {
  switch (band) {
    case "sub_regroup": return subtractionCandidate(rng);
    case "add_regroup": return additionCandidate(rng, band);
    case "place_value": return placeValueCandidate(rng);
    case "fraction_number": return fractionCandidate(rng);
  }
}

/* ------------------------------------------------------------------ pools */

export type Pool = { all: Item[]; byRole: Record<Role, Item[]> };

/**
 * A fresh pool of problems for a band, seeded so a visit is reproducible.
 * Generation is rejection-sampled until every role is represented, because a
 * hand with no control or no tie-producer would quietly lose a mechanic.
 */
export function generatePool(band: Band, seed: number, size = 48): Pool {
  const rng = mulberry(seed);
  const seen = new Set<string>();
  const byRole: Record<Role, Item[]> = { control: [], tie: [], solve: [] };
  const all: Item[] = [];

  for (let tries = 0; tries < size * 40 && all.length < size; tries++) {
    const item = candidate(rng, band);
    if (!item || seen.has(item.id)) continue;
    if (item.kind === "arith" && item.op === "-" && item.a <= item.b) continue;
    seen.add(item.id);
    const { role } = classify(item);
    byRole[role].push(item);
    all.push(item);
  }
  return { all, byRole };
}

/** Items on which one specific bug is live, sharpest (least ambiguous) first. */
export function generateForBug(bugId: string, seed: number, count = 8): Item[] {
  const bug = BUGS.find((b) => b.id === bugId);
  if (!bug) return [];
  const rng = mulberry(seed);
  const seen = new Set<string>();
  const hits: Item[] = [];
  for (let tries = 0; tries < 4000 && hits.length < count * 4; tries++) {
    const item = candidate(rng, bug.band);
    if (!item || seen.has(item.id)) continue;
    if (item.kind === "arith" && item.op === "-" && item.a <= item.b) continue;
    seen.add(item.id);
    if (bug.applies(item)) hits.push(item);
  }
  return hits
    .sort((x, y) => ambiguity(bugId, x) - ambiguity(bugId, y) || x.id.localeCompare(y.id))
    .slice(0, count);
}

/** Problems a child can just answer: nothing fires, so nothing is being probed. */
export function generateControls(band: Band, seed: number, count = 6): Item[] {
  return generatePool(band, seed, 60).byRole.control.slice(0, count);
}

export function answerOf(item: Item): string {
  return correct(item);
}

/* Local copy so bugs/ does not depend on engine/. */
function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
