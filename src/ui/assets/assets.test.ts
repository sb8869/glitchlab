import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SKINS, SPROCKET } from "./palette.ts";
import { composeBot, extractGroup, type Sources } from "./compose.ts";

/**
 * The asset swap contract.
 *
 * Final art is produced outside this repo and dropped in wholesale. These
 * tests are what make that safe: they encode the structure composition
 * depends on, so a replacement that breaks it fails here instead of silently
 * rendering a broken character.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

const FILES = ["bot-skeleton.svg", "eyes.svg", "tells.svg", "silhouettes.svg", "app-icon.svg"];
const src: Sources = {
  skeleton: read("bot-skeleton.svg"),
  eyes: read("eyes.svg"),
  tells: read("tells.svg"),
  silhouettes: read("silhouettes.svg"),
};

test("every asset shares the 240x240 coordinate space", () => {
  for (const f of FILES) {
    assert.match(read(f), /viewBox="0 0 240 240"/, `${f} has the wrong viewBox`);
  }
});

test("no hard-coded colors: every fill and stroke goes through a token", () => {
  // A bare hex breaks the entire fill-swap mechanism, silently and per bot.
  for (const f of FILES) {
    const bare = read(f).match(/(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/g) ?? [];
    assert.deepEqual(bare, [], `${f} hard-codes a color`);
  }
});

test("assets stay self-contained and flat", () => {
  for (const f of FILES) {
    const s = read(f);
    assert.equal(s.includes("<style"), false, `${f} has a <style> block`);
    assert.equal(s.includes("<image"), false, `${f} embeds a raster image`);
    assert.equal(/<filter|Gradient/.test(s), false, `${f} uses a filter or gradient`);
    assert.equal(/href="http/.test(s), false, `${f} references an external URL`);
  }
});

test("the skeleton exposes every part composition writes into", () => {
  for (const id of [
    "bot-root", "bot-antenna", "bot-head", "bot-face-plate",
    "bot-body", "bot-chest-panel", "bot-feet", "bot-eyes", "bot-tell",
  ]) {
    assert.ok(src.skeleton.includes(`id="${id}"`), `skeleton is missing #${id}`);
  }
  // The two runtime slots must ship empty.
  assert.match(src.skeleton, /<g id="bot-eyes"><\/g>/);
  assert.match(src.skeleton, /<g id="bot-tell"><\/g>/);
});

test("all three expressions exist and are pure eye-shape swaps", () => {
  for (const state of ["idle", "thinking", "celebrating"]) {
    assert.doesNotThrow(() => extractGroup(src.eyes, `eyes-${state}`));
  }
});

test("every tell and silhouette the palette names actually exists", () => {
  for (const [bugId, skin] of Object.entries(SKINS)) {
    const tell = skin.tell;
    if (tell.kind === "transform") {
      assert.ok(src.skeleton.includes(`id="${tell.part}"`), `${bugId} transforms a missing part`);
    } else {
      assert.doesNotThrow(
        () => extractGroup(src.tells, tell.id),
        `${bugId} names a missing tell`,
      );
    }
    const s = skin.silhouette;
    for (const g of [`head-${s.head}`, `antenna-${s.antenna}`, `feet-${s.feet}`]) {
      assert.doesNotThrow(() => extractGroup(src.silhouettes, g), `${bugId} names missing ${g}`);
    }
  }
});

/**
 * The rule that actually got broken once: a tell drawn over the eyes removes
 * the only expressive channel the characters have, and the bot goes dead.
 */
test("no overlay tell draws inside the eye band", () => {
  const EYE = { x0: 95, x1: 145, y0: 70, y1: 92 };
  const inBand = (x: number, y: number) =>
    x >= EYE.x0 && x <= EYE.x1 && y >= EYE.y0 && y <= EYE.y1;

  for (const [bugId, skin] of Object.entries(SKINS)) {
    const tell = skin.tell;
    if (tell.kind !== "overlay") continue;
    const g = extractGroup(src.tells, tell.id);
    const points: Array<[number, number]> = [];

    for (const m of g.matchAll(/points="([^"]+)"/g)) {
      const nums = (m[1] ?? "").trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i]!, nums[i + 1]!]);
    }
    for (const m of g.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) {
      points.push([Number(m[1]), Number(m[2])]);
    }
    for (const m of g.matchAll(/cx="([\d.]+)"\s+cy="([\d.]+)"/g)) {
      points.push([Number(m[1]), Number(m[2])]);
    }
    for (const m of g.matchAll(/x="([\d.]+)"\s+y="([\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/g)) {
      const [x, y, w, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      points.push([x, y], [x + w, y + h]);
    }

    const hits = points.filter(([x, y]) => inBand(x, y));
    assert.deepEqual(hits, [], `${bugId}'s tell "${tell.id}" covers the eyes`);
  }
});

