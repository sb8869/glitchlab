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
    () => composeBot(SOURCES, { character, eyes, showTell, size }),
    [character, eyes, showTell, size],
  );
  return <span className="bot" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The host. Never broken, and deliberately has no sad expression to pass. */
export function Sprocket({ eyes = "idle", size = 62 }: { eyes?: EyeState; size?: number }) {
  return <Bot character="sprocket" eyes={eyes} showTell={false} size={size} />;
}
