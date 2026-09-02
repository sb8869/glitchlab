/**
 * Cost instrumentation.
 *
 * Prices are per million tokens, taken from the published Claude pricing page
 * (checked 2026-09-02). A model that is not in this table reports a null cost
 * rather than a guessed one — a made-up number on a screen that says "what
 * this session cost" would be worse than no number.
 */

import type { CostLine, Usage } from "./types.ts";

export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-5": { input: 5, output: 25 },
};

/**
 * Model routing by task complexity: the child explanation is the hard job and
 * goes to Sonnet; the parent note is a straightforward register change and
 * goes to Haiku.
 */
export const ROUTING = {
  child: "claude-sonnet-5",
  parent: "claude-haiku-4-5",
} as const;

export function costOf(model: string, usage: Usage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

export function totalOf(lines: readonly CostLine[]): number | null {
  if (lines.length === 0) return 0;
  if (lines.some((l) => l.usd === null)) return null;
  return lines.reduce((sum, l) => sum + (l.usd ?? 0), 0);
}

/** "$0.004" — and "less than a tenth of a cent" when that is the honest read. */
export function formatUsd(usd: number | null): string {
  if (usd === null) return "cost unknown";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(3)}`;
}