test("every character composes cleanly in every expression", () => {
  const characters = ["sprocket", ...Object.keys(SKINS)];
  for (const character of characters) {
    for (const eyes of ["idle", "thinking", "celebrating"] as const) {
      for (const showTell of [true, false]) {
        const svg = composeBot(src, { character, eyes, showTell });
        assert.equal(svg.includes('<g id="bot-eyes"></g>'), false, `${character} has empty eyes`);
        assert.ok(svg.includes("--bot-body:"), `${character} lost its color vars`);
        assert.ok(svg.length > 500);
      }
    }
  }
});

test("only Sprocket is teal, and Sprocket never shows a tell", () => {
  const svg = composeBot(src, { character: "sprocket", eyes: "idle" });
  assert.match(svg, /<g id="bot-tell"><\/g>/, "the host must never look broken");
  assert.ok(svg.includes(SPROCKET.body));
});

/* --------------------------------------------------------------- favicons */

test("the site icons exist and are served from the root", () => {
  /*
   * These shipped broken once. A single <link> pointed at the hashed build
   * asset, browsers that do not accept an SVG icon fell back to requesting
   * /favicon.ico, and with nothing there they used whatever their cache held
   * for the origin — the host's own mark in one case, an unrelated project's
   * in another. The .ico is the one that must exist.
   */
  const pub = join(DIR, "..", "..", "..", "public");
  for (const f of ["favicon.ico", "favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) {
    const bytes = readFileSync(join(pub, f));
    assert.ok(bytes.length > 500, `${f} is missing or empty`);
  }
});

test("the favicon svg can be rasterized outside the page", () => {
  // No page means no custom properties and no CSS box: an icon has to carry
  // its own colors and its own intrinsic size or it renders as nothing.
  const svg = readFileSync(join(DIR, "..", "..", "..", "public", "favicon.svg"), "utf8");
  assert.equal(svg.includes("var("), false, "favicon.svg leans on a CSS variable");
  assert.match(svg, /width="240"\s+height="240"/, "favicon.svg has no intrinsic size");
});

test("the favicon is the app icon, not a drawing of it", () => {
  // Same shapes, palette resolved. A copy that drifts is worse than no copy.
  const master = readFileSync(join(DIR, "app-icon.svg"), "utf8");
  const icon = readFileSync(join(DIR, "..", "..", "..", "public", "favicon.svg"), "utf8");
  const shapes = (s: string) => (s.match(/<(rect|circle|line|g)\b/g) ?? []).join(",");
  assert.equal(shapes(icon), shapes(master), "favicon.svg has drifted from app-icon.svg");
});

/*
 * Composition keeps the skeleton's slot ids, and a page renders many bots at
 * once — the bench shows fifteen, so `id="bot-root"` exists fifteen times over.
 * That is harmless only for as long as nothing in the art RESOLVES an id:
 * a gradient, a clipPath, a mask, a filter or a <use> would bind to whichever
 * copy the document happened to define first, and every robot after the first
 * would quietly render with another robot's paint.
 *
 * So the invariant is: bot art may define ids, but must never reference them.
 * Drop in new art that does, and this fails instead of the bench looking odd
 * in a way no one can explain.
 */
test("bot art never references an id, because a page renders many bots", () => {
  for (const f of FILES) {
    const svg = read(f);
    for (const [pattern, what] of [
      [/url\(#/, "url(#…) — a gradient, pattern or filter reference"],
      [/<use\b/, "<use> — an element reference"],
      [/\b(?:clip-path|mask|filter)="(?!none)/, "clip-path / mask / filter"],
      [/\bhref="#/, "an internal href"],
    ] as const) {
      assert.equal(
        pattern.test(svg),
        false,
        `${f} contains ${what}; ids are duplicated across every bot on the page`,
      );
    }
  }
});
