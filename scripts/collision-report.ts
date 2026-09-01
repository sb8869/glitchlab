/**
 * Collision report.
 *
 * For each item, groups the hypotheses that share a predicted answer. A
 * group of size > 1 is a set the item CANNOT tell apart, however the child
 * responds. This is the evidence that motivates information-gain item
 * selection: fusions are dense, so choosing the next question at random
 * routinely picks an item that leaves the live suspects fused.
 *
 * Hypotheses whose bug is not live on an item predict the correct answer by
 * construction, so they all sit in one large "silent" bucket. That bucket is
 * reported as a count; the interesting fusions are between WRONG answers.
 *
 *   node --experimental-strip-types scripts/collision-report.ts
 */

import { BANK } from "../src/bugs/bank.ts";
import { predict } from "../src/bugs/library.ts";
import { correct, itemLabel } from "../src/bugs/procedures.ts";
import { CORRECT, hypothesisSpace } from "../src/engine/infer.ts";

const hyps = hypothesisSpace(BANK);
const pairCollisions = new Map<string, number>();
let fusedItems = 0;
let deadItems = 0;

console.log(`\nCOLLISION REPORT  —  ${BANK.length} items, ${hyps.length} hypotheses`);
console.log(`${"item".padEnd(14)} ${"problem".padEnd(16)} ${"correct".padEnd(8)} live  distinct\n`);

for (const item of BANK) {
  const right = correct(item);
  const groups = new Map<string, string[]>();
  for (const h of hyps) {
    const a = predict(h, item);
    const g = groups.get(a);
    if (g) g.push(h);
    else groups.set(a, [h]);
  }

  const wrongGroups = [...groups.entries()].filter(([a]) => a !== right);
  const live = wrongGroups.reduce((s, [, hs]) => s + hs.length, 0);
  const silent = (groups.get(right) ?? []).length;
  const fused = wrongGroups.filter(([, hs]) => hs.length > 1);

  if (live === 0) deadItems++;
  if (fused.length > 0) fusedItems++;

  const flag = live === 0 ? "  <- carries no information" : fused.length > 0 ? "  <- fused" : "";
  console.log(
    `${item.id.padEnd(14)} ${itemLabel(item).padEnd(16)} ${right.padEnd(8)} ` +
      `${String(live).padStart(4)}  ${String(groups.size).padStart(8)}` +
      `   (${silent} silent)${flag}`,
  );

  for (const [answer, hs] of fused) {
    console.log(`      "${answer}" <- ${hs.join(", ")}`);
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const key = [hs[i], hs[j]].sort().join("  |  ");
        pairCollisions.set(key, (pairCollisions.get(key) ?? 0) + 1);
      }
    }
  }
}

console.log(`\n${fusedItems}/${BANK.length} items fuse two or more LIVE hypotheses on the same wrong answer.`);
console.log(`${deadItems}/${BANK.length} items carry no diagnostic information at all.\n`);

console.log("MOST CONFUSABLE PAIRS (items where both are live and write the same thing):");
const ranked = [...pairCollisions.entries()].sort((a, b) => b[1] - a[1]);
if (ranked.length === 0) console.log("  none");
for (const [pair, n] of ranked) console.log(`  ${String(n).padStart(3)}  ${pair}`);

/**
 * A pair fused on EVERY item where both are live cannot be separated by a
 * direct answer at all — only by elimination, via an item where exactly one
 * of them fires. Naming these honestly matters more than hiding them: they
 * are the cases where the engine has to reason rather than pattern-match.
 */
console.log("\nSTRUCTURALLY CONFOUNDED PAIRS (never separable by a direct answer):");
const bugIds = hyps.filter((h) => h !== CORRECT);
let anyConfound = false;
for (let i = 0; i < bugIds.length; i++) {
  for (let j = i + 1; j < bugIds.length; j++) {
    const a = bugIds[i]!;
    const b = bugIds[j]!;
    const both = BANK.filter(
      (it) => predict(a, it) !== correct(it) && predict(b, it) !== correct(it),
    );
    if (both.length === 0) continue;
    if (both.every((it) => predict(a, it) === predict(b, it))) {
      anyConfound = true;
      const escapes = BANK.filter(
        (it) =>
          (predict(a, it) !== correct(it)) !== (predict(b, it) !== correct(it)),
      );
      console.log(`  ${a}  |  ${b}`);
      console.log(
        `      co-live on ${both.length} items, identical on all of them.`,
      );
      console.log(
        `      separable only by elimination, on ${escapes.length} item(s): ` +
          `${escapes.map((e) => e.id).slice(0, 5).join(", ")}`,
      );
    }
  }
}
if (!anyConfound) console.log("  none");
console.log();
