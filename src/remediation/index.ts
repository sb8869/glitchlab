export * from "./types.ts";
export * from "./example.ts";
export * from "./validate.ts";
export * from "./fallback.ts";

import { fallbackFor } from "./fallback.ts";
import type { Remediation } from "./types.ts";

/**
 * The remediation for a bug.
 *
 * There is one source and it is this app: the sentences are assembled from
 * the bug's own description and the counterexample the engine computed, then
 * held to the validator before they reach a child. Nothing here calls out to
 * a service, so remediation works offline, costs nothing, and cannot say a
 * thing about arithmetic that the engine has not already checked.
 */
export function remediationFor(bugId: string): Remediation {
  return fallbackFor(bugId);
}
