/**
 * Prints the mastery story as a narrative, because it is the one mechanic
 * that is invisible on screen: it happens across sessions, not within one.
 *
 *   node --experimental-strip-types scripts/mastery-walkthrough.ts
 */

import { BANK } from "../src/bugs/bank.ts";
import { bugById, predict } from "../src/bugs/library.ts";
import { correct, itemLabel } from "../src/bugs/procedures.ts";
import { mulberry32 } from "../src/rng.ts";
import { runSession } from "../src/engine/session.ts";
import { SKINS } from "../src/ui/assets/palette.ts";
import {
  STREAK_TO_PROBATION,
  beginSession,
  bestRetestItem,
  createLearner,
  dueRetests,
  getRecord,
  interleave,
  progress,
  recordDiagnosis,
  recordPractice,
  recordRetest,
  repairLog,
} from "../src/learner/index.ts";

const BUG = "sub_smaller_from_larger";
const bot = SKINS[BUG]!;
const bug = bugById(BUG);
const rng = mulberry32(11);

const line = (s = "") => console.log(s);
const rule = () => line("-".repeat(72));

line();
line(`GLITCH LAB — how one robot gets repaired`);
line(`Patient: ${bot.name}   Bug: "${bug.childLabel}"`);
rule();

let learner = createLearner();

/* ------------------------------------------------------------- session 1 */
learner = beginSession(learner);
line(`\nSESSION ${learner.sessionIndex} — diagnosis`);

const diagnosis = runSession(BANK, (item) => predict(BUG, item));
for (const step of diagnosis.trace) {
  line(`  asks ${itemLabel(step.item).padEnd(12)} child says ${step.observed.padEnd(6)} (correct ${step.correctAnswer})`);
}
line(`  -> engine names it in ${diagnosis.itemsUsed} items, confidence ${(diagnosis.confidence * 100).toFixed(1)}%`);
learner = recordDiagnosis(learner, BUG);

line(`\n  ${bot.name} is opened up. The child practices:`);
for (let i = 0; i < STREAK_TO_PROBATION; i++) {
  learner = recordPractice(learner, BUG, true);
  line(`    correct #${i + 1} -> streak ${getRecord(learner, BUG).streak}`);
}
line(`\n  State: ${getRecord(learner, BUG).state.toUpperCase()}`);
line(`  Three in a row. It LOOKS fixed. Nothing has been retired:`);
line(`  repaired robots = ${progress(learner).repaired}/${progress(learner).total}`);
line(`  Every streak-based system would call this mastered here. This one does not.`);

/* ------------------------------------------------------------- session 2 */
learner = beginSession(learner);
line(`\nSESSION ${learner.sessionIndex} — new material`);
line(`  Retests due: ${dueRetests(learner).length === 0 ? "none — too soon" : dueRetests(learner).join(", ")}`);

/* ------------------------------------------------------------- session 3 */
learner = beginSession(learner);
line(`\nSESSION ${learner.sessionIndex} — the delayed retest`);
const due = dueRetests(learner);
line(`  Retests due: ${due.join(", ")}`);

const retestItem = bestRetestItem(BUG)!;
const fresh = BANK.filter((i) => i.band === "add_regroup").slice(0, 5);
const queue = interleave(fresh, [retestItem], rng);
line(`\n  The retest is mixed into new material, never announced and never first:`);
queue.forEach((item, i) => {
  const isRetest = item.id === retestItem.id;
  line(`    ${i + 1}. ${itemLabel(item).padEnd(12)}${isRetest ? "   <- the retest, quietly" : ""}`);
});

/* --------------------------------------------------------- both outcomes */
rule();
line(`\nOUTCOME A — the child still has the bug`);
const wrong = predict(BUG, retestItem);
line(`  ${itemLabel(retestItem)} = ${correct(retestItem)}, child writes ${wrong}`);
const cracked = recordRetest(learner, BUG, false);
line(`  -> ${cracked.outcome.toUpperCase()}: ${bot.name} cracks back open`);
line(`     state ${getRecord(cracked.state, BUG).state}, streak reset, retest clock cleared`);
line(`     repaired robots = ${progress(cracked.state).repaired}/${progress(cracked.state).total}`);

line(`\nOUTCOME B — it really was retained`);
line(`  ${itemLabel(retestItem)} = ${correct(retestItem)}, child writes ${correct(retestItem)}`);
const repaired = recordRetest(learner, BUG, true);
line(`  -> ${repaired.outcome.toUpperCase()}: permanently retired`);
line(`     repaired robots = ${progress(repaired.state).repaired}/${progress(repaired.state).total}`);

const top = repairLog(repaired.state).slice(0, 3);
line(`\n  Repair log:`);
for (const e of top) {
  const name = SKINS[e.bugId]?.name ?? e.bugId;
  line(`    ${name.padEnd(8)} ${e.state.padEnd(10)} ${e.band}`);
}
rule();
line(`Streaks measure short-term recall. This measures retention.`);
line();
