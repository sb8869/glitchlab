import test from "node:test";
import assert from "node:assert/strict";

import { BANK } from "../bugs/bank.ts";
import { BUGS, bugById, predict } from "../bugs/library.ts";
import { correct } from "../bugs/procedures.ts";
import { mulberry32 } from "../engine/session.ts";
import { bestRetestItem, discriminatingItems, interleave } from "./schedule.ts";

/* ----------------------------------------------------------- item choice */

test("every bug has at least one item that can retest it", () => {
  for (const bug of BUGS) {
    assert.ok(discriminatingItems(bug.id).length > 0, `${bug.id} is unretestable`);
    assert.ok(bestRetestItem(bug.id) !== null);
  }
});

test("a retest item is always one where the bug is actually live", () => {
  // An item the bug does not fire on would be answered correctly by a child
  // who still has it, so the retest would pass for the wrong reason.
  for (const bug of BUGS) {
    const item = bestRetestItem(bug.id)!;
    assert.equal(bugById(bug.id).applies(item), true);
    assert.notEqual(predict(bug.id, item), correct(item));
  }
});

test("the retest item chosen is the least ambiguous available", () => {
  const ambiguity = (bugId: string, itemId: string) => {
    const item = BANK.find((i) => i.id === itemId)!;
    const mine = predict(bugId, item);
    return BUGS.filter((b) => b.id !== bugId && predict(b.id, item) === mine).length;
  };
  for (const bug of BUGS) {
    const chosen = bestRetestItem(bug.id)!;
    const best = Math.min(...discriminatingItems(bug.id).map((i) => ambiguity(bug.id, i.id)));
    assert.equal(ambiguity(bug.id, chosen.id), best, `${bug.id} got an ambiguous retest`);
  }
});

test("recently used items can be excluded, and exhaustion is reported", () => {
  const bugId = "sub_smaller_from_larger";
  const first = bestRetestItem(bugId)!;
  const second = bestRetestItem(bugId, BANK, new Set([first.id]))!;
  assert.notEqual(second.id, first.id);

  const all = new Set(discriminatingItems(bugId).map((i) => i.id));
  assert.equal(bestRetestItem(bugId, BANK, all), null);
});

/* ------------------------------------------------------------ interleaving */

test("a retest never lands first — the probe must not announce itself", () => {
  const fresh = ["a", "b", "c", "d", "e", "f"];
  for (let seed = 0; seed < 300; seed++) {
    const out = interleave(fresh, ["R1", "R2"], mulberry32(seed));
    assert.notEqual(out[0], "R1");
    assert.notEqual(out[0], "R2");
    assert.equal(out[0], "a", "the session still opens on new material");
  }
});

test("interleaving preserves every item exactly once", () => {
  const fresh = ["a", "b", "c", "d", "e"];
  const retests = ["R1", "R2", "R3"];
  for (let seed = 0; seed < 100; seed++) {
    const out = interleave(fresh, retests, mulberry32(seed));
    assert.equal(out.length, fresh.length + retests.length);
    assert.deepEqual([...out].sort(), [...fresh, ...retests].sort());
  }
});

test("retests are kept apart from each other when there is room", () => {
  // Clustering them would recreate the block of review the interleaving is
  // meant to avoid.
  const fresh = ["a", "b", "c", "d", "e", "f", "g", "h"];
  let adjacent = 0;
  const trials = 300;
  for (let seed = 0; seed < trials; seed++) {
    const out = interleave(fresh, ["R1", "R2"], mulberry32(seed));
    const i = out.indexOf("R1");
    const j = out.indexOf("R2");
    if (Math.abs(i - j) <= 1) adjacent++;
  }
  assert.ok(adjacent / trials < 0.1, `retests clustered in ${adjacent}/${trials} runs`);
});

test("interleaving is deterministic for a given seed", () => {
  const a = interleave(["a", "b", "c"], ["R"], mulberry32(42));
  const b = interleave(["a", "b", "c"], ["R"], mulberry32(42));
  assert.deepEqual(a, b);
});

test("no retests means the session is untouched", () => {
  const fresh = ["a", "b", "c"];
  assert.deepEqual(interleave(fresh, [], mulberry32(1)), fresh);
});

test("a retest still places safely when there is almost no new material", () => {
  const out = interleave(["a"], ["R"], mulberry32(7));
  assert.deepEqual(out, ["a", "R"]);
});
