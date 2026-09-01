/**
 * Bayesian inference over executable misconceptions.
 *
 * There is no model in this file and there is no model anywhere downstream
 * of it. Predicting what a child writes is a function call; updating belief
 * is Bayes; choosing the next question is mutual information. The whole
 * inference path is deterministic, runs in well under a millisecond, and
 * costs nothing.
 */

import type { Answer, HypothesisId, Item } from "../bugs/types.ts";
import { BUGS, predict } from "../bugs/library.ts";

export const CORRECT: HypothesisId = "CORRECT";

/** Answers no hypothesis predicts land in this bucket. */
export const OTHER = " OTHER";

export type Posterior = Readonly<Record<HypothesisId, number>>;

export type EngineConfig = {
  /** Slip-and-guess rate. Children slip; a single response must not be proof. */
  eps: number;
  /** Prior mass on "no bug". Most children are not broken. */
  priorCorrect: number;
  /** Nothing dies outright — an unlucky response must not eliminate the truth. */
  floor: number;
  /** Declare a diagnosis above this posterior. */
  threshold: number;
  /** Hard cap on questions asked. A child's patience is the real constraint. */
  budget: number;
};

export const DEFAULT_CONFIG: EngineConfig = {
  eps: 0.1,
  priorCorrect: 0.5,
  floor: 1e-4,
  threshold: 0.85,
  budget: 12,
};

/**
 * CORRECT plus every bug that is live on at least one item in the bank.
 * A bug unreachable in the bank is not a hypothesis, it is dead weight in
 * the denominator.
 */
export function hypothesisSpace(bank: readonly Item[]): HypothesisId[] {
  const live = BUGS.filter((b) => bank.some((i) => b.applies(i))).map((b) => b.id);
  return [CORRECT, ...live];
}

export function initialPosterior(
  hypotheses: readonly HypothesisId[],
  cfg: EngineConfig = DEFAULT_CONFIG,
): Posterior {
  const bugs = hypotheses.filter((h) => h !== CORRECT);
  const each = bugs.length > 0 ? (1 - cfg.priorCorrect) / bugs.length : 0;
  const out: Record<HypothesisId, number> = {};
  out[CORRECT] = cfg.priorCorrect;
  for (const h of bugs) out[h] = each;
  return normalize(out);
}

/** Distinct answers the surviving hypotheses predict for this item. */
export function predictionsFor(
  item: Item,
  hypotheses: readonly HypothesisId[],
): { byHypothesis: Record<HypothesisId, Answer>; distinct: Answer[] } {
  const byHypothesis: Record<HypothesisId, Answer> = {};
  const seen = new Set<Answer>();
  for (const h of hypotheses) {
    const p = predict(h, item);
    byHypothesis[h] = p;
    seen.add(p);
  }
  return { byHypothesis, distinct: [...seen] };
}

/**
 * P(observed | hypothesis) under a slip-and-guess model.
 *
 * On a match the child writes what the procedure produces, with probability
 * 1 - eps. The remaining eps is spread evenly over the other distinct
 * predictions plus one residual bucket for answers nobody predicts, so a
 * genuinely novel wrong answer is surprising but not impossible.
 */
export function likelihood(
  predicted: Answer,
  observed: Answer,
  distinctCount: number,
  cfg: EngineConfig,
): number {
  if (observed === predicted) return 1 - cfg.eps;
  return cfg.eps / distinctCount;
}

export function normalize(raw: Record<HypothesisId, number>): Posterior {
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total <= 0) {
    const keys = Object.keys(raw);
    const flat = 1 / keys.length;
    return Object.fromEntries(keys.map((k) => [k, flat]));
  }
  const out: Record<HypothesisId, number> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = v / total;
  return out;
}

/** Floor every hypothesis, then renormalize. Nothing is ever eliminated. */
function applyFloor(post: Posterior, floor: number): Posterior {
  const out: Record<HypothesisId, number> = {};
  for (const [k, v] of Object.entries(post)) out[k] = Math.max(v, floor);
  return normalize(out);
}

export function update(
  post: Posterior,
  item: Item,
  observed: Answer,
  cfg: EngineConfig = DEFAULT_CONFIG,
): Posterior {
  const hyps = Object.keys(post);
  const { byHypothesis, distinct } = predictionsFor(item, hyps);
  const raw: Record<HypothesisId, number> = {};
  for (const h of hyps) {
    const prior = post[h] ?? 0;
    raw[h] = prior * likelihood(byHypothesis[h] ?? "", observed, distinct.length, cfg);
  }
  return applyFloor(normalize(raw), cfg.floor);
}

function entropy(ps: readonly number[]): number {
  let h = 0;
  for (const p of ps) if (p > 0) h -= p * Math.log2(p);
  return h;
}

/**
 * Expected reduction in uncertainty about the hypothesis from asking this
 * item: I(H ; R) = H(R) - E_h[ H(R | h) ].
 *
 * THIS IS THE CORE MECHANIC. On 40 - 27, smaller-from-larger and
 * zero-minus-N both predict 27 and the item cannot separate them, so its
 * gain is low. On 62 - 35 they split into 33 and 37 and its gain is high.
 * A difficulty slider cannot make that distinction, because those two bugs
 * produce identical accuracy rates on every item in the bank.
 */
export function expectedInfoGain(
  post: Posterior,
  item: Item,
  cfg: EngineConfig = DEFAULT_CONFIG,
): number {
  const hyps = Object.keys(post);
  const { byHypothesis, distinct } = predictionsFor(item, hyps);
  const outcomes: Answer[] = [...distinct, OTHER];
  const k = distinct.length;

  const marginal = new Array<number>(outcomes.length).fill(0);
  let conditional = 0;

  for (const h of hyps) {
    const w = post[h] ?? 0;
    if (w <= 0) continue;
    const predicted = byHypothesis[h] ?? "";
    const row = outcomes.map((r) => (r === predicted ? 1 - cfg.eps : cfg.eps / k));
    for (let i = 0; i < row.length; i++) {
      marginal[i] = (marginal[i] ?? 0) + w * (row[i] ?? 0);
    }
    conditional += w * entropy(row);
  }

  return Math.max(0, entropy(marginal) - conditional);
}

export function posteriorEntropy(post: Posterior): number {
  return entropy(Object.values(post));
}

export function argmax(post: Posterior): { id: HypothesisId; p: number } {
  let best: HypothesisId = CORRECT;
  let bestP = -1;
  for (const [k, v] of Object.entries(post)) {
    if (v > bestP) {
      best = k;
      bestP = v;
    }
  }
  return { id: best, p: bestP };
}

/** Hypotheses above a display threshold, strongest first. The UI's "suspects". */
export function suspects(post: Posterior, min = 0.02): Array<{ id: HypothesisId; p: number }> {
  return Object.entries(post)
    .filter(([, p]) => p >= min)
    .map(([id, p]) => ({ id, p }))
    .sort((x, y) => y.p - x.p);
}
