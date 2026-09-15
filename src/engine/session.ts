/**
 * The session driver: the reference loop over the inference in `infer.ts`.
 *
 * Stateless by construction — every function takes the state in and returns a
 * new one — so the tests and the 500-student simulation drive it without any
 * branching for which one is asking. This is where the measured numbers come
 * from: `scripts/simulate.ts` runs exactly this loop.
 *
 * The game does not run this loop. `src/ui/game/session.ts` keeps its own
 * state (the robot's bug is fixed and known to the app, the child chooses the
 * item instead of the selector, and the parameters differ because a robot
 * never slips) and calls the SAME `infer.ts` underneath. Sharing the belief
 * update is the point; sharing a loop the game does not want is not.
 */

import type { Answer, HypothesisId, Item } from "../bugs/types.ts";
import { correct } from "../bugs/procedures.ts";
import {
  CORRECT,
  DEFAULT_CONFIG,
  argmax,
  expectedInfoGain,
  initialPosterior,
  hypothesisSpace,
  posteriorEntropy,
  update,
  type EngineConfig,
  type Posterior,
} from "./infer.ts";

/** Below this, an item tells us nothing and asking it wastes a child's turn. */
const MIN_USEFUL_GAIN = 1e-6;

export type Step = {
  index: number;
  itemId: string;
  item: Item;
  expectedGain: number;
  observed: Answer;
  correctAnswer: Answer;
  wasCorrect: boolean;
  posteriorBefore: Posterior;
  posteriorAfter: Posterior;
  entropyBefore: number;
  entropyAfter: number;
};

export type SessionState = {
  readonly bank: readonly Item[];
  readonly posterior: Posterior;
  readonly askedIds: readonly string[];
  /** The belief trace. A product requirement: the UI animates it. */
  readonly trace: readonly Step[];
};

export type StopReason = "threshold" | "budget" | "exhausted";

export type Diagnosis = {
  hypothesis: HypothesisId;
  confidence: number;
  reason: StopReason;
  itemsUsed: number;
  posterior: Posterior;
  trace: readonly Step[];
};

export function createSession(
  bank: readonly Item[],
  cfg: EngineConfig = DEFAULT_CONFIG,
): SessionState {
  return {
    bank,
    posterior: initialPosterior(hypothesisSpace(bank), cfg),
    askedIds: [],
    trace: [],
  };
}

export type Selection = { item: Item; gain: number };
export type Selector = (
  state: SessionState,
  candidates: readonly Item[],
  cfg: EngineConfig,
) => Selection | null;

/** THE core mechanic: ask the question that best separates the suspects. */
export const infoGainSelector: Selector = (state, candidates, cfg) => {
  let best: Selection | null = null;
  for (const item of candidates) {
    const gain = expectedInfoGain(state.posterior, item, cfg);
    if (best === null || gain > best.gain) best = { item, gain };
  }
  if (best === null || best.gain < MIN_USEFUL_GAIN) return null;
  return best;
};

/** The baseline the simulation measures against: pick any unasked item. */
export function randomSelector(rng: () => number): Selector {
  return (state, candidates, cfg) => {
    if (candidates.length === 0) return null;
    const item = candidates[Math.floor(rng() * candidates.length)];
    if (!item) return null;
    return { item, gain: expectedInfoGain(state.posterior, item, cfg) };
  };
}

export function candidatesFor(state: SessionState): Item[] {
  const asked = new Set(state.askedIds);
  return state.bank.filter((i) => !asked.has(i.id));
}

export function nextItem(
  state: SessionState,
  cfg: EngineConfig = DEFAULT_CONFIG,
  selector: Selector = infoGainSelector,
): Selection | null {
  if (state.askedIds.length >= cfg.budget) return null;
  if (argmax(state.posterior).p >= cfg.threshold) return null;
  return selector(state, candidatesFor(state), cfg);
}

export function recordResponse(
  state: SessionState,
  selection: Selection,
  observed: Answer,
  cfg: EngineConfig = DEFAULT_CONFIG,
): SessionState {
  const before = state.posterior;
  const after = update(before, selection.item, observed, cfg);
  const answer = correct(selection.item);
  const step: Step = {
    index: state.trace.length,
    itemId: selection.item.id,
    item: selection.item,
    expectedGain: selection.gain,
    observed,
    correctAnswer: answer,
    wasCorrect: observed === answer,
    posteriorBefore: before,
    posteriorAfter: after,
    entropyBefore: posteriorEntropy(before),
    entropyAfter: posteriorEntropy(after),
  };
  return {
    bank: state.bank,
    posterior: after,
    askedIds: [...state.askedIds, selection.item.id],
    trace: [...state.trace, step],
  };
}

export function diagnose(
  state: SessionState,
  cfg: EngineConfig = DEFAULT_CONFIG,
  reasonHint?: StopReason,
): Diagnosis {
  const top = argmax(state.posterior);
  const reason: StopReason =
    reasonHint ??
    (top.p >= cfg.threshold
      ? "threshold"
      : state.askedIds.length >= cfg.budget
        ? "budget"
        : "exhausted");
  return {
    hypothesis: top.id,
    confidence: top.p,
    reason,
    itemsUsed: state.askedIds.length,
    posterior: state.posterior,
    trace: state.trace,
  };
}

/**
 * Run a whole session against a responder. The step functions above exist so a
 * caller can drive it one question at a time; the tests and the simulator take
 * this shortcut.
 */
export function runSession(
  bank: readonly Item[],
  respond: (item: Item) => Answer,
  cfg: EngineConfig = DEFAULT_CONFIG,
  selector: Selector = infoGainSelector,
): Diagnosis {
  let state = createSession(bank, cfg);
  let reason: StopReason | undefined;
  for (;;) {
    const sel = nextItem(state, cfg, selector);
    if (sel === null) {
      if (argmax(state.posterior).p >= cfg.threshold) reason = "threshold";
      else if (state.askedIds.length >= cfg.budget) reason = "budget";
      else reason = "exhausted";
      break;
    }
    state = recordResponse(state, sel, respond(sel.item), cfg);
  }
  return diagnose(state, cfg, reason);
}

export { CORRECT };
