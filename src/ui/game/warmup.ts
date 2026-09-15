/**
 * The delayed retest, as the child meets it.
 *
 * A retest is a warm-up problem and nothing on screen marks it. It is not
 * announced, not grouped, and never first — a probe the child can see coming
 * is one they can prime for, and priming is exactly what this mechanic exists
 * to rule out.
 *
 * Four properties do the hiding, and all four are load-bearing:
 *
 *   FIXED LENGTH, EVERY SESSION. A warm-up that only appeared when something
 *   was due would announce itself by existing, and one that grew with the
 *   queue would announce itself by length. Four problems, always.
 *
 *   AT MOST ONE RETEST. With five robots due, five probes in an eight-problem
 *   warm-up is not camouflage — the difficulty visibly jumps. The rest keep
 *   their place in the queue; waiting past the minimum is stronger evidence
 *   of retention, not weaker.
 *
 *   THE PROBE IS NEVER THE ODD ONE OUT. Every warm-up is two matched pairs:
 *   two problems of one band and kind, two of another. A retest always has a
 *   twin. Warm-ups used to be drawn from the current rung of the ladder,
 *   which made them nearly all addition — so a subtraction retest was the
 *   only subtraction on the page, and a child could pick it out without
 *   knowing any arithmetic at all.
 *
 *   MATERIAL COMES FROM BANDS THE CHILD HAS WORKED IN, whether or not a
 *   retest rides. If the mix shifted to the probe's band only when a probe
 *   was present, the mix would be the tell.
 */

import { generateForBug, generatePool } from "../../bugs/generate.ts";
import { correct } from "../../bugs/procedures.ts";
import type { Band, Item, ItemKind } from "../../bugs/types.ts";
import {
  currentBand,
  interleave,
  nextRetest,
  workedBands,
  type LearnerState,
} from "../../learner/index.ts";

export type WarmupSlot = {
  item: Item;
  answer: string;
  /** Set only for a retest. The UI must never render anything from this. */
  retestFor: string | null;
};

/**
 * What a finished warm-up decided about one retest.
 *
 * `correct` is the child's FIRST answer and there is deliberately no second
 * flag beside it. A warm-up does not advance on a wrong answer — it shows the
 * working and asks again — so "reached it after being shown how" and "got it
 * wrong first" are the same event, and a field for the second would be the
 * first one spelled backwards. Only the first answer is ever scored.
 */
export type RetestOutcome = {
  bugId: string;
  correct: boolean;
  /** The problem they actually answered, not a stand-in for it. */
  problem: string;
};

export type Warmup = {
  slots: WarmupSlot[];
  /**
   * The bug whose retest is riding in this warm-up, or null. At most one, by
   * construction — the outcome screen shows one verdict, and a second retest
   * resolving silently behind it would change the repair log with no screen
   * to explain it.
   */
  retesting: string | null;
};

export const WARMUP_SIZE = 4;
/** No band and kind ever appears alone: the odd one out would be the probe. */
const WARMUP_PAIR = 2;

export function buildWarmup(
  learner: LearnerState,
  rng: () => number,
  size = WARMUP_SIZE,
  seed = learner.sessionIndex * 7717 + 13,
): Warmup {
  const bugId = nextRetest(learner);
  const retestItem = bugId ? (generateForBug(bugId, seed + bugId.length, 6)[0] ?? null) : null;

  const worked = workedBands(learner);
  const bands: Band[] = worked.length > 0 ? worked : [currentBand(learner)];

  const used = new Set<string>();
  if (retestItem) used.add(retestItem.id);

  let draws = 0;
  const poolFor = (band: Band): Item[] =>
    generatePool(band, seed + ++draws * 9973, 60).all.filter((i) => !used.has(i.id));

  const claim = (items: Item[]): Item[] => {
    for (const i of items) used.add(i.id);
    return items;
  };

  /** `want` problems of one band, all of the same kind where the band has one. */
  function takeMatched(band: Band, kind: ItemKind | null, want: number): Item[] {
    if (want <= 0) return [];
    const pool = poolFor(band);
    const wanted = kind ?? pool[0]?.kind ?? null;
    const same = pool.filter((i) => i.kind === wanted).slice(0, want);
    // A band may not hold enough of one kind; band alone still beats nothing.
    for (const i of pool) {
      if (same.length >= want) break;
      if (!same.includes(i)) same.push(i);
    }
    return claim(same.slice(0, want));
  }

  const fresh: Item[] = [];
  const rotate = (n: number) => bands[Math.abs(seed + n) % bands.length]!;

  if (retestItem) {
    // The twin: same band, same kind, so the probe is never the singleton.
    fresh.push(...takeMatched(retestItem.band, retestItem.kind, WARMUP_PAIR - 1));
  }

  const primary = retestItem ? retestItem.band : rotate(0);
  if (!retestItem) fresh.push(...takeMatched(primary, null, WARMUP_PAIR));

  // The remaining pairs come from another band the child has worked in, so the
  // shape of a warm-up is the same whether or not a probe is in it.
  const others = bands.filter((b) => b !== primary);
  let pick = 1;
  while (fresh.length + (retestItem ? 1 : 0) < size) {
    const band = others.length > 0 ? others[Math.abs(seed + pick) % others.length]! : primary;
    const before = fresh.length;
    fresh.push(...takeMatched(band, null, Math.min(WARMUP_PAIR, size - fresh.length - (retestItem ? 1 : 0))));
    if (fresh.length === before) break; // nothing left to draw; do not spin
    pick++;
  }

  const toSlot = (item: Item, retestFor: string | null): WarmupSlot => ({
    item,
    answer: correct(item),
    retestFor,
  });

  return {
    slots: interleave(
      fresh.map((i) => toSlot(i, null)),
      retestItem && bugId ? [toSlot(retestItem, bugId)] : [],
      rng,
    ),
    retesting: retestItem ? bugId : null,
  };
}
