import { bugById, predict } from "../../bugs/library.ts";
import { correct, itemLabel } from "../../bugs/procedures.ts";
import { CORRECT, type Posterior } from "../../engine/infer.ts";
import { generateForBug } from "../../bugs/generate.ts";
import { RULED_OUT, isTied, liveSuspects } from "../game/session.ts";

/** Deterministic per-slot tilt, so cards look pinned rather than printed. */
const TILT = [-1.2, 1, 0.8, -0.9, 1.3, -1.1, 0.6, -1.4, 1.1, -0.7, 0.9, -1.2, 1.2, -0.8];

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

function signature(bugId: string): { problem: string; answer: string; ok: boolean } | null {
  if (bugId === CORRECT) return null;
  const item = generateForBug(bugId, SIGNATURE_SEED, 1)[0];
  if (!item) return null;
  return { problem: itemLabel(item), answer: predict(bugId, item), ok: false };
}

function labelFor(bugId: string): string {
  return bugId === CORRECT ? "Nothing — it does math fine" : bugById(bugId).childLabel;
}

function Card({
  id,
  p,
  tilt,
  showMeter,
  lead,
  onPick,
  override,
}: {
  id: string;
  p: number;
  tilt: number;
  showMeter: boolean;
  lead?: boolean;
  onPick?: (id: string) => void;
  /** Force the example shown, so tied cards can prove they agree. */
  override?: { problem: string; answer: string } | null;
}) {
  const sig = override ? { ...override, ok: false } : signature(id);
  const pickable = Boolean(onPick);
  return (
    <div
      className={`icard${lead ? " lead" : ""}${pickable ? " pick" : ""}`}
      style={{ ["--tilt" as string]: `${tilt}deg` }}
      onClick={pickable ? () => onPick!(id) : undefined}
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      onKeyDown={
        pickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onPick!(id);
            }
          : undefined
      }
    >
      <div className="lab">{labelFor(id)}</div>
      {sig && (
        <div className="sig">
          {sig.problem} → <b className={sig.ok ? "ok" : ""}>{sig.answer}</b>
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
  const all = liveSuspects(posterior);
  const live = all.filter((s) => s.p >= RULED_OUT);
  const out = all.filter((s) => s.p < RULED_OUT);
  const tied = isTied(posterior);
  const settled = live.length === 1;
  const leader = live[0];

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
                onPick={onAccuse}
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
              lead={hasEvidence && leader?.id === s.id && s.p >= 0.5}
              onPick={onAccuse}
            />
          ))}
        </div>
      )}

      {out.length > 0 && (
        <div className="pile">
          <ul>
            {out.slice(0, 4).map((s) => (
              <li key={s.id}>{labelFor(s.id)}</li>
            ))}
          </ul>
          {out.length > 4 && <span className="more">+{out.length - 4} more</span>}
          <span className="stamp">RULED OUT · {out.length}</span>
        </div>
      )}
    </section>
  );
}
