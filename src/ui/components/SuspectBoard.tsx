import { useEffect, useState } from "react";

import { bugById, predict } from "../../bugs/library.ts";
import { itemLabel } from "../../bugs/procedures.ts";
import { CORRECT, type Posterior } from "../../engine/infer.ts";
import { generateForBug } from "../../bugs/generate.ts";
import { RULED_OUT, isTied, liveSuspects } from "../game/session.ts";

/** Deterministic per-slot tilt, so cards look pinned rather than printed. */
const TILT = [-1.2, 1, 0.8, -0.9, 1.3, -1.1, 0.6, -1.4, 1.1, -0.7, 0.9, -1.2, 1.2, -0.8];

/**
 * Below this many suspects the board stops hiding the sentences. Reading
 * three is not a reading test; reading thirteen is.
 */
const NAME_THEM_AT = 3;

/**
 * What this bug writes when it fires. The signature is what makes the board
 * something a child can reason from: "305 - 128 -> 223" is checkable,
 * "smaller-from-larger" is not.
 *
 * Generated, but from a FIXED seed, so a bug's card keeps the same example for
 * as long as the child is looking at it. It used to come from the probe bank,
 * which meant the board illustrated bugs with problems the child would never
 * be offered.
 */
const SIGNATURE_SEED = 20260902;

function signature(bugId: string): { problem: string; answer: string } | null {
  if (bugId === CORRECT) return null;
  const item = generateForBug(bugId, SIGNATURE_SEED, 1)[0];
  if (!item) return null;
  return { problem: itemLabel(item), answer: predict(bugId, item) };
}

function labelFor(bugId: string): string {
  return bugId === CORRECT ? "Nothing — it does math fine" : bugById(bugId).childLabel;
}

/**
 * One suspect.
 *
 * The signature is the card. The sentence underneath it used to be, and that
 * made the opening board ninety-five words of prose in thirteen cards, which
 * is a reading test wearing a math game's clothes. It is also the wrong way
 * round: a bug in this game IS its outputs — an executable procedure — so the
 * thing a child should compare is the number, not the description of it.
 *
 * The sentence comes back when it is affordable: on the last few suspects,
 * where naming the culprit is the point, or on a tap.
 */
function Card({
  id,
  p,
  tilt,
  showMeter,
  named,
  lead,
  open,
  onToggle,
  onAccuse,
  override,
}: {
  id: string;
  p: number;
  tilt: number;
  showMeter: boolean;
  /** The board is down to a few suspects, so every card wears its sentence. */
  named: boolean;
  lead?: boolean;
  open: boolean;
  onToggle?: (id: string) => void;
  onAccuse?: (id: string) => void;
  /** Force the example shown, so tied cards can prove they agree. */
  override?: { problem: string; answer: string } | null;
}) {
  const sig = override ?? signature(id);
  // The "does math fine" card has no signature to lead with, so it keeps its
  // sentence at full size — it is the one card that IS a sentence.
  const showLab = named || open || !sig;
  /*
   * Tapping is for revealing. It used to be for accusing, which meant a
   * mis-tap on a thirteen-card grid was a wrong accusation — a punishing thing
   * to do to a seven-year-old's thumb. Accusing is now its own button, and it
   * appears only once the board is down to a few suspects or the child has
   * deliberately opened the card. Gating it on "the sentence is showing"
   * instead put a one-tap accuse button on the no-signature card from the
   * very first test, while thirteen other suspects were still standing.
   */
  const canOpen = Boolean(onToggle) && !named;
  const showAccuse = Boolean(onAccuse) && (named || open);
  return (
    <div
      className={`icard${lead ? " lead" : ""}${open ? " open" : ""}${canOpen ? " pick" : ""}${sig ? "" : " no-sig"}`}
      style={{ ["--tilt" as string]: `${tilt}deg` }}
      onClick={canOpen ? () => onToggle!(id) : undefined}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-expanded={canOpen ? open : undefined}
      aria-label={
        canOpen
          ? sig
            ? `${sig.problem} gives ${sig.answer}. Show what this one does.`
            : `${labelFor(id)}. Consider this one.`
          : undefined
      }
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle!(id);
              }
            }
          : undefined
      }
    >
      {sig && (
        <div className="sig">
          <span className="prob">{sig.problem}</span>
          <span className="arrow">→</span>
          <b>{sig.answer}</b>
        </div>
      )}
      {showLab && <div className="lab">{labelFor(id)}</div>}
      {showMeter && (
        <div className="meter">
          <div className="track">
            <span style={{ width: `${Math.max(3, Math.round(p * 100))}%` }} />
          </div>
          <b>{(p * 100).toFixed(1)}%</b>
        </div>
      )}
      {showAccuse && (
        <button
          className="accuse"
          onClick={(e) => {
            e.stopPropagation();
            onAccuse!(id);
          }}
        >
          That's the one
        </button>
      )}
    </div>
  );
}

