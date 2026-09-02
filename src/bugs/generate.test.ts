import test from "node:test";
import assert from "node:assert/strict";

import { BANK } from "./bank.ts";
import { BUGS, predict } from "./library.ts";
import { correct, fracValue, gcd, lcm, numDigits } from "./procedures.ts";
import { BAND_ORDER, type Band } from "./types.ts";
import { ambiguity, classify, generateForBug, generatePool } from "./generate.ts";

const BANDS: Band[] = [...BAND_ORDER];

test("every band can generate a deep pool of distinct problems", () => {
  // The bank held ten subtraction items and a child sees about twelve in one
  // case, which is what made every retest a rerun.
  for (const band of BANDS) {
    const ids = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      for (const item of generatePool(band, seed, 48).all) ids.add(item.id);
    }
    assert.ok(ids.size > 500, `${band} only reaches ${ids.size} distinct problems`);
  }
});

test("every band still produces real controls and real informative items", () => {
  for (const band of BANDS) {
    const pool = generatePool(band, 3, 48);
    assert.ok(pool.byRole.control.length >= 3, `${band} generated no controls`);
    assert.ok(
      pool.byRole.solve.length + pool.byRole.tie.length >= 5,
      `${band} generated nothing informative`,
    );
  }
});

test("the subtraction band still generates deadlock items", () => {
  // The tie is the clearest thing the engine does; generation must not lose it.
  const pool = generatePool("sub_regroup", 11, 48);
  assert.ok(pool.byRole.tie.length >= 3);
  for (const item of pool.byRole.tie) {
    const live = BUGS.filter((b) => b.applies(item));
    const answers = live.map((b) => predict(b.id, item));
    assert.ok(new Set(answers).size < answers.length, `${item.id} is not actually a tie`);
  }
});

test("a generated control is inert under every bug", () => {
  for (const band of BANDS) {
    for (const item of generatePool(band, 5, 48).byRole.control) {
      for (const bug of BUGS) {
        assert.equal(bug.applies(item), false, `${bug.id} fires on control ${item.id}`);
        assert.equal(predict(bug.id, item), correct(item));
      }
    }
  }
});

test("generated subtraction never goes negative", () => {
  for (let seed = 0; seed < 40; seed++) {
    for (const item of generatePool("sub_regroup", seed, 48).all) {
      if (item.kind === "arith" && item.op === "-") {
        assert.ok(item.a > item.b, `${item.id} would go negative`);
      }
    }
  }
});

test("generated fraction sums have exactly one right answer", () => {
  // If the correct sum reduces, a child writing 1/2 for 2/4 is right and would
  // be marked wrong. The curated bank was built this way and generation has to
  // keep the same promise.
  for (let seed = 0; seed < 40; seed++) {
    for (const item of generatePool("fraction_number", seed, 48).all) {
      if (item.kind === "fracAdd") {
        const L = lcm(item.a.d, item.b.d);
        const n = item.a.n * (L / item.a.d) + item.b.n * (L / item.b.d);
        assert.equal(gcd(n, L), 1, `${item.id} = ${n}/${L} is reducible, so ambiguous`);
        assert.ok(n < L, `${item.id} is not a proper fraction`);
      }
      if (item.kind === "fracCompare") {
        assert.notEqual(fracValue(item.a), fracValue(item.b), `${item.id} has no larger side`);
      }
    }
  }
});

test("generateForBug returns items that bug is actually live on", () => {
  for (const bug of BUGS) {
    const items = generateForBug(bug.id, 17, 6);
    assert.ok(items.length > 0, `${bug.id} got no generated drills`);
    for (const item of items) {
      assert.equal(bug.applies(item), true, `${bug.id} not live on ${item.id}`);
      assert.notEqual(predict(bug.id, item), correct(item));
    }
  }
});

test("generated drills are sharp: the least ambiguous come first", () => {
  for (const bug of BUGS) {
    const items = generateForBug(bug.id, 23, 6);
    const scores = items.map((i) => ambiguity(bug.id, i));
    assert.deepEqual(scores, [...scores].sort((a, b) => a - b), `${bug.id} drills not sorted`);
  }
});

test("generation is reproducible from a seed and varies between seeds", () => {
  const a = generatePool("sub_regroup", 99, 20).all.map((i) => i.id);
  const b = generatePool("sub_regroup", 99, 20).all.map((i) => i.id);
  const c = generatePool("sub_regroup", 100, 20).all.map((i) => i.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("generated items never collide with the evaluation bank", () => {
  // The measured result in scripts/simulate.ts is reported on BANK exactly as
  // it was hand-verified; generated problems must stay distinguishable.
  const bankIds = new Set(BANK.map((i) => i.id));
  for (const band of BANDS) {
    for (const item of generatePool(band, 8, 48).all) {
      assert.equal(bankIds.has(item.id), false);
      assert.ok(item.id.startsWith("g-"));
    }
  }
});

test("classification agrees with the bug library it is derived from", () => {
  for (const band of BANDS) {
    for (const item of generatePool(band, 13, 30).all) {
      const c = classify(item);
      assert.deepEqual(c.live, BUGS.filter((b) => b.applies(item)).map((b) => b.id));
      if (c.role === "control") assert.equal(c.live.length, 0);
      else assert.ok(c.live.length > 0);
    }
  }
});

test("a generated sum never spills into a new place", () => {
  /*
   * "56 + 53, and Bolt says 9" is what forgetting the carry does when the
   * carry is the one out of the leftmost column: it deletes a digit rather
   * than misplacing one, and the answer reads as nonsense instead of as a
   * procedure a child can recognize. Every carry in the pool is internal.
   */
  for (const band of BAND_ORDER) {
    for (const seed of [1, 77, 4242, 8686]) {
      for (const item of generatePool(band, seed, 60).all) {
        if (item.kind !== "arith" || item.op !== "+") continue;
        if (band === "place_value") continue; // unequal lengths are the point there
        assert.equal(
          numDigits(item.a + item.b),
          numDigits(Math.max(item.a, item.b)),
          `${band}/${seed}: ${item.a} + ${item.b} = ${item.a + item.b} gains a place`,
        );
      }
    }
  }
});

test("no addition bug is ever shown writing a shorter answer than the truth", () => {
  for (const bug of BUGS) {
    for (const item of generateForBug(bug.id, 4242, 30).concat(generateForBug(bug.id, 8686, 30))) {
      if (item.kind !== "arith" || item.op !== "+") continue;
      const wrong = predict(bug.id, item);
      assert.ok(
        wrong.length >= correct(item).length,
        `${bug.id}: ${item.a} + ${item.b} -> ${wrong}, shorter than ${correct(item)}`,
      );
    }
  }
});
