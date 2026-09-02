/**
 * Generate remediation copy, offline.
 *
 *   ANTHROPIC_API_KEY=sk-... npm run remediation
 *
 * Why offline: the deployed game then needs no API key, no backend and no
 * network at play time, which keeps the "no server-side anything" scope line
 * intact and means a child never waits on a model. It also means the cost
 * shown on screen is a real measured number rather than an estimate.
 *
 * Nothing unvalidated is ever written. Copy that fails the gate is retried
 * once and then replaced by the deterministic fallback, so the worst case is
 * a slightly plainer sentence rather than a wrong one.
 */

import { writeFileSync } from "node:fs";

import { BUGS } from "../src/bugs/library.ts";
import {
  ROUTING,
  costOf,
  counterexampleFor,
  fallbackFor,
  formatUsd,
  practiceFor,
  totalOf,
  validateCopy,
} from "../src/remediation/index.ts";
import { buildChildPrompt, buildParentPrompt, type PromptPair } from "../src/remediation/prompt.ts";
import type { CostLine, GenerationRecord, Remediation, Usage } from "../src/remediation/types.ts";

const API_KEY = process.env["ANTHROPIC_API_KEY"];
const OUT = "src/remediation/generated.ts";

if (!API_KEY) {
  console.error(
    "\nNo ANTHROPIC_API_KEY set.\n" +
      "The game already runs on the deterministic fallback, so this is optional.\n" +
      "To generate the model-written copy:\n\n" +
      "  ANTHROPIC_API_KEY=sk-... npm run remediation\n",
  );
  process.exit(1);
}

type Called = { text: string; usage: Usage };

async function call(model: string, prompt: PromptPair, maxTokens: number): Promise<Called> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`${model} responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const text = body.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  return {
    text,
    usage: { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens },
  };
}

const costs: CostLine[] = [];

/** Call, validate, retry once, and give up honestly rather than ship junk. */
async function generate(
  label: string,
  model: string,
  prompt: PromptPair,
  maxTokens: number,
  check: (text: string) => { ok: boolean; failures: string[] },
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text, usage } = await call(model, prompt, maxTokens);
    costs.push({ model, usage, usd: costOf(model, usage) });
    const verdict = check(text);
    if (verdict.ok) return text;
    console.log(`    ${label} attempt ${attempt} rejected: ${verdict.failures.join("; ")}`);
  }
  return null;
}

const entries: Record<string, Remediation> = {};
let generatedCount = 0;
let fallbackCount = 0;

for (const bug of BUGS) {
  const ex = counterexampleFor(bug.id);
  if (!ex) continue;
  console.log(`\n${bug.id}  (${ex.problem} → ${ex.robotAnswer}, really ${ex.correctAnswer})`);

  const child = await generate(
    "child",
    ROUTING.child,
    buildChildPrompt(bug.id, ex),
    400,
    (text) =>
      validateCopy(text, {
        bugId: bug.id,
        example: ex,
        maxChars: 320,
        childReadability: true,
        requireBothAnswers: true,
      }),
  );

  const parent = await generate(
    "parent",
    ROUTING.parent,
    buildParentPrompt(bug.id, ex),
    600,
    (text) =>
      validateCopy(text, { bugId: bug.id, example: ex, maxChars: 700, requireBothAnswers: true }),
  );

  if (child && parent) {
    entries[bug.id] = {
      bugId: bug.id,
      childExplanation: child,
      example: ex,
      practice: practiceFor(bug.id, [ex.itemId]),
      parentNote: parent,
      source: "generated",
      models: { child: ROUTING.child, parent: ROUTING.parent },
    };
    generatedCount++;
    console.log(`    kept`);
  } else {
    entries[bug.id] = fallbackFor(bug.id);
    fallbackCount++;
    console.log(`    fell back to the deterministic copy`);
  }
}

const record: GenerationRecord = {
  generatedAt: new Date().toISOString(),
  entries,
  costs,
  totalUsd: totalOf(costs),
};

writeFileSync(
  OUT,
  `/**
 * Generated remediation copy — DO NOT EDIT BY HAND.
 * Written by scripts/generate-remediation.ts on ${record.generatedAt}.
 *
 * Every entry passed the validation gate in src/remediation/validate.ts
 * before being written here, so no unchecked sentence can reach a child.
 */

import type { GenerationRecord } from "./types.ts";

export const GENERATED: GenerationRecord = ${JSON.stringify(record, null, 2)};
`,
);

console.log(`\n${"=".repeat(58)}`);
console.log(`generated ${generatedCount}, fell back ${fallbackCount}, of ${BUGS.length} bugs`);
console.log(`${costs.length} model calls`);
for (const model of new Set(costs.map((c) => c.model))) {
  const mine = costs.filter((c) => c.model === model);
  const inTok = mine.reduce((s, c) => s + c.usage.inputTokens, 0);
  const outTok = mine.reduce((s, c) => s + c.usage.outputTokens, 0);
  console.log(`  ${model.padEnd(22)} ${mine.length} calls  ${inTok} in / ${outTok} out  ${formatUsd(totalOf(mine))}`);
}
console.log(`TOTAL ${formatUsd(record.totalUsd)}  ->  ${OUT}\n`);
