/**
 * Retest scheduling: which item retests a bug, and where it sits in the
 * session.
 *
 * "Interleaved" is doing real work here. A retest presented first, or in its
 * own block, is announced — the child knows they are being examined and
 * primes the procedure. Mixed into new material it is a genuine retention
 * probe, which is the only kind worth calling mastery.
 */

import { BANK } from "../bugs/bank.ts";
import { ambiguity } from "../bugs/generate.ts";
import { bugById } from "../bugs/library.ts";
import type { Item } from "../bugs/types.ts";

/** Items on which this bug is live, i.e. where it actually discriminates. */
export function discriminatingItems(
  bugId: string,
  bank: readonly Item[] = BANK,
): Item[] {
  const bug = bugById(bugId);
  return bank.filter((item) => bug.applies(item));
}

/**
 * The best item to retest a bug with.
 *
 * Every live item separates the bug from CORRECT equally well, so information
 * gain cannot rank them. What does distinguish them is AMBIGUITY: on some
 * items several other bugs write the same wrong answer, so a wrong response
 * does not pin the blame. The least ambiguous live item makes the retest
 * result mean exactly one thing.
 */
export function bestRetestItem(
  bugId: string,
  bank: readonly Item[] = BANK,
  exclude: ReadonlySet<string> = new Set(),
): Item | null {
  const candidates = discriminatingItems(bugId, bank).filter((i) => !exclude.has(i.id));
  if (candidates.length === 0) return null;

  return [...candidates].sort(
    (a, b) => ambiguity(bugId, a) - ambiguity(bugId, b) || a.id.localeCompare(b.id),
  )[0]!;
}

/**
 * Mix retest items into new material.
 *
 * Two guarantees, both asserted by tests: a retest never lands first, and
 * retests are kept apart from each other where the length allows it.
 */
export function interleave<T>(
  fresh: readonly T[],
  retests: readonly T[],
  rng: () => number,
): T[] {
  if (retests.length === 0) return [...fresh];
  const out: T[] = [...fresh];
  const placed: number[] = [];

  for (const item of retests) {
    // Index 0 is never a candidate: the probe must not announce itself.
    const lowest = 1;
    const highest = Math.max(lowest, out.length);
    let index = lowest;
    for (let attempt = 0; attempt < 8; attempt++) {
      index = lowest + Math.floor(rng() * (highest - lowest + 1));
      const adjacent = placed.some((p) => Math.abs(p - index) <= 1);
      if (!adjacent) break;
    }
    out.splice(index, 0, item);
    placed.push(index);
    for (let i = 0; i < placed.length - 1; i++) {
      if ((placed[i] ?? 0) >= index) placed[i] = (placed[i] ?? 0) + 1;
    }
  }
  return out;
}
