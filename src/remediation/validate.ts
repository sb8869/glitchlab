/**
 * The validation gate.
 *
 * Remediation copy is checked against arithmetic the engine already computed
 * before it is ever shown to a child. Copy that fails is discarded and the
 * deterministic fallback is used instead, so nothing unvalidated can reach
 * the screen.
 *
 * The subtlety worth stating: this copy is SUPPOSED to quote wrong answers.
 * "Rivet says 40 take away 27 is 27" is a false arithmetic sentence and a
 * true sentence about the robot. So a claim is accepted when it matches real
 * arithmetic, OR when it is exactly what THIS bug's procedure computes for
 * that problem. Anything else is a number nobody can account for, and it is
 * rejected whether a model wrote it or a template did.
 */

import { predict } from "../bugs/library.ts";
import type { Item } from "../bugs/types.ts";
import type { Counterexample } from "./types.ts";

export type Check = { id: string; ok: boolean; detail?: string };
export type ValidationResult = { ok: boolean; checks: Check[]; failures: string[] };

const AI_TELLS = [
  "as an ai", "as a language model", "i'm sorry", "i am sorry",
  "certainly!", "here's the", "here is the", "sure!", "[insert",
];

/** Never aimed at the child. Wrongness is data in this app. */
const SCOLDING = [
  "you're wrong", "you are wrong", "you failed", "that's incorrect",
  "you made a mistake", "bad job", "try harder",
];

type Claim = { a: number; b: number; op: "+" | "-"; c: number; text: string };

/** Pull every integer arithmetic assertion out of prose. */
export function extractClaims(text: string): Claim[] {
  const claims: Claim[] = [];
  const add =
    /(\d+)\s*(?:\+|plus|and)\s*(\d+)\s*(?:=|is|are|makes|gives|equals|comes out|comes to)\s*(\d+)/gi;
  const sub =
    /(\d+)\s*(?:-|−|–|minus|take away|takes away|subtract)\s*(\d+)\s*(?:=|is|are|makes|gives|leaves|equals|comes out|comes to)\s*(\d+)/gi;
  /*
   * Only binary claims are checked. A match whose left operand is itself
   * preceded by a digit or an operator is a slice out of a longer expression
   * — "300 + 40 + 2 comes out 300402" would otherwise be read as the false
   * claim "40 + 2 = 300402". Skipping those keeps the gate conservative: it
   * rejects definite falsehoods and never invents one.
   */
  const chained = (index: number) =>
    /[\d+\-−–]\s*$/.test(text.slice(Math.max(0, index - 4), index));

  for (const m of text.matchAll(add)) {
    if (m.index !== undefined && chained(m.index)) continue;
    claims.push({ a: +m[1]!, b: +m[2]!, op: "+", c: +m[3]!, text: m[0] });
  }
  for (const m of text.matchAll(sub)) {
    if (m.index !== undefined && chained(m.index)) continue;
    claims.push({ a: +m[1]!, b: +m[2]!, op: "-", c: +m[3]!, text: m[0] });
  }
  return claims;
}

function claimIsAcceptable(claim: Claim, bugId: string): boolean {
  const truth = claim.op === "+" ? claim.a + claim.b : claim.a - claim.b;
  if (claim.c === truth) return true;
  /*
   * Or it is an accurate quotation of what this broken procedure writes.
   * "300 + 5 comes out 35" is ambiguous in prose between a binary sum and
   * expanded form, and for a place-value bug it is the expanded reading that
   * is true. Both readings are tried, and the claim survives if either is an
   * honest report of the bug — the gate exists to catch numbers nobody can
   * account for, not to force one parse on English.
   */
  const readings: Item[] = [
    { id: "claim-arith", band: "sub_regroup", kind: "arith", op: claim.op, a: claim.a, b: claim.b },
  ];
  if (claim.op === "+") {
    readings.push({ id: "claim-expanded", band: "place_value", kind: "expanded", parts: [claim.a, claim.b] });
  }
  try {
    return readings.some((item) => predict(bugId, item) === String(claim.c));
  } catch {
    return false;
  }
}

export type ValidateOptions = {
  bugId: string;
  example: Counterexample;
  maxChars: number;
  /** Child copy has to be readable by a seven-year-old. */
  childReadability?: boolean;
  /** The copy must name both answers, or it is not a counterexample. */
  requireBothAnswers?: boolean;
};

export function validateCopy(text: string, opts: ValidateOptions): ValidationResult {
  const checks: Check[] = [];
  const lower = text.toLowerCase();
  const push = (id: string, ok: boolean, detail?: string) => checks.push({ id, ok, detail });

  push("non_empty", text.trim().length > 0);
  push("length", text.length <= opts.maxChars, `${text.length}/${opts.maxChars} chars`);

  // A technical id must never surface to a child or a parent.
  push("no_technical_id", !lower.includes(opts.bugId.toLowerCase()) && !/[a-z]_[a-z]/.test(lower));

  const tell = AI_TELLS.find((t) => lower.includes(t));
  push("no_model_artifacts", !tell, tell);

  const scold = SCOLDING.find((t) => lower.includes(t));
  push("no_scolding", !scold, scold);

  // The heart of it: every number must survive arithmetic.
  const claims = extractClaims(text);
  const bad = claims.filter((c) => !claimIsAcceptable(c, opts.bugId));
  push(
    "arithmetic_true",
    bad.length === 0,
    bad.length ? bad.map((c) => `"${c.text}"`).join(", ") : `${claims.length} claims checked`,
  );

  if (opts.requireBothAnswers) {
    push("names_robot_answer", text.includes(opts.example.robotAnswer));
    push("names_correct_answer", text.includes(opts.example.correctAnswer));
  }

  if (opts.childReadability) {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const longest = Math.max(0, ...sentences.map((s) => s.split(/\s+/).length));
    push("short_sentences", longest <= 18, `longest ${longest} words`);
    const bigWord = text
      .split(/[^A-Za-z]+/)
      .find((w) => w.length > 12);
    push("simple_words", !bigWord, bigWord);
  }

  const failures = checks.filter((c) => !c.ok).map((c) => (c.detail ? `${c.id} (${c.detail})` : c.id));
  return { ok: failures.length === 0, checks, failures };
}
