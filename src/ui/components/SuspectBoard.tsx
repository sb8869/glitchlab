import { bugById, predict } from "../../bugs/library.ts";
import { itemLabel } from "../../bugs/procedures.ts";
import { CORRECT } from "../../engine/infer.ts";
import { bestRetestItem } from "../../learner/schedule.ts";
import { RULED_OUT, liveSuspects } from "../game/session.ts";
import type { Posterior } from "../../engine/infer.ts";

/**
 * What this bug looks like when it fires. Showing the signature turns the
 * board into something a child can reason from rather than a list of names:
 * "71 - 28 -> 57" is checkable, "smaller-from-larger" is not.
 */
function signature(bugId: string): { problem: string; answer: string } | null {
  if (bugId === CORRECT) return null;
  const item = bestRetestItem(bugId);
  if (!item) return null;
  return { problem: itemLabel(item), answer: predict(bugId, item) };
}

function labelFor(bugId: string): string {
  return bugId === CORRECT ? "Nothing — it does math fine" : bugById(bugId).childLabel;
}

export function SuspectBoard({
  posterior,
  onAccuse,
}: {
  posterior: Posterior;
  /** When present, a live suspect can be named as the culprit. */
  onAccuse?: (bugId: string) => void;
}) {
  const suspects = liveSuspects(posterior);
  const live = suspects.filter((s) => s.p >= RULED_OUT);
  const out = suspects.filter((s) => s.p < RULED_OUT);
  const leader = suspects[0];
  const settled = live.length === 1;

  return (
    <section className="card board" aria-label="Suspects">
      <div className="board-head">
        <p className="card-title" style={{ margin: 0 }}>Suspects</p>
        <div className="board-count">
          {live.length}
          <small>{settled ? "found it" : "still possible"}</small>
        </div>
      </div>

      <div className="suspects">
        {live.map(({ id, p }) => {
          const sig = signature(id);
          const isLead = leader?.id === id && p >= 0.5;
          const clickable = Boolean(onAccuse);
          return (
            <div
              key={id}
              className={`suspect${isLead ? " lead" : ""}${clickable ? " pick" : ""}`}
              onClick={clickable ? () => onAccuse!(id) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onAccuse!(id);
                    }
                  : undefined
              }
            >
              <div className="label">{labelFor(id)}</div>
              {sig && (
                <div className="sig">
                  {sig.problem} → <b>{sig.answer}</b>
                </div>
              )}
              <div className="bar">
                <span style={{ width: `${Math.max(2, Math.round(p * 100))}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {out.length > 0 && (
        <>
          {/* Ruled out, kept visible but compact: the pile growing is the
              progress bar for the diagnosis, but it must not crowd out the
              suspects that are still live. */}
          <p className="ruled-head">Ruled out · {out.length}</p>
          <ul className="ruled">
            {out.map(({ id }) => {
              const sig = signature(id);
              return (
                <li key={id}>
                  <span className="rl">{labelFor(id)}</span>
                  {sig && <span className="rs">{sig.problem} → {sig.answer}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
