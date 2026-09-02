/**
 * Prompt construction.
 *
 * Built from a fixed whitelist: the bug's own labels and the numbers the
 * engine computed. Nothing about the child goes in — no name, no answers, no
 * history, no session. That is a promise the parent note makes on screen, so
 * it is enforced here by construction and checked by a test rather than left
 * to good intentions.
 */

import { bugById } from "../bugs/library.ts";
import type { Counterexample } from "./types.ts";

export type PromptPair = { system: string; user: string };

const RULES = `
Rules that matter more than style:
- Use ONLY the numbers given to you. Never introduce or calculate a new number.
- Never say the child is wrong, and never grade them. The robot is what is broken.
- Never mention that you are a model, and do not preface your answer.
- Reply with the finished text and nothing else.`.trim();

export function buildChildPrompt(bugId: string, ex: Counterexample): PromptPair {
  const bug = bugById(bugId);
  return {
    system: [
      "You write two or three short sentences for a child aged six to ten who is",
      "playing a game about fixing a robot that does arithmetic wrong.",
      "Short words. Short sentences. Warm and curious, never babyish.",
      RULES,
    ].join(" "),
    user: [
      `The robot's broken rule, in a child's words: "${bug.childLabel}".`,
      `What the rule actually does: ${bug.description}`,
      ``,
      `The one problem that shows it:`,
      `  problem: ${ex.problem}`,
      `  the robot writes: ${ex.robotAnswer}`,
      `  the real answer is: ${ex.correctAnswer}`,
      ``,
      `Write 2-3 sentences, at most 300 characters, that make the mistake visible.`,
      `You must include both ${ex.robotAnswer} and ${ex.correctAnswer}.`,
    ].join("\n"),
  };
}

export function buildParentPrompt(bugId: string, ex: Counterexample): PromptPair {
  const bug = bugById(bugId);
  return {
    system: [
      "You write a short plain-English note for the parent of a child aged six to ten.",
      "Calm and factual. No jargon, no reassurance padding, no exclamation marks.",
      RULES,
    ].join(" "),
    user: [
      `The child is consistently applying this incorrect procedure: ${bug.label}.`,
      `In detail: ${bug.description}`,
      ``,
      `Worked instance:`,
      `  problem: ${ex.problem}`,
      `  the child's answer: ${ex.robotAnswer}`,
      `  the correct answer: ${ex.correctAnswer}`,
      ``,
      `In at most 600 characters, cover what was seen, why this error is common at`,
      `this age, and that it is a consistent rule rather than carelessness.`,
      `You must include both ${ex.robotAnswer} and ${ex.correctAnswer}.`,
    ].join("\n"),
  };
}

/** Everything a prompt is permitted to contain, for the privacy test. */
export function allowedPromptContent(bugId: string, ex: Counterexample): string[] {
  const bug = bugById(bugId);
  return [bug.childLabel, bug.label, bug.description, ex.problem, ex.robotAnswer, ex.correctAnswer];
}
