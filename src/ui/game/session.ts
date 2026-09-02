/**
 * The game loop — mutual diagnosis.
 *
 * The child picks which problem to test the robot with. The robot answers,
 * wrongly and consistently, according to its bug. The suspect board narrows.
 * Meanwhile the child says what the RIGHT answer is, and those responses feed
 * the same engine pointed the other way, at them.
 *
 * Choosing the input is the whole game: diagnosing a broken rule requires
 * understanding the correct rule well enough to notice the deviation, and
 * some tests separate the suspects while others tell you nothing.
 */

import { BANK } from "../../bugs/bank.ts";
import { BUGS, predict } from "../../bugs/library.ts";
import { correct } from "../../bugs/procedures.ts";
import type { Band, HypothesisId, Item } from "../../bugs/types.ts";
import { mulberry32 } from "../../engine/session.ts";
import {
  CORRECT,
  DEFAULT_CONFIG,
  argmax,
  expectedInfoGain,
  hypothesisSpace,
  initialPosterior,
  update,
  type EngineConfig,
  type Posterior,
} from "../../engine/infer.ts";

/**
 * Diagnosing a robot is not the same problem as diagnosing a child, and the
 * parameters say so.
 *
 * A robot never slips, so belief about it can sharpen far faster (eps 0.02
 * against the child's 0.1). And its prior is nearly the opposite: half the
 * mass on "no bug" is right for a child, but this robot arrived in the repair
 * bay visibly glitching. Leaving priorCorrect at 0.5 made the board open by
 * announcing that the most likely explanation was "nothing is wrong" — true to
 * the default prior and useless to a child looking at a cracked robot.
 */
export const ROBOT_CONFIG: EngineConfig = {
  ...DEFAULT_CONFIG,
  eps: 0.02,
  priorCorrect: 0.06,
  threshold: 0.9,
  budget: 8,
};

/** Below this a suspect is treated as ruled out for display purposes. */
export const RULED_OUT = 0.02;

export type TestResult = {
  item: Item;
  robotAnswer: string;
  correctAnswer: string;
  /** What the child said the right answer was, once they have answered. */
  childAnswer: string | null;
  childWasRight: boolean | null;
  gain: number;
  suspectsBefore: number;
  suspectsAfter: number;
};

export type GameState = {
  /** The robot's actual bug. Never shown until the child names it. */
  patientBugId: string;
  band: Band;
  posterior: Posterior;
  askedIds: string[];
  history: TestResult[];
  /**
   * Fixed when the case opens. Test offers are drawn from it, so a single
   * visit is stable across re-renders and reproducible in tests, while two
   * visits to the same robot are not the same puzzle twice.
   */
  seed: number;
};

export function suspectCount(posterior: Posterior): number {
  return Object.values(posterior).filter((p) => p >= RULED_OUT).length;
}

export function liveSuspects(posterior: Posterior): Array<{ id: string; p: number }> {
  return Object.entries(posterior)
    .map(([id, p]) => ({ id, p }))
    .sort((a, b) => b.p - a.p);
}

/**
 * Tests are offered from the band being played, so a first grader working on
 * place value is never handed a fraction problem. The suspect board, though,
 * starts as the WHOLE library: the robot could have any bug at all, and a
 * single wrong answer rules out most of them at once. That first collapse is
 * the most legible thing the engine does.
 */
export function bandBank(band: Band): Item[] {
  return BANK.filter((i) => i.band === band);
}

export function startGame(patientBugId: string, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const bug = BUGS.find((b) => b.id === patientBugId);
  const band: Band = bug?.band ?? "sub_regroup";
  return {
    patientBugId,
    band,
    posterior: initialPosterior(hypothesisSpace(BANK), ROBOT_CONFIG),
    askedIds: [],
    history: [],
    seed,
  };
}

/**
 * Three tests to choose between, deliberately of mixed quality: one from the
 * best-scoring tier, one middling, and one that cannot separate the remaining
 * suspects at all. The child learning to tell them apart IS the numeracy work.
 *
 * Within a tier the choice is random, seeded per visit. That matters for two
 * reasons. Offering the single argmax every time made every playthrough of a
 * robot identical, which is no fun twice. And the top tier is usually several
 * items with the SAME expected gain, so picking the first one was an arbitrary
 * tie-break dressed up as a decision.
 *
 * Note what this does not do: it never filters an option out because of what
 * the robot's actual answer would be. Doing that would use hidden knowledge of
 * the bug to steer the child's choice, which is the one thing the game is
 * about not doing.
 */
