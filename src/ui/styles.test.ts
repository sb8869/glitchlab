import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The stylesheet contract.
 *
 * One stylesheet, no CSS modules, no scoping — which is a fine choice for a
 * project this size and a sharp edge at the same time. Three times in one
 * afternoon a short class name was reused for something unrelated and quietly
 * restyled it:
 *
 *   .pick   the fraction picker's row layout, reused for a tappable suspect
 *           card, which laid the card out as a flex row and shrank its
 *           probability meter from a 105px bar to a 4px stub.
 *   .mute   the bench's tone for the locked shelf, reused for the sound
 *           toggle, which restyled a whole <section> into a 34px square.
 *   .stamp  the ruled-out pile's rubber stamp, nearly reused for two other
 *           stamps before the existing name was noticed.
 *
 * None of them threw, none of them failed a test, and two of them were found
 * by looking at a screenshot. So the rule is enforced here instead: a class
 * styled by a BARE selector is global, and a global name may only be applied
 * in more than one component if it is deliberately shared.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(DIR, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return entry.endsWith(".tsx") ? [full] : [];
  });
}
const FILES = tsxFiles(DIR);

/** Every class name that appears anywhere in a selector. */
function styledClasses(): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = m[1]!.trim();
    if (sel.startsWith("@") || /^\d/.test(sel)) continue;
    for (const c of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(c[1]!);
  }
  return out;
}

/**
 * Classes whose LAST compound is the class alone — `.foo`, `.foo:hover`,
 * `.bar .foo`. These match anywhere in the document, so the name is global.
 * `.card .foo` is still global for `.foo`; `.foo.bar` and `div.foo` are not.
 */
function globalClasses(): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const head = m[1]!.trim();
    if (head.startsWith("@") || /^\d/.test(head)) continue;
    for (const sel of head.split(",")) {
      const last = sel.trim().split(/[\s>+~]+/).pop() ?? "";
      const core = last.replace(/(::?[a-zA-Z-]+(\([^)]*\))?|\[[^\]]*\])/g, "");
      const solo = core.match(/^\.([A-Za-z][\w-]*)$/);
      if (solo) out.add(solo[1]!);
    }
  }
  return out;
}

/** Class names a component actually puts on an element. */
function appliedClasses(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const file of FILES) {
    const src = readFileSync(file, "utf8");
    const names = new Set<string>();
    // className={...} — take the balanced expression, then every string in it.
    for (const m of src.matchAll(/className=/g)) {
      let i = m.index! + "className=".length;
      let expr = "";
      if (src[i] === "{") {
        let depth = 0;
        for (; i < src.length; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}" && --depth === 0) { expr += "}"; break; }
          expr += src[i];
        }
      } else if (src[i] === '"') {
        const end = src.indexOf('"', i + 1);
        expr = src.slice(i, end + 1);
      }
      /*
       * Two passes, because the conditional half of a class list lives inside
       * the interpolations of a template literal:
       *
       *   className={`icard${lead ? " lead" : ""}${open ? " open" : ""}`}
       *
       * The first pass takes the literal head ("icard") by blanking the
       * interpolations; the second sweeps the whole expression for quoted
       * strings, which is where " lead" and " open" actually are. Inside a
       * className expression every quoted string is a class list.
       */
      const chunks: string[] = [];
      for (const lit of expr.matchAll(/`([^`]*)`/g)) chunks.push(lit[1]!.replace(/\$\{[^{}]*\}/g, " "));
      // `phase === "reopen" ? " solo" : ""` names a class and compares against
      // a value that is not one. Drop the right-hand side of comparisons.
      const tested = expr.replace(/[=!]==?\s*("[^"]*"|'[^']*')/g, " ");
      for (const lit of tested.matchAll(/"([^"]*)"|'([^']*)'/g)) chunks.push(lit[1] ?? lit[2] ?? "");
      for (const raw of chunks) {
        for (const word of raw.split(/\s+/)) if (/^[A-Za-z][\w-]*$/.test(word)) names.add(word);
      }
    }
    // `tone="warn"` and friends become class names at the other end.
    for (const m of src.matchAll(/\btone="([A-Za-z][\w-]*)"/g)) names.add(m[1]!);
    for (const n of names) {
      if (!out.has(n)) out.set(n, new Set());
      out.get(n)!.add(relative(DIR, file));
    }
  }
  return out;
}

/**
 * Global names that more than one component is allowed to apply: the shared
 * vocabulary of the design — a button is a button on every screen. Adding a
 * name here is a deliberate act, which is the whole point.
 */
const SHARED = new Set([
  "answer-tray", "app", "aside", "bad", "bench", "bench-wrap", "bot", "btn",
  "bubble", "chip", "chips", "line", "log-sub", "nameplate", "panel",
  "parent-note", "patient", "pn-head", "practice", "quiet", "say", "spotlight",
  "stage", "status", "teach", "tray", "tray-head",
]);

test("a class applied by a component is styled by the stylesheet", () => {
  const styled = styledClasses();
  const orphans = [...appliedClasses()]
    .filter(([name]) => !styled.has(name))
    .map(([name, files]) => `.${name} (in ${[...files].join(", ")})`);
  assert.deepEqual(orphans, [], "class names with no rule — a typo, or a rule that was renamed");
});

test("a class styled by the stylesheet is applied by some component", () => {
  const applied = appliedClasses();
  const dead = [...styledClasses()].filter((c) => !applied.has(c)).sort();
  assert.deepEqual(dead, [], "styles nothing renders — delete them or the next reader will trust them");
});

test("a global class name is not quietly shared by unrelated components", () => {
  const global = globalClasses();
  const clashes = [...appliedClasses()]
    .filter(([name, files]) => global.has(name) && files.size > 1 && !SHARED.has(name))
    .map(([name, files]) => `.${name} applied in ${[...files].sort().join(" + ")}`)
    .sort();
  assert.deepEqual(
    clashes,
    [],
    "two components share a global class name: rename one, or add it to SHARED if it is genuinely one thing",
  );
});
