import { useEffect, useRef, useState } from "react";

import { bugById, predict } from "../../bugs/library.ts";
import { itemLabel } from "../../bugs/procedures.ts";
import { CORRECT, type Posterior } from "../../engine/infer.ts";
import type { Item } from "../../bugs/types.ts";
import { generateForBug } from "../../bugs/generate.ts";
import { RULED_OUT, isTied, liveSuspects } from "../game/session.ts";

/** Deterministic per-slot tilt, so cards look pinned rather than printed. */
const TILT = [-1.2, 1, 0.8, -0.9, 1.3, -1.1, 0.6, -1.4, 1.1, -0.7, 0.9, -1.2, 1.2, -0.8];

/**
 * Below this many suspects the board stops hiding the sentences. Reading
 * three is not a reading test; reading thirteen is.
 */
const NAME_THEM_AT = 3;

/*
 * Ruling a suspect out is the payoff of the whole loop, and it used to happen
 * as a re-render: the cards were simply not there any more. So the board now
 * holds the departing cards in place, stamps them, and sweeps them off toward
 * the pile before the count moves.
 *
 * Everything downstream of the sweep — the counter, the meters, the sentences
 * on the last few suspects, the pile itself — waits for it to land. Otherwise
 * the board would be telling the child "three left" while eleven cards were
 * still visibly on it.
 */
const STAMP_MS = 340;
const SWEEP_MS = 480;
const STAGGER_MS = 45;
/** A cascade, not a queue. Eleven cards at 45ms each would be a wait. */
const STAGGER_CAP = 320;

/*
 * The width at which the layout stacks and the board stops being sticky —
 * the same breakpoint the stylesheet uses. Below it the board is a long way
 * down the page.
 */
const STACKED_AT = 940;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

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

/**
 * The problem the robot was last tested on, so a card can be asked what IT
 * would have written there.
 */