export function offerTests(state: GameState, count = 3): Item[] {
  const asked = new Set(state.askedIds);
  const scored = bandBank(state.band)
    .filter((i) => !asked.has(i.id))
    .map((item) => ({ item, gain: expectedInfoGain(state.posterior, item, ROBOT_CONFIG) }))
    .sort((a, b) => b.gain - a.gain);

  if (scored.length <= count) return scored.map((s) => s.item);

  const rng = mulberry32(state.seed + state.askedIds.length * 7919);
  const take = <T,>(pool: T[]): T | null =>
    pool.length === 0 ? null : (pool[Math.floor(rng() * pool.length)] ?? null);

  const best = scored[0]!.gain;
  const informative = scored.filter((s) => s.gain > 1e-6);
  const top = informative.filter((s) => s.gain >= best * 0.95);
  const middle = informative.filter((s) => s.gain < best * 0.95);
  const duds = scored.filter((s) => s.gain <= 1e-6);

  const picks: Item[] = [];
  const push = (s: { item: Item } | null) => {
    if (s && !picks.some((p) => p.id === s.item.id)) picks.push(s.item);
  };
  push(take(top));
  push(take(middle.length > 0 ? middle : top));
  push(take(duds.length > 0 ? duds : middle));

  for (const s of scored) {
    if (picks.length >= count) break;
    push(s);
  }

  // Shuffle so the strongest test is not always in the same position.
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j]!, picks[i]!];
  }
  return picks.slice(0, count);
}

export function gainOf(state: GameState, item: Item): number {
  return expectedInfoGain(state.posterior, item, ROBOT_CONFIG);
}

/** Run the chosen test: the robot answers, and belief about it updates. */
export function runTest(state: GameState, item: Item): GameState {
  const robotAnswer = predict(state.patientBugId, item);
  const before = suspectCount(state.posterior);
  const gain = expectedInfoGain(state.posterior, item, ROBOT_CONFIG);
  const posterior = update(state.posterior, item, robotAnswer, ROBOT_CONFIG);

  return {
    ...state,
    posterior,
    askedIds: [...state.askedIds, item.id],
    history: [
      ...state.history,
      {
        item,
        robotAnswer,
        correctAnswer: correct(item),
        childAnswer: null,
        childWasRight: null,
        gain,
        suspectsBefore: before,
        suspectsAfter: suspectCount(posterior),
      },
    ],
  };
}

/** Record what the child said the right answer was, for the latest test. */
export function recordChildAnswer(state: GameState, answer: string): GameState {
  if (state.history.length === 0) return state;
  const history = [...state.history];
  const last = history[history.length - 1]!;
  history[history.length - 1] = {
    ...last,
    childAnswer: answer,
    childWasRight: answer === last.correctAnswer,
  };
  return { ...state, history };
}

export function leadingSuspect(state: GameState): { id: string; p: number } {
  return argmax(state.posterior);
}

/** The child may name the bug once one suspect is clearly ahead. */
export function canAccuse(state: GameState): boolean {
  return leadingSuspect(state).p >= ROBOT_CONFIG.threshold;
}

export function isSolved(state: GameState): boolean {
  return canAccuse(state) && leadingSuspect(state).id === state.patientBugId;
}

export { CORRECT };

/**
 * A test that would separate two tied suspects: any item on which they write
 * different answers. This is what the tie card offers as the next move, and
 * it is the same discrimination logic the engine selects on, surfaced as a
 * hint rather than hidden in the scoring.
 */
export function splittingTest(
  state: GameState,
  a: HypothesisId,
  b: HypothesisId,
): Item | null {
  const asked = new Set(state.askedIds);
  for (const item of bandBank(state.band)) {
    if (asked.has(item.id)) continue;
    if (predict(a, item) !== predict(b, item)) return item;
  }
  return null;
}

/** The live suspects are effectively tied when nothing separates their mass. */
export function isTied(posterior: Posterior, tolerance = 0.02): boolean {
  const live = liveSuspects(posterior).filter((s) => s.p >= RULED_OUT);
  if (live.length !== 2) return false;
  return Math.abs((live[0]?.p ?? 0) - (live[1]?.p ?? 0)) <= tolerance;
}
