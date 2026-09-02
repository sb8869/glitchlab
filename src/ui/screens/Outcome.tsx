import { bugById } from "../../bugs/library.ts";
import { SKINS } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";

export type RetestOutcome = {
  bugId: string;
  correct: boolean;
  /** The problem they actually answered, not a stand-in for it. */
  problem: string;
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
  results,
  nextName,
  onContinue,
}: {
  results: RetestOutcome[];
  /** The robot the child picked before the warm-up, which is where this goes. */
  nextName: string | null;
  onContinue: () => void;
}) {
  const r = results[0];
  if (!r) return null;

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
            {r.correct
              ? "That problem came back two sessions later and you held it."
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
              {r.problem} · {r.correct ? "you held it" : "the bug is still hiding in there"}
            </span>
          </li>
          <li className={r.correct ? "on" : ""}>
            <b>{r.correct ? "Repaired" : "Repair"}</b>
            <span>{r.correct ? "permanently retired" : "when the next retest holds"}</span>
          </li>
        </ol>
      </div>

      <p className="aside">
        {r.correct
          ? "Three in a row only looks fixed. Coming back days later and still getting it right is what makes a repair real."
          : "Most bugs come back once. It's how we know they're real."}
      </p>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* Says where it goes. It used to say "Have another look" and go to
            the bench, which was neither a look nor the robot they picked. */}
        <button className="btn" onClick={onContinue}>
          {nextName ? `On to ${nextName} \u2192` : "Back to the bench"}
        </button>
      </div>
    </main>
  );
}