export type Probe = { item: Item; robotAnswer: string; name: string };

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
  leaving,
  delay = 0,
  probe,
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
  /** Ruled out by the test just run, and on its way off the board. */
  leaving?: boolean;
  /** Stagger, so a mass elimination cascades rather than blinks. */
  delay?: number;
  /** The last problem run, so an opened card can answer it in its own voice. */
  probe?: Probe | null;
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
  /*
   * Once there is a problem to put to it, a card stays tappable even after the
   * board has named its suspects — the last two standing are exactly where
   * "why is this one still up?" is worth asking.
   */
  const canOpen = Boolean(onToggle) && (!named || Boolean(probe)) && !leaving;
  const showAccuse = Boolean(onAccuse) && (named || open) && !leaving;
  return (
    <div
      className={`icard${lead ? " lead" : ""}${open ? " open" : ""}${canOpen ? " openable" : ""}${sig ? "" : " no-sig"}${leaving ? " gone" : ""}`}
      style={{ ["--tilt" as string]: `${tilt}deg`, ["--sweep-delay" as string]: `${delay}ms` }}
      aria-hidden={leaving || undefined}
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
      {leaving && (
        <span className="ko" aria-hidden="true">
          ✗
        </span>
      )}
      {sig && (
        <div className="sig">
          <span className="prob">{sig.problem}</span>
          <span className="arrow">→</span>
          <b>{sig.answer}</b>
        </div>
      )}
      {showLab && <div className="lab">{labelFor(id)}</div>}
      {/*
        What this suspect would have written on the problem just run, next to
        what the robot actually wrote.

        For a card still on the board the answer is, in practice, always "the
        same" — a suspect that disagreed with the robot falls below the
        elimination threshold on that very test. That is the point rather than
        a shortcoming: it is the reason this card is still up, in numbers the
        child can check themselves. It matters most on a test that ruled
        nothing out, where Sprocket says only "some tests don't" and the cards
        can be asked why: because every one of them writes what the robot
        wrote.

        The disagreeing branch is therefore a guard, not an expected state. It
        is kept because the threshold is a tuning constant and a card that
        quietly claimed agreement it did not have would be worse than a rare
        red box.

        It is deliberately about the problem ALREADY RUN, never about the tests
        on offer. Showing what each suspect would say to an unplayed test would
        turn choosing a good question — the numeracy work this game exists for
        — into reading the answers off the board.
      */}
      {open && probe && !leaving && (
        <div className={`probe${predict(id, probe.item) === probe.robotAnswer ? " same" : " diff"}`}>
          <span className="pq">{itemLabel(probe.item)}</span>
          <span className="arrow">→</span>
          <b>{predict(id, probe.item)}</b>
          <span className="verdict">
            {predict(id, probe.item) === probe.robotAnswer
              ? `same as ${probe.name}`
              : `not ${probe.name}`}
          </span>
        </div>
      )}
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
  hold = false,
  probe = null,
  onAccuse,
  tieHint,
  tieAnswer,
  tieProblem,
}: {
  posterior: Posterior;
  /*
   * Keep the board as it is, even though the posterior has already moved.
   *
   * The engine narrows the moment the child picks a test tool, because the
   * evidence is the robot's answer and that arrives immediately. But the
   * child's attention at that moment is on the answer box, and Sprocket does
   * not say "that test ruled out two suspects" until they have answered — so
   * the reward played to nobody and the narration arrived over a board that
   * had gone quiet three seconds earlier. Held through the answer, the sweep
   * lands on the sentence that describes it, and the child's own answer is
   * what releases it.
   */
  hold?: boolean;
  /** The problem just run, so an opened card can answer it in its own voice. */
  probe?: Probe | null;
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
  const leader = live[0];

  /*
   * The cards actually on the board, in the order they were pinned up.
   *
   * This is deliberately NOT the posterior's order, which sorts by
   * probability: re-sorting after every test made the surviving cards jump
   * around the grid, so a child tracking one suspect lost it. The leader is
   * marked by its border instead, which says the same thing without moving
   * anything. Cards leave this list only after they have been swept off.
   */
  const [slots, setSlots] = useState<string[]>(() => live.map((sp) => sp.id));
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  /*
   * The headline count, which releases WITH the sweep rather than after it.
   *
   * It cannot simply read the posterior: while the board is held the posterior
   * has already narrowed, and the header would give the answer away before the
   * child has answered. It cannot wait for the cards to land either — the
   * compare screen puts "1 suspect left" in a chip a few inches away, and for
   * the length of the sweep the board would be flatly contradicting it.
   *
   * So the number drops the instant the stamps start falling. The cards are
   * then the reason for the number rather than a second opinion on it.
   */
  const [revealed, setRevealed] = useState(live.length);
  const boardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (hold) return;
    const next = liveSuspects(posterior)
      .filter((sp) => sp.p >= RULED_OUT)
      .map((sp) => sp.id);
    const alive = new Set(next);
    const departing = slots.filter((id) => !alive.has(id));
    // A suspect can only ever leave. Anything arriving means a different case
    // is on the board, so there is nothing to sweep — just repin it.
    if (next.some((id) => !slots.includes(id)) || slots.length === 0) {
      setSlots(next);
      setLeaving(new Set());
      setRevealed(next.length);
      return;
    }
    if (departing.length === 0) {
      setRevealed(next.length);
      return;
    }
    if (prefersReducedMotion()) {
      setSlots(next);
      setRevealed(next.length);
      return;
    }
    setLeaving(new Set(departing));
    setRevealed(next.length);
    /*
     * On a phone the board is below the answer tray, and focusing the input
     * has already scrolled the page past it — so thirteen cards were being
     * stamped and swept two-thirds of the way down a document nobody was
     * looking at. A reward nobody sees is not a reward. Only when the layout
     * has stacked, only when the board is genuinely out of the way, and only
     * far enough to bring it fully on screen.
     */
    const el = boardRef.current;
    if (el && window.innerWidth <= STACKED_AT) {
      const top = el.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.45) {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "nearest",
        });
      }
    }
    const settle =
      STAMP_MS + SWEEP_MS + Math.min((departing.length - 1) * STAGGER_MS, STAGGER_CAP);
    const t = setTimeout(() => {
      setSlots(next);
      setLeaving(new Set());
    }, settle);
    return () => clearTimeout(t);
    // A new posterior, or the release of the hold, starts a sweep; `slots` is
    // read, never watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterior, hold]);

  const sweeping = leaving.size > 0;
  /*
   * Two clocks, deliberately. The headline — the count and "found it" — runs
   * on `revealed`, which moves when the sweep begins, so it agrees with the
   * chip the compare screen puts a few inches away. Everything belonging to
   * the cards runs on `slots`, which moves when the sweep lands.
   *
   * The sentences are emphatically on the second clock. Hanging them off the
   * headline instead meant that the moment the count fell to one, all fourteen
   * cards — the thirteen still being stamped included — put their sentences
   * back on, and the board turned into the wall of prose it exists to avoid.
   */
  const shown = revealed;
  const settled = shown === 1;
  const named = slots.length <= NAME_THEM_AT;
  /*
   * Ruled out AND off the board. Keyed on what is pinned up rather than on
   * what is currently in flight, so a suspect is never listed in the pile
   * while its card is still hanging there — which is what would happen for
   * the whole time the board is held.
   */
  const filed = out.filter((sp) => !slots.includes(sp.id));
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  /*
   * No test has produced evidence yet, so every suspect is equally likely.
   * Drawing thirteen identical bars there would be noise dressed up as data,
   * so the board opens as a plain roster and grows meters once it knows
   * something.
   */
  const hasEvidence = filed.length > 0;

  return (
    <section className="board" aria-label="Suspect board" ref={boardRef}>
      <div className="board-head">
        <span className="board-tag">SUSPECT BOARD</span>
        <span className="board-count">
          {/* Keyed on the value so the punch replays every time it drops. */}
          <b key={shown} className="tick">
            {shown}
          </b>
          <span>{settled ? "found it" : "still possible"}</span>
        </span>
      </div>

      {tied && !sweeping ? (
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
        <div
          className={`cards${slots.length > 10 ? " dense" : ""}${sweeping ? " sweeping" : ""}`}
        >
          {slots.map((id, i) => {
            const go = leaving.has(id);
            // Stagger by position among the departing, not among all cards,
            // so the cascade has no gaps in it.
            const order = slots.filter((x) => leaving.has(x)).indexOf(id);
            return (
              <Card
                key={id}
                id={id}
                p={posterior[id] ?? 0}
                tilt={TILT[i % TILT.length] ?? 0}
                showMeter={hasEvidence && !go}
                named={named}
                lead={hasEvidence && leader?.id === id && (posterior[id] ?? 0) >= 0.5}
                open={open === id}
                leaving={go}
                delay={go ? Math.min(order * STAGGER_MS, STAGGER_CAP) : 0}
                probe={probe}
                onToggle={toggle}
                onAccuse={onAccuse}
              />
            );
          })}
        </div>
      )}

      {filed.length > 0 && (
        <div className="pile">
          <ul>
            {/*
              Struck-through signatures, not struck-through sentences. The pile
              says "not this" about the same thing the board says "maybe this"
              about, and it costs four words instead of thirty.
            */}
            {filed.slice(0, 4).map((s) => {
              const sig = signature(s.id);
              return (
                <li key={s.id}>{sig ? `${sig.problem} → ${sig.answer}` : labelFor(s.id)}</li>
              );
            })}
          </ul>
          {filed.length > 4 && <span className="more">+{filed.length - 4} more</span>}
          {/* Keyed so the stamp lands again each time the pile grows. */}
          <span className="stamp" key={filed.length}>
            RULED OUT · {filed.length}
          </span>
        </div>
      )}
    </section>
  );
}
