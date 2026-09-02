/**
 * The answer *shape* for an item, kept apart from the component that draws it
 * so it can be tested under node --test, which does not parse JSX.
 */

import type { Item } from "../../bugs/types.ts";
import { fracStr } from "../../bugs/procedures.ts";

/**
 * The choices a compare item offers. The correct answer is always one of the
 * two operands, so two buttons is a complete answer space, not a shortcut.
 */
export function compareChoices(item: Item): string[] {
  return item.kind === "fracCompare" ? [fracStr(item.a), fracStr(item.b)] : [];
}

/** A complete answer for this item — "3/" is not one. */
export function answerReady(item: Item | null | undefined, value: string): boolean {
  if (!item) return value.trim().length > 0;
  if (item.kind === "fracAdd") {
    const [n = "", d = ""] = value.split("/");
    return n.trim().length > 0 && d.trim().length > 0;
  }
  return value.trim().length > 0;
}

/** What to call the thing being asked for, per item kind. */
export function answerPrompt(item: Item | null | undefined): string {
  return item?.kind === "fracCompare" ? "Which one is really bigger?" : "What should it really be?";
}

/**
 * How to state the truth about an item. "3/12 vs 5/8 is 5/8" is not a
 * sentence; a compare item's answer is a choice, not a value.
 */
export function answerStatement(item: Item | null | undefined, label: string, answer: string): string {
  return item?.kind === "fracCompare" ? `${answer} is the bigger one` : `${label} is ${answer}`;
}

export function answerTrayHead(item: Item | null | undefined): string {
  return item?.kind === "fracCompare" ? "WHICH IS BIGGER?" : "WHAT IS IT REALLY?";
}
