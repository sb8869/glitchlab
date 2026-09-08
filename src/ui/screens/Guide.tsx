import { useState } from "react";

import { BUGS } from "../../bugs/library.ts";
import { Bot, Sprocket } from "../components/Bot.tsx";

/**
 * How to play.
 *
 * Shown once before a child's first session, and reachable from the bench
 * forever after. Until this existed the game opened straight onto the bench:
 * thirteen robots, no premise, no verb, and nothing saying what any of it was
 * for. A judge with three minutes and a child with none would both bounce.
 *
 * It then overcorrected into a hundred and thirteen words, which for the
 * five-year-old end of K-5 is a reading comprehension test standing between
 * them and a math game. A playtester put it plainly: no one reads that many
 * directions, least of all a child.
 *
 * So it is down to twenty-eight, and the test applied to every sentence cut
 * was: does the game already say this, at the moment it matters? It did, every
 * time, in almost the same words —
 *
 *   "Some questions tell you far more than others"  -> Sprocket, on the screen
 *      where the child picks a test tool.
 *   "You need the right answer to spot what the robot got wrong"  -> Sprocket,
 *      verbatim, on the screen where they answer.
 *   "come back another day, its problem turns up again later"  -> the end of
 *      the repair drills, where probation is actually explained.
 *
 * Front-loading all three taught nothing and cost the only attention a child
 * arrives with. What is left is the premise, the cast, and three verbs.
 *
 * The grown-up note is untouched and still folded away: it is for the adult in
 * the room, and it is the one reader who came here to read.
 */
export function Guide({
  mode,
  onDone,
}: {
  /** "start" is the first screen of the game; "overlay" sits over the bench. */
  mode: "start" | "overlay";
  onDone: () => void;
}) {
  const [showAdult, setShowAdult] = useState(false);
  const cast = BUGS.slice(0, 13).map((b) => b.id);

  const body = (
    <div className="guide">
      <div className="guide-head">
        <Sprocket size={86} />
        <div>
          <h1 className="guide-title">Glitch Lab</h1>
          <p className="guide-hook">
            Thirteen robots. Each one gets math wrong the <b>same way every time</b>.
          </p>
        </div>
      </div>

      <div className="cast">
        {cast.map((id) => (
          <Bot key={id} character={id} eyes="idle" showTell size={46} />
        ))}
      </div>

      {/* Three verbs, in the order they happen. No sub-lines: a sentence
          explaining a step is a step nobody read. */}
      <ol className="steps-3">
        <li>
          <span className="step-no">1</span>
          <b>Give a robot a problem.</b>
        </li>
        <li>
          <span className="step-no">2</span>
          <b>Answer it yourself.</b>
        </li>
        <li>
          <span className="step-no">3</span>
          <b>Say what it does wrong, then fix it.</b>
        </li>
      </ol>

      <button className="btn ghost sm" onClick={() => setShowAdult((v) => !v)}>
        {showAdult ? "Hide the grown-up note" : "Note for a grown-up"}
      </button>

      {showAdult && (
        <div className="parent-note">
          <div className="pn-head">For a grown-up</div>
          <p>
            Children's arithmetic mistakes are mostly not slips. They are consistent broken
            procedures — a child who takes the smaller digit from the larger one does it in
            every column, every time. Most practice apps see a wrong answer and lower the
            difficulty, which is backwards: that child does not need easier problems, they
            need the bug named.
          </p>
          <p>
            Here each robot runs one of thirteen such procedures, and the suspect board is a
            real posterior over all thirteen, updated on every answer. Nothing is guessed and
            nothing is sent anywhere — it all runs on this device.
          </p>
        </div>
      )}

      <div className="guide-go">
        <button className="btn" onClick={onDone}>
          {mode === "start" ? "Open the lab →" : "Got it"}
        </button>
      </div>
    </div>
  );

  if (mode === "start") return <main className="panel">{body}</main>;
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="How to play">
      <main className="panel guide-modal">{body}</main>
    </div>
  );
}
