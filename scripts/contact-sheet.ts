/**
 * Renders every character in every expression to one HTML contact sheet, so
 * the whole cast can be eyeballed at once and compared against replacement
 * art. Open out/contact-sheet.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BUGS } from "../src/bugs/library.ts";
import { composeBot, type Sources } from "../src/ui/assets/compose.ts";
import { SKINS, skinFor } from "../src/ui/assets/palette.ts";
import type { EyeState } from "../src/ui/assets/palette.ts";

const dir = "src/ui/assets";
const src: Sources = {
  skeleton: readFileSync(`${dir}/bot-skeleton.svg`, "utf8"),
  eyes: readFileSync(`${dir}/eyes.svg`, "utf8"),
  tells: readFileSync(`${dir}/tells.svg`, "utf8"),
  silhouettes: readFileSync(`${dir}/silhouettes.svg`, "utf8"),
};

const states: EyeState[] = ["idle", "thinking", "celebrating"];
const cell = (label: string, sub: string, svg: string) =>
  `<figure><div class="art">${svg}</div><figcaption><b>${label}</b><span>${sub}</span></figcaption></figure>`;

const host = states
  .map((e) => cell("Sprocket", e, composeBot(src, { character: "sprocket", eyes: e, size: 150 })))
  .join("");

const patients = BUGS.map((b) => {
  const s = skinFor(b.id);
  const broken = composeBot(src, { character: b.id, eyes: "idle", size: 150 });
  const fixed = composeBot(src, { character: b.id, eyes: "celebrating", showTell: false, size: 150 });
  return cell(s.name, "glitching", broken) + cell(s.name, "repaired", fixed);
}).join("");

mkdirSync("out", { recursive: true });
writeFileSync(
  "out/contact-sheet.html",
  `<!doctype html><meta charset="utf-8"><title>Glitch Lab cast</title>
<style>
 body{font:14px system-ui,sans-serif;background:#f7fafb;color:#14343f;margin:0;padding:28px}
 h2{margin:26px 0 10px;font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:#5b7683}
 .grid{display:flex;flex-wrap:wrap;gap:12px}
 figure{margin:0;background:#fff;border:1px solid #dde7ea;border-radius:14px;padding:10px 10px 8px;text-align:center;width:170px}
 .art{height:150px;display:flex;align-items:center;justify-content:center}
 figcaption{display:flex;flex-direction:column;gap:1px;font-size:12px;margin-top:4px}
 figcaption span{color:#7a929d;font-size:11px}
</style>
<h2>Sprocket — host, three expressions, never broken</h2><div class="grid">${host}</div>
<h2>Patient bots — ${Object.keys(SKINS).length} misconceptions, glitching and repaired</h2><div class="grid">${patients}</div>`,
);
console.log(`Wrote out/contact-sheet.html (${BUGS.length} patients + host)`);
