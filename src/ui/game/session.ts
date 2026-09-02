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
import type { Band, Item } from "../../bugs/types.ts";
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

export function startGame(patientBugId: string): GameState {
  const bug = BUGS.find((b) => b.id === patientBugId);
  const band: Band = bug?.band ?? "sub_regroup";
  return {
    patientBugId,
    band,
    posterior: initialPosterior(hypothesisSpace(BANK), ROBOT_CONFIG),
    askedIds: [],
    history: [],
  };
}

/**
 * Three tests to choose between, deliberately of mixed quality: the best
 * available separator, something middling, and one that cannot separate the
 * remaining suspects at all. The child learning to tell them apart IS the
 * numeracy work.
 */
export function offerTests(state: GameState, count = 3): Item[] {
  const asked = new Set(state.askedIds);
  const scored = bandBank(state.band)
    .filter((i) => !asked.has(i.id))
    .map((item) => ({ item, gain: expectedInfoGain(state.posterior, item, ROBOT_CONFIG) }))
    .sort((a, b) => b.gain - a.gain);

  if (scored.length <= count) return scored.map((s) => s.item);

  const picks: Item[] = [scored[0]!.item];
  const worst = scored[scored.length - 1]!;
  const middle = scored[Math.floor(scored.length / 2)]!;
  for (const candidate of [middle, worst]) {
    if (!picks.some((p) => p.id === candidate.item.id)) picks.push(candidate.item);
  }
  // Top up if duplicates collapsed the set.
  for (const s of scored) {
    if (picks.length >= count) break;
    if (!picks.some((p) => p.id === s.item.id)) picks.push(s.item);
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
