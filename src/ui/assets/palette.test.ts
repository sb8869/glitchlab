import test from "node:test";
import assert from "node:assert/strict";

import { BUGS } from "../../bugs/library.ts";
import { SKINS, SPROCKET, cssVarsFor, skinFor } from "./palette.ts";

test("every bug in the library has a patient bot", () => {
  const missing = BUGS.filter((b) => !SKINS[b.id]).map((b) => b.id);
  assert.deepEqual(missing, [], "cast has fallen out of sync with the engine");
});

test("no skins for bugs that do not exist", () => {
  const ids = new Set(BUGS.map((b) => b.id));
  const orphans = Object.keys(SKINS).filter((k) => !ids.has(k));
  assert.deepEqual(orphans, []);
});

test("every bot is visually distinct and none of them is Sprocket teal", () => {
  const bodies = Object.values(SKINS).map((s) => s.body);
  assert.equal(new Set(bodies).size, bodies.length, "two bots share a body color");
  assert.ok(!bodies.includes(SPROCKET.body), "teal is reserved for the host");
  const names = Object.values(SKINS).map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
});

test("bots sharing a glitch tell never also share a color family", () => {
  // Two bots may reuse a tell, but then color has to carry the difference.
  const byTell = new Map<string, string[]>();
  for (const [id, s] of Object.entries(SKINS)) {
    const key = s.tell.kind === "transform" ? `t:${s.tell.part}` : `${s.tell.kind}:${s.tell.id}`;
    byTell.set(key, [...(byTell.get(key) ?? []), id]);
  }
  for (const [tell, ids] of byTell) {
    const bodies = ids.map((i) => skinFor(i).body);
    assert.equal(new Set(bodies).size, bodies.length, `${tell} reused without color separation`);
  }
});

test("css vars cover every token the skeleton references", () => {
  const vars = cssVarsFor("sub_smaller_from_larger");
  for (const token of ["--bot-body", "--bot-accent", "--bot-face", "--bot-outline", "--bot-eye", "--bot-glitch"]) {
    assert.ok(vars[token]?.startsWith("#"), `${token} missing`);
  }
});
