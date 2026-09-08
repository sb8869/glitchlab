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
 * The three steps are the actual loop, in the order it happens, in the words
 * the game itself uses. The grown-up note is folded away, because the thing
 * that makes this app unusual is not something a seven-year-old needs to read.
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
            Thirteen robots do math. Every one of them gets it wrong — and each one gets it
            wrong the <b>same way every time</b>.
          </p>
        </div>
      </div>

      <div className="cast">
        {cast.map((id) => (
          <Bot key={id} character={id} eyes="idle" showTell size={46} />
        ))}
      </div>

      <p className="guide-job">
        Your job is to work out <b>exactly</b> what each one does wrong. Not that it is bad
        at math — what it actually does.
      </p>

      <ol className="steps-3">
        <li>
          <span className="step-no">1</span>
          <div>
            <b>Give it a problem.</b>
            <span>
              Pick a robot, then pick which problem to test it with. Some questions tell you
              far more than others — working out which is half the game.
            </span>
          </div>
        </li>
        <li>
          <span className="step-no">2</span>
          <div>
            <b>Answer it yourself.</b>
            <span>
              You need the right answer to spot what the robot got wrong. Suspects get
              crossed off the board as you go.
            </span>
          </div>
        </li>
        <li>
          <span className="step-no">3</span>
          <div>
            <b>Name the bug, then fix it.</b>
            <span>
              Say what the robot does wrong, teach it, and come back another day — its
              problem turns up again later, and only then is the repair real.
            </span>
          </div>
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
