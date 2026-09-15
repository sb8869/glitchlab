/**
 * Character composition.
 *
 * Pure string assembly, no DOM and no file IO, so it runs in tests, in the
 * contact-sheet script and in the browser unchanged. The UI feeds it the
 * four SVG sources via Vite's `?raw` imports.
 */

import { SHARED, SPROCKET, skinFor, type EyeState, type Silhouette, type Tell } from "./palette.ts";

export type Sources = { skeleton: string; eyes: string; tells: string; silhouettes: string };

/** [index just past the opening tag, index of the matching </g>] for <g id="ID">. */
function groupSpan(svg: string, id: string): [number, number] {
  const open = svg.indexOf(`<g id="${id}"`);
  if (open < 0) throw new Error(`group #${id} not found`);
  let i = svg.indexOf(">", open) + 1;
  const start = i;
  let depth = 1;
  while (depth > 0) {
    const nextOpen = svg.indexOf("<g", i);
    const nextClose = svg.indexOf("</g>", i);
    if (nextClose < 0) throw new Error(`group #${id} is unbalanced`);
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 2;
    } else {
      depth--;
      if (depth === 0) return [start, nextClose];
      i = nextClose + 4;
    }
  }
  throw new Error(`group #${id} is unbalanced`);
}

/** Extract <g id="ID"> ... </g> with balanced nesting. */
export function extractGroup(svg: string, id: string): string {
  const [start, end] = groupSpan(svg, id);
  return svg.slice(start, end);
}

/** Replace the contents of <g id="ID"> in `svg`, keeping the opening tag intact. */
function fillGroup(svg: string, id: string, content: string): string {
  const [start, end] = groupSpan(svg, id);
  return svg.slice(0, start) + content + svg.slice(end);
}

function styleAttr(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export type ComposeOptions = {
  /** A bug id for a patient bot, or "sprocket" for the host. */
  character: string;
  eyes?: EyeState;
  /** Patients show their tell by default; suppress it once the bug is repaired. */
  showTell?: boolean;
  size?: number;
};

export function composeBot(src: Sources, opts: ComposeOptions): string {
  const { character, eyes = "idle", showTell = true, size = 240 } = opts;
  const isHost = character === "sprocket";
  const skin = isHost ? null : skinFor(character);

  const vars: Record<string, string> = {
    "--bot-body": isHost ? SPROCKET.body : skin!.body,
    "--bot-accent": isHost ? SPROCKET.accent : skin!.accent,
    "--bot-face": SHARED.face,
    "--bot-outline": SHARED.outline,
    "--bot-eye": SHARED.eye,
    "--bot-glitch": SHARED.glitch,
  };

  const tell: Tell | null = isHost || !showTell ? null : skin!.tell;
  const sil: Silhouette = isHost ? SPROCKET.silhouette : skin!.silhouette;

  // Eye group: a tell of kind "eyes" overrides the expression.
  const eyeGroupId = tell?.kind === "eyes" ? tell.id : `eyes-${eyes}`;
  const eyeSource = tell?.kind === "eyes" ? src.tells : src.eyes;
  const eyeContent = extractGroup(eyeSource, eyeGroupId);

  const tellContent =
    tell?.kind === "overlay" ? extractGroup(src.tells, tell.id) : "";

  let out = src.skeleton.replace(/<!--[\s\S]*?-->/g, "");

  // Silhouette: swap slot contents, never anchors.
  out = fillGroup(out, "bot-head", extractGroup(src.silhouettes, `head-${sil.head}`));
  out = fillGroup(out, "bot-antenna", extractGroup(src.silhouettes, `antenna-${sil.antenna}`));
  out = fillGroup(out, "bot-feet", extractGroup(src.silhouettes, `feet-${sil.feet}`));

  out = fillGroup(out, "bot-eyes", eyeContent);
  out = fillGroup(out, "bot-tell", tellContent);

  // A "transform" tell is a CSS transform on a named part, not a redraw.
  if (tell?.kind === "transform") {
    out = out.replace(
      `<g id="${tell.part}" style="`,
      `<g id="${tell.part}" style="transform:${tell.value};`,
    );
  }

  return out.replace(
    "<svg ",
    `<svg width="${size}" height="${size}" style="${styleAttr(vars)}" `,
  );
}
