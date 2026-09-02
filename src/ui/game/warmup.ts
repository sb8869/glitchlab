/**
 * The delayed retest, as the child meets it.
 *
 * A retest is a warm-up problem and nothing on screen marks it. It is not
 * announced, not grouped, and never first — a probe the child can see coming
 * is one they can prime for, and priming is exactly what this mechanic exists
 * to rule out.
 */

import { generateForBug, generatePool } from "../../bugs/generate.ts";
import { correct } from "../../bugs/procedures.ts";
import type { Band, Item } from "../../bugs/types.ts";
import { dueRetests, interleave, type LearnerState } from "../../learner/index.ts";

export type WarmupSlot = {
  item: Item;
  answer: string;
  /** Set only for a retest. The UI must never render anything from this. */
  retestFor: string | null;
};

export type Warmup = {
  slots: WarmupSlot[];
  /** Bugs whose retest is riding along in this warm-up. */
  retesting: string[];
};

/**
 * Build a short warm-up for a band, with any due retests mixed in. Returns
 * null when there is nothing to retest, so the caller can skip straight to
 * the case rather than inventing busywork.
 */
export function buildWarmup(
  learner: LearnerState,
  band: Band,
  rng: () => number,
  freshCount = 3,
  seed = learner.sessionIndex * 7717 + 13,
): Warmup | null {
  const due = dueRetests(learner);
  if (due.length === 0) return null;

  const retestSlots: WarmupSlot[] = [];
  const used = new Set<string>();
  for (const bugId of due) {
    // The sharpest generated item for this bug: live on it, and shared with as
    // few other bugs as possible so a miss points at this one alone.
    const item = generateForBug(bugId, seed + bugId.length, 6).find((i) => !used.has(i.id));
    if (!item) continue;
    used.add(item.id);
    retestSlots.push({ item, answer: correct(item), retestFor: bugId });
  }
  if (retestSlots.length === 0) return null;

  /*
   * Fresh problems come from the MIXED pool, not the control pool. Controls
   * are the easy ones — no regrouping — and surrounding a hard retest with
   * three easy problems would make it stand out as plainly as a label would.
   * The camouflage has to be the same difficulty as the thing it hides.
   */
  const fresh: WarmupSlot[] = generatePool(band, seed + 101)
    .all.filter((i) => !used.has(i.id))
    .slice(0, freshCount)
    .map((item: Item) => ({ item, answer: correct(item), retestFor: null }));

  return {
    slots: interleave(fresh, retestSlots, rng),
    retesting: retestSlots.map((s) => s.retestFor!).filter(Boolean),
  };
}
