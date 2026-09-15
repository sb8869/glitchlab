import type { Answer, Frac, Item } from "./types.ts";

/* ---------------------------------------------------------------- digits */

/** Digits least-significant-first. digitsOf(305) -> [5, 0, 3]. */
export function digitsOf(n: number): number[] {
  const s = Math.abs(Math.trunc(n)).toString();
  const out: number[] = [];
  for (let i = s.length - 1; i >= 0; i--) out.push(s.charCodeAt(i) - 48);
  return out;
}

/** Digit at column i (0 = ones), or 0 past the left edge. */
export function digitAt(ds: readonly number[], i: number): number {
  return ds[i] ?? 0;
}

/**
 * Join least-significant-first digits into a normalized numeral.
 * Leading zeros are stripped, because a child does not write "057".
 */
export function fromDigitsLsb(ds: readonly number[]): Answer {
  const s = [...ds].reverse().join("");
  const trimmed = s.replace(/^0+(?=\d)/, "");
  return trimmed.length > 0 ? trimmed : "0";
}

export function numDigits(n: number): number {
  return Math.abs(Math.trunc(n)).toString().length;
}

/* -------------------------------------------------------------- fractions */

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x === 0 ? 1 : x;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/** Canonical string form. NOT reduced — see the note in types.ts. */
export function fracStr(f: Frac): Answer {
  return `${f.n}/${f.d}`;
}

export function fracValue(f: Frac): number {
  return f.n / f.d;
}

/* ---------------------------------------------------------------- correct */

/**
 * The answer a child running the *taught* procedure writes down.
 * For fraction addition that is the least-common-denominator form,
 * which is what the algorithm produces before any reduction step.
 */
export function correct(item: Item): Answer {
  switch (item.kind) {
    case "arith":
      return String(item.op === "+" ? item.a + item.b : item.a - item.b);
    case "expanded":
      return String(item.parts.reduce((s, p) => s + p, 0));
    case "fracAdd": {
      const L = lcm(item.a.d, item.b.d);
      const n = item.a.n * (L / item.a.d) + item.b.n * (L / item.b.d);
      return fracStr({ n, d: L });
    }
    case "fracCompare": {
      const bigger =
        fracValue(item.a) >= fracValue(item.b) ? item.a : item.b;
      return fracStr(bigger);
    }
  }
}

/** The problem as a child reads it: "40 - 27", "300 + 40 + 2", "1/2 vs 1/3". */
export function itemLabel(item: Item): string {
  switch (item.kind) {
    case "arith":
      return `${item.a} ${item.op} ${item.b}`;
    case "expanded":
      return item.parts.join(" + ");
    case "fracAdd":
      return `${fracStr(item.a)} + ${fracStr(item.b)}`;
    case "fracCompare":
      return `${fracStr(item.a)} vs ${fracStr(item.b)}`;
  }
}
