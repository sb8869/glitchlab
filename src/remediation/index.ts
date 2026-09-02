export * from "./types.ts";
export * from "./example.ts";
export * from "./validate.ts";
export * from "./cost.ts";
export * from "./fallback.ts";

import { GENERATED } from "./generated.ts";
import { fallbackFor } from "./fallback.ts";
import type { Remediation } from "./types.ts";

/**
 * The remediation for a bug: generated copy when it exists and passed
 * validation at generation time, the deterministic version otherwise.
 */
export function remediationFor(bugId: string): Remediation {
  return GENERATED.entries[bugId] ?? fallbackFor(bugId);
}

export function generationCost(): { usd: number | null; generatedAt: string } {
  return { usd: GENERATED.totalUsd, generatedAt: GENERATED.generatedAt };
}