export function SuspectBoard({
  posterior,
  onAccuse,
  tieHint,
  tieAnswer,
  tieProblem,
}: {
  posterior: Posterior;
  onAccuse?: (bugId: string) => void;
  /** The problem that would separate two tied suspects. */
  tieHint?: string | null;
  /** What the robot actually wrote on the test that produced the deadlock. */
  tieAnswer?: string | null;
  /** The problem that produced the deadlock. */
  tieProblem?: string | null;
}) {
  /** Which card is showing its sentence. One at a time; the board stays quiet. */
  const [open, setOpen] = useState<string | null>(null);
  // A new test is a new board. Carrying an expanded card across a test left a
  // sentence up next to numbers it no longer belonged to.
  useEffect(() => setOpen(null), [posterior]);

  const all = liveSuspects(posterior);
  const live = all.filter((s) => s.p >= RULED_OUT);
  const out = all.filter((s) => s.p < RULED_OUT);
  const tied = isTied(posterior);
  const settled = live.length === 1;
  const leader = live[0];
  const named = live.length <= NAME_THEM_AT;
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  /*
   * No test has produced evidence yet, so every suspect is equally likely.
   * Drawing thirteen identical bars there would be noise dressed up as data,
   * so the board opens as a plain roster and grows meters once it knows
   * something.
   */
  const hasEvidence = out.length > 0;

  return (
    <section className="board" aria-label="Suspect board">
      <div className="board-head">
        <span className="board-tag">SUSPECT BOARD</span>
        <span className="board-count">
          <b>{live.length}</b>
          <span>{settled ? "found it" : "still possible"}</span>
        </span>
      </div>

      {tied ? (
        <div className="tie">
          <span className="pin-l" />
          <span className="pin-r" />
          <div className="twine" />
          <div className="tag">= TIED</div>
          <div className="pair">
            {live.map((s, i) => (
              <Card
                key={s.id}
                id={s.id}
                p={s.p}
                tilt={i === 0 ? -1 : 1}
                showMeter
                named
                open={open === s.id}
                onAccuse={onAccuse}
                /*
                 * Both tied cards show the SAME problem — the one just run —
                 * and the same answer, which is the whole claim being made.
                 * Showing each suspect's own signature here made two
                 * indistinguishable bugs look like they do different things.
                 */
                override={tieProblem && tieAnswer ? { problem: tieProblem, answer: tieAnswer } : null}
              />
            ))}
          </div>
          <div className="tie-note">
            {tieAnswer
              ? `Both would write ${tieAnswer} here — we can't tell them apart yet.`
              : "These two write the same thing — we can't tell them apart yet."}
            {tieHint && <span className="hint">Try {tieHint} to split them.</span>}
          </div>
        </div>
      ) : (
        <div className={`cards${live.length > 10 ? " dense" : ""}`}>
          {live.map((s, i) => (
            <Card
              key={s.id}
              id={s.id}
              p={s.p}
              tilt={TILT[i % TILT.length] ?? 0}
              showMeter={hasEvidence}
              named={named}
              lead={hasEvidence && leader?.id === s.id && s.p >= 0.5}
              open={open === s.id}
              onToggle={toggle}
              onAccuse={onAccuse}
            />
          ))}
        </div>
      )}

      {out.length > 0 && (
        <div className="pile">
          <ul>
            {/*
              Struck-through signatures, not struck-through sentences. The pile
              says "not this" about the same thing the board says "maybe this"
              about, and it costs four words instead of thirty.
            */}
            {out.slice(0, 4).map((s) => {
              const sig = signature(s.id);
              return (
                <li key={s.id}>{sig ? `${sig.problem} → ${sig.answer}` : labelFor(s.id)}</li>
              );
            })}
          </ul>
          {out.length > 4 && <span className="more">+{out.length - 4} more</span>}
          <span className="stamp">RULED OUT · {out.length}</span>
        </div>
      )}
    </section>
  );
}
