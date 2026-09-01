/**
 * The character system.
 *
 * There is one body skeleton. A character is that skeleton plus two colors,
 * an eye group, a silhouette (head / antenna / feet variant) and at most one
 * glitch tell. Thirteen patient bots therefore cost one drawing and a table.
 *
 * Adding a bug to the library without adding a skin here is a test failure,
 * so the cast can never silently fall out of sync with the engine.
 */

import { BUGS } from "../../bugs/library.ts";

/** Shared across every character, so a fault always reads the same way. */
export const SHARED = {
  outline: "#14343f",
  eye: "#14343f",
  face: "#eef4f5",
  glitch: "#e8536f",
} as const;

export type EyeState = "idle" | "thinking" | "celebrating";

/**
 * Not every tell is additive, so the kind says how to apply it.
 *  overlay   — drop the group into #bot-tell
 *  eyes      — replace the contents of #bot-eyes
 *  transform — apply a CSS transform to a named skeleton part
 */
export type Tell =
  | { kind: "overlay"; id: string }
  | { kind: "eyes"; id: string }
  | { kind: "transform"; part: string; value: string };

/** Group ids in silhouettes.svg, minus the `head-` / `antenna-` / `feet-` prefix. */
export type Silhouette = {
  head: "square" | "round" | "tall";
  antenna: "knob" | "double" | "coil";
  feet: "blocks" | "treads" | "round";
};

export type BotSkin = {
  /** Kid-facing name. Deliberately does NOT hint at the bug — that is the puzzle. */
  name: string;
  body: string;
  accent: string;
  silhouette: Silhouette;
  tell: Tell;
};

const BENT_ANTENNA: Tell = {
  kind: "transform",
  part: "bot-antenna",
  value: "rotate(-42deg) translateX(-4px)",
};

/**
 * Sprocket: the host. Permanently competent, never broken, no tell, and the
 * app icon. The one teal bot — teal is reserved so the child never confuses
 * the helper with a patient.
 */
export const SPROCKET = {
  name: "Sprocket",
  body: "#4fd1c5",
  accent: "#f6b93b",
  silhouette: { head: "square", antenna: "knob", feet: "blocks" } as Silhouette,
} as const;

// Body hues walk the wheel and skip the teal band. Bots that share a tell are
// separated by both hue and silhouette. tell-dented-head assumes head-square.
export const SKINS: Record<string, BotSkin> = {
  // --- subtraction
  sub_smaller_from_larger:  { name: "Rivet",  body: "#f0705a", accent: "#ffe0a3", silhouette: { head: "square", antenna: "knob",   feet: "blocks" }, tell: { kind: "overlay", id: "tell-cracked-panel" } },
  sub_borrow_no_decrement:  { name: "Pip",    body: "#8e60d8", accent: "#c9f2dc", silhouette: { head: "round",  antenna: "knob",   feet: "round"  }, tell: BENT_ANTENNA },
  sub_zero_minus_n_is_n:    { name: "Nox",    body: "#f2b62c", accent: "#e6f0ff", silhouette: { head: "tall",   antenna: "double", feet: "blocks" }, tell: { kind: "eyes", id: "tell-eyes-mismatched" } },
  sub_zero_minus_n_is_zero: { name: "Cinder", body: "#a6c93d", accent: "#ffe08a", silhouette: { head: "square", antenna: "coil",   feet: "treads" }, tell: { kind: "overlay", id: "tell-static-chest" } },

  // --- addition
  add_carry_dropped:        { name: "Bolt",   body: "#4fa9ec", accent: "#ffd08a", silhouette: { head: "round",  antenna: "knob",   feet: "treads" }, tell: { kind: "overlay", id: "tell-loose-wire" } },
  add_carry_written_both:   { name: "Fizz",   body: "#ec6fb5", accent: "#fff3b0", silhouette: { head: "tall",   antenna: "coil",   feet: "round"  }, tell: { kind: "overlay", id: "tell-sparks" } },

  // --- place value
  add_left_align:           { name: "Domino", body: "#4a6de0", accent: "#ffb98a", silhouette: { head: "square", antenna: "double", feet: "blocks" }, tell: { kind: "overlay", id: "tell-dented-head" } },
  pv_concatenate:           { name: "Widget", body: "#62cc74", accent: "#ffd9a0", silhouette: { head: "tall",   antenna: "knob",   feet: "round"  }, tell: { kind: "overlay", id: "tell-cracked-panel" } },
  pv_drop_empty_place:      { name: "Quill",  body: "#f28a2e", accent: "#dff5e8", silhouette: { head: "round",  antenna: "coil",   feet: "blocks" }, tell: { kind: "eyes", id: "tell-eyes-dizzy" } },

  // --- fractions
  frac_add_across:                   { name: "Zap",    body: "#8c8ff0", accent: "#ffe3a3", silhouette: { head: "round",  antenna: "double", feet: "blocks" }, tell: { kind: "overlay", id: "tell-static-chest" } },
  frac_common_denom_keep_numerators: { name: "Gizmo",  body: "#b04f9b", accent: "#ffdca3", silhouette: { head: "tall",   antenna: "knob",   feet: "treads" }, tell: { kind: "overlay", id: "tell-sprung-coil" } },
  frac_bigger_denominator_wins:      { name: "Cog",    body: "#2e9a5f", accent: "#ffe08a", silhouette: { head: "square", antenna: "knob",   feet: "round"  }, tell: BENT_ANTENNA },
  frac_numerator_only:               { name: "Splint", body: "#b97a45", accent: "#cfe8ff", silhouette: { head: "round",  antenna: "double", feet: "treads" }, tell: { kind: "overlay", id: "tell-loose-wire" } },
};

export function skinFor(bugId: string): BotSkin {
  const s = SKINS[bugId];
  if (!s) throw new Error(`No bot skin for bug: ${bugId}`);
  return s;
}

/** CSS custom properties for one character. This is the entire "fill swap". */
export function cssVarsFor(bugId: string): Record<string, string> {
  const s = skinFor(bugId);
  return {
    "--bot-body": s.body,
    "--bot-accent": s.accent,
    "--bot-face": SHARED.face,
    "--bot-outline": SHARED.outline,
    "--bot-eye": SHARED.eye,
    "--bot-glitch": SHARED.glitch,
  };
}

export const ALL_BUG_IDS: readonly string[] = BUGS.map((b) => b.id);
