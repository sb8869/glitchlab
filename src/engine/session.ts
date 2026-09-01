/**
 * The session driver. Stateless by construction: every function takes the
 * learner state in and returns a new one, so the same code runs the UI, the
 * tests and the 500-student simulation with no branching.
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

/** Deterministic RNG so every simulation run is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
 * Run a whole session against a responder. The UI calls nextItem /
 * recordResponse a step at a time; tests and the simulator use this.
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
