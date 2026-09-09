import { useMemo } from "react";

import skeleton from "../assets/bot-skeleton.svg?raw";
import eyesSrc from "../assets/eyes.svg?raw";
import tellsSrc from "../assets/tells.svg?raw";
import silhouettesSrc from "../assets/silhouettes.svg?raw";
import { composeBot, type Sources } from "../assets/compose.ts";
import type { EyeState } from "../assets/palette.ts";

const SOURCES: Sources = {
  skeleton,
  eyes: eyesSrc,
  tells: tellsSrc,
  silhouettes: silhouettesSrc,
};

/**
 * Class hooks for the idle animation, added after composition.
 *
 * By class and never by id: composition keeps the skeleton's slot ids, and a
 * page renders up to fifteen bots, so `#bot-antenna` in a stylesheet would
 * match every one of them. That is the hazard assets.test.ts exists to keep
 * out of the art, and it applies just as much to the stylesheet.
 *
 * The antenna is skipped for a character wearing the bent-antenna tell, which
 * is itself an inline transform on that same group: animating the property
 * would straighten the bend and quietly erase the robot's tell.
 */
function withIdleHooks(svg: string): string {
  const bent = svg.includes('<g id="bot-antenna" style="transform:');
  const out = svg
    .replace('<g id="bot-eyes"', '<g id="bot-eyes" class="p-eyes"')
    .replace('<g id="bot-tell"', '<g id="bot-tell" class="p-tell"');
  return bent ? out : out.replace('<g id="bot-antenna"', '<g id="bot-antenna" class="p-ant"');
}

/**
 * A per-character offset, used as a NEGATIVE animation delay so each robot
 * starts partway through its cycle. Thirteen bots on a bench blinking in
 * lockstep reads as a screensaver; out of step it reads as a room full of
 * machines.
 */
function phase(character: string): number {
  let h = 0;
  for (let i = 0; i < character.length; i++) h = (Math.imul(h, 31) + character.charCodeAt(i)) | 0;
  return Math.abs(h) % 2400;
}

export function Bot({
  character,
  eyes = "idle",
  showTell = true,
  size = 200,
}: {
  character: string;
  eyes?: EyeState;
  showTell?: boolean;
  size?: number;
}) {
  const svg = useMemo(
    () => withIdleHooks(composeBot(SOURCES, { character, eyes, showTell, size })),
    [character, eyes, showTell, size],
  );
  return (
    <span
      className="bot"
      style={{ ["--phase" as string]: `-${phase(character)}ms` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** The host. Never broken, and deliberately has no sad expression to pass. */
export function Sprocket({ eyes = "idle", size = 62 }: { eyes?: EyeState; size?: number }) {
  return <Bot character="sprocket" eyes={eyes} showTell={false} size={size} />;
}
