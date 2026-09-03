/**
 * The delayed retest, as the child meets it.
 *
 * A retest is a warm-up problem and nothing on screen marks it. It is not
 * announced, not grouped, and never first — a probe the child can see coming
 * is one they can prime for, and priming is exactly what this mechanic exists
 * to rule out.
 *
 * Two properties do the hiding, and both are load-bearing:
 *
 *   FIXED LENGTH, EVERY SESSION. A warm-up that only appeared when something
 *   was due would announce itself by existing, and one that grew with the
 *   queue would announce itself by length. Four problems, always, whether a
 *   retest rides along or not.
 *
 *   AT MOST ONE RETEST. With five robots due, five probes in an eight-problem
 *   warm-up is not camouflage — the difficulty visibly jumps. The rest keep
 *   their place in the queue; waiting past the minimum is stronger evidence of
 *   retention, not weaker.
 */

import { generateForBug, generatePool } from "../../bugs/generate.ts";
import { correct } from "../../bugs/procedures.ts";
import type { Band, Item } from "../../bugs/types.ts";
import { interleave, nextRetest, type LearnerState } from "../../learner/index.ts";

export type WarmupSlot = {
  item: Item;
  answer: string;
  /** Set only for a retest. The UI must never render anything from this. */
  retestFor: string | null;
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

/**
 * Build the warm-up for a session. Always returns one: its presence carries
 * no information about whether anything is being tested.
 */
export function buildWarmup(
  learner: LearnerState,
  band: Band,
  rng: () => number,
  size = WARMUP_SIZE,
  seed = learner.sessionIndex * 7717 + 13,
): Warmup {
  const used = new Set<string>();
  const retestSlots: WarmupSlot[] = [];
  const bugId = nextRetest(learner);

  if (bugId) {
    // The sharpest generated item for this bug: live on it, and shared with as
    // few other bugs as possible so a miss points at this one alone.
    const item = generateForBug(bugId, seed + bugId.length, 6)[0];
    if (item) {
      used.add(item.id);
      retestSlots.push({ item, answer: correct(item), retestFor: bugId });
    }
  }

  /*
   * Fresh problems come from the MIXED pool, not the control pool. Controls
   * are the easy ones — no regrouping — and surrounding a hard retest with
   * three easy problems would make it stand out as plainly as a label would.
   * The camouflage has to be the same difficulty as the thing it hides.
   */
  const fresh: WarmupSlot[] = generatePool(band, seed + 101)
    .all.filter((i) => !used.has(i.id))
    .slice(0, size - retestSlots.length)
    .map((item: Item) => ({ item, answer: correct(item), retestFor: null }));

  return {
    slots: interleave(fresh, retestSlots, rng),
    retesting: retestSlots[0]?.retestFor ?? null,
  };
}
