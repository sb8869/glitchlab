import test from "node:test";
import assert from "node:assert/strict";

import { itemLabel } from "../../bugs/procedures.ts";
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
  for (let seed = 0; seed < 40; seed++) seen.add(openers(seed));
  assert.ok(seen.size >= 3, `only ${seen.size} distinct opening hands`);
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

test("the strongest option on the table always preserves the deadlock", () => {
  // The tie is the clearest thing the engine does, and the demo must not
  // depend on luck. For this robot the top-gain tier is exactly the set of
  // tie-producing items, so the best available pick always reaches it.
  for (let seed = 0; seed < 40; seed++) {
    const g = startGame(RIVET, seed);
    const offers = offerTests(g);
    const best = offers.reduce((a, b) => (gainOf(g, a) >= gainOf(g, b) ? a : b));
    assert.equal(
      suspectCount(runTest(g, best).posterior),
      2,
      `seed ${seed}: best offer ${itemLabel(best)} did not produce the tie`,
    );
  }
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
