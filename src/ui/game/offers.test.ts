import test from "node:test";
import assert from "node:assert/strict";

import { itemLabel } from "../../bugs/procedures.ts";
import { generatePool } from "../../bugs/generate.ts";
import { gainOf, offerTests, runTest, startGame, suspectCount } from "./session.ts";

const RIVET = "sub_smaller_from_larger";
const openers = (seed: number) =>
  offerTests(startGame(RIVET, seed)).map((i) => itemLabel(i)).sort().join(" | ");

test("the same visit always offers the same tests", () => {
  // Offers must not reshuffle on re-render while the child is deciding.
  const g = startGame(RIVET, 42);
  assert.deepEqual(offerTests(g).map((i) => i.id), offerTests(g).map((i) => i.id));
});

test("different visits are not the same puzzle twice", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) seen.add(openers(seed));
  assert.ok(seen.size >= 40, `only ${seen.size} distinct opening hands`);
});

test("every hand still contains a test that cannot separate anything", () => {
  // The dud is the point: discovering that some questions are worthless is
  // the numeracy work, and it only lands if one is always on the table.
  for (let seed = 0; seed < 40; seed++) {
    const g = startGame(RIVET, seed);
    const gains = offerTests(g).map((i) => gainOf(g, i));
    assert.ok(Math.min(...gains) < 1e-6, `seed ${seed} offered no dud`);
  }
});

test("the strongest option is always the most informative one generated", () => {
  /*
   * This used to assert the best offer always produces the deadlock, which was
   * true only because the hand-built bank had no better question in it.
   * Generation finds items where all four live bugs write DIFFERENT answers
   * (1.32 bits against the bank's best 1.19), and the engine correctly prefers
   * those. The invariant that actually holds is that the hand's best option is
   * the best the pool had to offer.
   */
  for (let seed = 0; seed < 60; seed++) {
    const g = startGame(RIVET, seed);
    const offers = offerTests(g);
    const best = offers.reduce((a, b) => (gainOf(g, a) >= gainOf(g, b) ? a : b));
    const poolBest = Math.max(
      ...generatePool(g.band, g.seed).all.map((i) => gainOf(g, i)),
    );
    assert.ok(
      gainOf(g, best) >= poolBest * 0.95,
      `seed ${seed}: best offer is ${gainOf(g, best).toFixed(3)}, pool had ${poolBest.toFixed(3)}`,
    );
  }
});

test("the best question always splits the suspects hard, one way or the other", () => {
  // Either it deadlocks two suspects or it identifies outright; what it never
  // does is dribble.
  for (let seed = 0; seed < 60; seed++) {
    const g = startGame(RIVET, seed);
    const offers = offerTests(g);
    const best = offers.reduce((a, b) => (gainOf(g, a) >= gainOf(g, b) ? a : b));
    const left = suspectCount(runTest(g, best).posterior);
    assert.ok(left <= 2, `seed ${seed}: best offer left ${left} suspects`);
  }
});

test("the deadlock stays reachable often enough to be the lesson it is meant to be", () => {
  /*
   * Measured, not assumed: about 71% of opening hands deadlock on the best
   * pick for this robot; the rest are resolved outright by a four-way split.
   * The floor guards against a change that quietly makes the board's sharpest
   * moment rare. It is deliberately not 100% — forcing it would mean choosing
   * offers using the robot's actual bug, which the game is about not doing.
   */
  let deadlocks = 0;
  const N = 300;
  for (let seed = 0; seed < N; seed++) {
    const g = startGame(RIVET, seed);
    const offers = offerTests(g);
    const best = offers.reduce((a, b) => (gainOf(g, a) >= gainOf(g, b) ? a : b));
    if (suspectCount(runTest(g, best).posterior) === 2) deadlocks++;
  }
  assert.ok(deadlocks / N > 0.6, `only ${((100 * deadlocks) / N).toFixed(0)}% deadlocked`);
});

test("offers never repeat a test already run", () => {
  let g = startGame(RIVET, 7);
  for (let round = 0; round < 4; round++) {
    const offers = offerTests(g);
    for (const o of offers) assert.ok(!g.askedIds.includes(o.id), "re-offered a used test");
    if (offers[0]) g = runTest(g, offers[0]);
  }
});

test("three tests are offered while the bank can supply them", () => {
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(offerTests(startGame(RIVET, seed)).length, 3);
  }
});

test("the dud varies too — no single problem shows up in every hand", () => {
  // This is the bug ten real playthroughs caught: the informative slots were
  // varying while the uninformative one appeared in 100% of hands, because the
  // bank holds exactly one inert item per band.
  const seen = new Map<string, number>();
  const N = 300;
  for (let seed = 0; seed < N; seed++) {
    const g = startGame(RIVET, seed);
    for (const item of offerTests(g)) {
      seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
    }
  }
  const worst = Math.max(...seen.values());
  assert.ok(
    worst / N < 0.1,
    `one item appears in ${((100 * worst) / N).toFixed(0)}% of hands`,
  );
});

test("a control can be offered, and running it teaches the intended lesson", () => {
  // Zero information is the point: the child should be able to spend a turn
  // on a question that cannot possibly separate anything.
  const g = startGame(RIVET, 5);
  const control = offerTests(g).find((i) => gainOf(g, i) < 1e-6);
  if (!control) return; // seed happened to draw the bank's own dud
  assert.ok(gainOf(g, control) < 1e-6, "a control must carry no information");
  const after = runTest(g, control);
  assert.equal(
    suspectCount(after.posterior),
    suspectCount(g.posterior),
    "a control must not change the board",
  );
});
