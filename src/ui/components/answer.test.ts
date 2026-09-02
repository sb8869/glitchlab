import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../../bugs/library.ts";
import { generateForBug } from "../../bugs/generate.ts";
import { correct } from "../../bugs/procedures.ts";
import { answerReady, answerTrayHead, compareChoices } from "./answer.ts";
import type { Item } from "../../bugs/types.ts";

/*
 * Four of the thirteen robots ask fraction questions, and for a while none of
 * them were playable: the answer box was numeric-only, so "17/24" could not be
 * typed at all. These tests pin the property that made it unplayable — that
 * every answer the engine will accept has to be reachable from the box the
 * child is actually shown.
 */

const everyItem = (): Item[] =>
  BUGS.flatMap((b) => generateForBug(b.id, 4242, 8).concat(generateForBug(b.id, 8686, 8)));

test("every problem a child can be asked has an answer they can enter", () => {
  for (const item of everyItem()) {
    const truth = correct(item);
    if (item.kind === "fracCompare") {
      // Two buttons. If the right answer were not one of them, the item would
      // be unanswerable no matter what the child knows.
      assert.ok(
        compareChoices(item).includes(truth),
        `${item.id}: correct answer ${truth} is not one of the two offered`,
      );
      continue;
    }
    // Everything else is typed, and what they type is compared as a string.
    assert.ok(answerReady(item, truth), `${item.id}: ${truth} does not read as complete`);
  }
});

test("a half-typed fraction is not a submittable answer", () => {
  const frac = everyItem().find((i) => i.kind === "fracAdd");
  assert.ok(frac, "no fraction addition generated");
  assert.equal(answerReady(frac, "3/"), false);
  assert.equal(answerReady(frac, "/4"), false);
  assert.equal(answerReady(frac, "/"), false);
  assert.equal(answerReady(frac, "3/4"), true);
});

test("compare items ask which is bigger, not what the answer is", () => {
  const cmp = everyItem().find((i) => i.kind === "fracCompare");
  const add = everyItem().find((i) => i.kind === "arith");
  assert.ok(cmp && add);
  assert.equal(answerTrayHead(cmp), "WHICH IS BIGGER?");
  assert.equal(answerTrayHead(add), "WHAT IS IT REALLY?");
});

test("the two choices on a compare item are never the same button twice", () => {
  for (const item of everyItem()) {
    if (item.kind !== "fracCompare") continue;
    const [a, b] = compareChoices(item);
    assert.notEqual(a, b, `${item.id}: both choices read ${a}`);
  }
});
