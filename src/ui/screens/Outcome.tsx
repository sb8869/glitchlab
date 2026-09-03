import { bugById } from "../../bugs/library.ts";
import { SKINS } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";

export type RetestOutcome = {
  bugId: string;
  correct: boolean;
  /** The problem they actually answered, not a stand-in for it. */
  problem: string;
  /** They reached the answer, but only after being shown the working. */
  needed: boolean;
};

/**
 * What the delayed retest decided.
 *
 * The failing case is the hardest screen in the product and the one most
 * likely to attract a sad face. It gets none. Sprocket thinks rather than
 * frowns, the child's answer sits in a neutral slate rather than a red one,
 * and the result is framed as information: the bug showed us where it hides.
 */
export function Outcome({
  result: r,
  onContinue,
}: {
  /*
   * One verdict, not a list. A second retest resolving in the same warm-up
   * would have had no screen to appear on, so the repair log would have
   * changed behind the child's back. buildWarmup carries one; this says so.
   */
  result: RetestOutcome;
  onContinue: () => void;
}) {

  const skin = SKINS[r.bugId]!;
  const bug = bugById(r.bugId);
  return (
    <main className="panel">
      <div className="say">
        <Bot character="sprocket" eyes={r.correct ? "celebrating" : "thinking"} showTell={false} size={64} />
        <div className="bubble">
          <div className="line">
            {r.correct
              ? `${skin.name} is fixed for good.`
              : `Hm — ${skin.name}'s crack opened back up.`}
          </div>
          <div className="quiet">
            {/* Not "two sessions later" — the delay carries a jitter, so the
                copy states the shape of the rule rather than a number that
                is sometimes wrong. */}
            {r.correct
              ? "That problem came back days later, mixed into ordinary work, and you held it."
              : r.needed
                ? "You got there in the end — but it took a look at the working first."
                : "That's useful: now we know exactly where to look."}
          </div>
        </div>
      </div>

      <div className="bench-wrap">
        <div className="spotlight" />
        <div className="patient">
          <Bot
            character={r.bugId}
            eyes={r.correct ? "celebrating" : "idle"}
            showTell={!r.correct}
            size={200}
          />
        </div>
        <div className="bench">
          <span className="nameplate">{skin.name.toUpperCase()}</span>
        </div>
        <span className={`status ${r.correct ? "fixed" : "prob"}`}>
          {r.correct ? "repaired" : "back on the bench"}
        </span>
      </div>

      <div className="story">
        <div className="story-head">{skin.name}'s story so far</div>
        <ol>
          <li className="on">
            <b>Bug found</b>
            <span>{bug.childLabel}</span>
          </li>
          <li className={r.correct ? "on" : "warn"}>
            <b>Retest · today</b>
            {/*
              The problem they were actually given. This used to print the
              bug's canonical example instead, which is a different problem
              generated from a different seed — a screen recounting what just
              happened, quietly showing something that did not.
            */}
            <span>
              {r.problem} ·{" "}
              {r.correct
                ? "you held it"
                : r.needed
                  ? "right in the end, but not on your own"
                  : "the bug is still hiding in there"}
            </span>
          </li>
          <li className={r.correct ? "on" : ""}>
            <b>{r.correct ? "Repaired" : "Repair"}</b>
            <span>{r.correct ? "permanently retired" : "when the next retest holds"}</span>
          </li>
        </ol>
      </div>

      {/*
        Nothing on the passing side. "Three in a row only looks fixed" explains
        why probation exists, and probation is already over by the time anyone
        reads this — restating the rule after the fact is a lecture. The
        failing side keeps its line, which is reassurance rather than a rule.
      */}
      {!r.correct && (
        <p className="aside">
          {r.needed
            ? "A repair counts when it holds without a nudge. This one nearly did — it goes back on the bench and comes round again."
            : "Most bugs come back once. It's how we know they're real."}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* Back to the bench. What to work on next is the child's call. */}
        <button className="btn" onClick={onContinue}>
          Back to the bench
        </button>
      </div>
    </main>
  );
}
