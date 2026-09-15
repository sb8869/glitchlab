/**
 * Simulation harness: 500 synthetic students with known assigned bugs.
 *
 * Two things this is careful about, because a flattering number here would
 * be worthless to anyone reading the submission:
 *
 * 1. PAIRED DESIGN. Whether a student slips on a given item is a
 *    deterministic function of (student, item), so the information-gain arm
 *    and the random-selection arm face the identical student. Any difference
 *    is the selector, not the luck of the draw.
 *
 * 2. THE SLIP MODEL IS NOT THE ENGINE'S MODEL. The engine assumes slips
 *    spread uniformly over the other predicted answers. The simulated child
 *    instead perturbs one digit of what they meant to write. That is a
 *    misspecified likelihood on purpose: if the result only holds when the
 *    engine's assumptions are exactly true, it is not a result.
 *
 *   node --experimental-strip-types scripts/simulate.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { BANK } from "../src/bugs/bank.ts";
import { predict } from "../src/bugs/library.ts";
import type { Answer, Item } from "../src/bugs/types.ts";
import { CORRECT, DEFAULT_CONFIG, hypothesisSpace } from "../src/engine/infer.ts";
import { mulberry32 } from "../src/rng.ts";
import { randomSelector, runSession, infoGainSelector } from "../src/engine/session.ts";

const N_STUDENTS = 500;
const SLIP_RATE = 0.1;
const SEED = 20260901;

const HYPOTHESES = hypothesisSpace(BANK);

/* ------------------------------------------------------ synthetic student */

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Change one character of the intended answer. A realistic child slip. */
function perturb(answer: Answer, r: number): Answer {
  const chars = [...answer];
  const digitPositions = chars
    .map((c, i) => (/\d/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  if (digitPositions.length === 0) return answer;
  const pos = digitPositions[Math.floor(r * digitPositions.length) % digitPositions.length]!;
  const d = Number(chars[pos]);
  const delta = r < 0.5 ? 1 : -1;
  const nd = ((d + delta) % 10 + 10) % 10;
  chars[pos] = String(nd);
  const out = chars.join("");
  return out === answer ? answer : out;
}

/**
 * A child running `truth`. Slips are keyed by (student, item) so both arms
 * of the experiment meet exactly the same child.
 */
function makeStudent(studentId: number, truth: string) {
  return (item: Item): Answer => {
    const intended = predict(truth, item);
    const r = mulberry32(hash(`${studentId}:${item.id}`))();
    if (r < SLIP_RATE) {
      const r2 = mulberry32(hash(`${studentId}:${item.id}:p`))();
      return perturb(intended, r2);
    }
    return intended;
  };
}

/* -------------------------------------------------------------- the runs */

type Row = {
  student: number;
  truth: string;
  arm: "info_gain" | "random";
  diagnosed: string;
  correct: boolean;
  confidence: number;
  items: number;
  reason: string;
};

const rows: Row[] = [];
const assignRng = mulberry32(SEED);
const baselineRng = mulberry32(SEED ^ 0x5f3759df);

for (let s = 0; s < N_STUDENTS; s++) {
  // Uniform over the hypothesis space so every bug is measured, rather than
  // sampling the engine's own prior (which would flood the sample with
  // CORRECT and inflate accuracy for free).
  const truth = HYPOTHESES[Math.floor(assignRng() * HYPOTHESES.length)]!;
  const student = makeStudent(s, truth);

  const smart = runSession(BANK, student, DEFAULT_CONFIG, infoGainSelector);
  rows.push({
    student: s, truth, arm: "info_gain",
    diagnosed: smart.hypothesis, correct: smart.hypothesis === truth,
    confidence: smart.confidence, items: smart.itemsUsed, reason: smart.reason,
  });

  const blind = runSession(BANK, student, DEFAULT_CONFIG, randomSelector(baselineRng));
  rows.push({
    student: s, truth, arm: "random",
    diagnosed: blind.hypothesis, correct: blind.hypothesis === truth,
    confidence: blind.confidence, items: blind.itemsUsed, reason: blind.reason,
  });
}

/* -------------------------------------------------------------- reporting */

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function summarize(arm: Row["arm"]) {
  const r = rows.filter((x) => x.arm === arm);
  const hits = r.filter((x) => x.correct).length;
  const p = hits / r.length;
  // Normal-approximation 95% interval. Honest enough at n=500.
  const se = Math.sqrt((p * (1 - p)) / r.length);
  return {
    arm,
    n: r.length,
    accuracy: p,
    ci95: [Math.max(0, p - 1.96 * se), Math.min(1, p + 1.96 * se)] as [number, number],
    meanItems: mean(r.map((x) => x.items)),
    reachedThreshold: r.filter((x) => x.reason === "threshold").length / r.length,
    accuracyWhenConfident:
      r.filter((x) => x.reason === "threshold" && x.correct).length /
      Math.max(1, r.filter((x) => x.reason === "threshold").length),
  };
}

const smart = summarize("info_gain");
const blind = summarize("random");

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

console.log(`\nSIMULATION — ${N_STUDENTS} synthetic students, slip rate ${pct(SLIP_RATE)}, budget ${DEFAULT_CONFIG.budget} items`);
console.log(`Hypothesis space: ${HYPOTHESES.length}. Assignment uniform over all of them.\n`);

console.log(`${"".padEnd(22)} ${"info gain".padStart(12)} ${"random".padStart(12)}`);
console.log(`${"identification acc.".padEnd(22)} ${pct(smart.accuracy).padStart(12)} ${pct(blind.accuracy).padStart(12)}`);
console.log(`${"  95% CI low".padEnd(22)} ${pct(smart.ci95[0]).padStart(12)} ${pct(blind.ci95[0]).padStart(12)}`);
console.log(`${"  95% CI high".padEnd(22)} ${pct(smart.ci95[1]).padStart(12)} ${pct(blind.ci95[1]).padStart(12)}`);
console.log(`${"mean items asked".padEnd(22)} ${smart.meanItems.toFixed(2).padStart(12)} ${blind.meanItems.toFixed(2).padStart(12)}`);
console.log(`${"reached threshold".padEnd(22)} ${pct(smart.reachedThreshold).padStart(12)} ${pct(blind.reachedThreshold).padStart(12)}`);
console.log(`${"acc. when confident".padEnd(22)} ${pct(smart.accuracyWhenConfident).padStart(12)} ${pct(blind.accuracyWhenConfident).padStart(12)}`);

// Paired McNemar-style read: on the identical student, who was right?
const byStudent = new Map<number, { s?: Row; r?: Row }>();
for (const row of rows) {
  const e = byStudent.get(row.student) ?? {};
  if (row.arm === "info_gain") e.s = row;
  else e.r = row;
  byStudent.set(row.student, e);
}
let smartOnly = 0, blindOnly = 0, both = 0, neither = 0;
for (const { s, r } of byStudent.values()) {
  if (s?.correct && r?.correct) both++;
  else if (s?.correct) smartOnly++;
  else if (r?.correct) blindOnly++;
  else neither++;
}
console.log(`\nPaired (identical student, both arms):`);
console.log(`  both right ${both}   info-gain only ${smartOnly}   random only ${blindOnly}   neither ${neither}`);
const b = smartOnly, c = blindOnly;
const mcnemar = b + c > 0 ? (b - c) ** 2 / (b + c) : 0;
console.log(`  McNemar chi-square = ${mcnemar.toFixed(2)} (>3.84 is p<0.05, 1 df)`);

console.log(`\nPER-HYPOTHESIS identification accuracy (info gain / random, n per row):`);
for (const h of HYPOTHESES) {
  const s = rows.filter((x) => x.arm === "info_gain" && x.truth === h);
  const r = rows.filter((x) => x.arm === "random" && x.truth === h);
  if (s.length === 0) continue;
  const sa = s.filter((x) => x.correct).length / s.length;
  const ra = r.filter((x) => x.correct).length / r.length;
  const items = mean(s.map((x) => x.items));
  console.log(
    `  ${h.padEnd(36)} ${pct(sa).padStart(7)} ${pct(ra).padStart(8)}   n=${String(s.length).padStart(3)}  items=${items.toFixed(1)}`,
  );
}

/* ------------------------------------------------------ robustness sweep */

/**
 * A single flattering number is not evidence. If the advantage only exists
 * at one slip rate, or if accuracy does not degrade as children get noisier,
 * something is wrong with the harness rather than right with the engine.
 */
console.log("ROBUSTNESS — accuracy and mean items as the child gets noisier:");
console.log(`  ${"slip".padStart(6)} ${"info gain".padStart(12)} ${"random".padStart(10)} ${"items (IG)".padStart(12)}`);

type SweepPoint = { slip: number; smart: number; blind: number; items: number };
const sweep: SweepPoint[] = [];

for (const slip of [0.0, 0.05, 0.1, 0.2, 0.3, 0.5]) {
  const rng = mulberry32(SEED);
  const brng = mulberry32(SEED ^ 0x5f3759df);
  let sHit = 0;
  let bHit = 0;
  let items = 0;
  for (let i = 0; i < N_STUDENTS; i++) {
    const truth = HYPOTHESES[Math.floor(rng() * HYPOTHESES.length)]!;
    const student = (item: Item): Answer => {
      const intended = predict(truth, item);
      const r = mulberry32(hash(`${i}:${item.id}`))();
      if (r < slip) return perturb(intended, mulberry32(hash(`${i}:${item.id}:p`))());
      return intended;
    };
    const a = runSession(BANK, student, DEFAULT_CONFIG, infoGainSelector);
    const b = runSession(BANK, student, DEFAULT_CONFIG, randomSelector(brng));
    if (a.hypothesis === truth) sHit++;
    if (b.hypothesis === truth) bHit++;
    items += a.itemsUsed;
  }
  const point = {
    slip,
    smart: sHit / N_STUDENTS,
    blind: bHit / N_STUDENTS,
    items: items / N_STUDENTS,
  };
  sweep.push(point);
  console.log(
    `  ${slip.toFixed(2).padStart(6)} ${pct(point.smart).padStart(12)} ${pct(point.blind).padStart(10)} ${point.items.toFixed(2).padStart(12)}`,
  );
}
console.log();

/* ---------------------------------------------------------------- output */

mkdirSync("out", { recursive: true });
writeFileSync(
  "out/simulation.json",
  JSON.stringify({ config: { N_STUDENTS, SLIP_RATE, SEED, ...DEFAULT_CONFIG }, smart, blind, paired: { both, smartOnly, blindOnly, neither, mcnemar }, sweep, rows }, null, 2),
);
const header = "student,truth,arm,diagnosed,correct,confidence,items,reason";
writeFileSync(
  "out/simulation.csv",
  [header, ...rows.map((r) => `${r.student},${r.truth},${r.arm},${r.diagnosed},${r.correct},${r.confidence.toFixed(4)},${r.items},${r.reason}`)].join("\n"),
);
console.log(`\nWrote out/simulation.json and out/simulation.csv\n`);
