import test from "node:test";
import assert from "node:assert/strict";

import { BANK } from "./bank.ts";
import { CONTROLS, controlsForBand } from "./controls.ts";
import { BUGS, predict } from "./library.ts";
import { correct } from "./procedures.ts";
import { BAND_ORDER } from "./types.ts";

test("every control is genuinely inert — no bug fires on it", () => {
  // A control that quietly discriminated would be a lie told to the child,
  // and would silently become evidence in the posterior.
  for (const item of CONTROLS) {
    const live = BUGS.filter((b) => b.applies(item));
    assert.deepEqual(
      live.map((b) => b.id),
      [],
      `${item.id} is not a control: ${live.map((b) => b.id).join(", ")} fire on it`,
    );
    for (const bug of BUGS) {
      assert.equal(predict(bug.id, item), correct(item), `${bug.id} deviates on ${item.id}`);
    }
  }
});

test("every band has several controls, so the dud is not always the same", () => {
  for (const band of BAND_ORDER) {
    assert.ok(controlsForBand(band).length >= 3, `${band} has too few controls`);
  }
});

test("controls stay out of the probe bank, so the evaluation is unchanged", () => {
  // Padding the bank with duds would make random selection look worse and
  // flatter the headline result without the method improving.
  const bankIds = new Set(BANK.map((i) => i.id));
  for (const c of CONTROLS) assert.equal(bankIds.has(c.id), false, `${c.id} leaked into BANK`);
});

test("control ids cannot collide with bank ids", () => {
  const ids = new Set([...BANK.map((i) => i.id), ...CONTROLS.map((i) => i.id)]);
  assert.equal(ids.size, BANK.length + CONTROLS.length);
});
