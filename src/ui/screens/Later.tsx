import { Bot } from "../components/Bot.tsx";

/**
 * The gap between sessions, made visible.
 *
 * The whole mastery rule rests on delay being real: a robot is not repaired
 * until its own problem comes back, unannounced, two sessions later. That gap
 * used to be invisible — a button called "Come back later" that immediately
 * dropped you into the next session's warm-up, which reads as arriving rather
 * than as leaving. One beat between the two makes the mechanic legible.
 */
export function Later({
  session,
  onContinue,
}: {
  session: number;
  onContinue: () => void;
}) {
  return (
    <main className="panel later">
      <div className="say">
        <Bot character="sprocket" eyes="idle" showTell={false} size={64} />
        <div className="bubble">
          <div className="line">Lab's closed for today.</div>
          <div className="quiet">Nothing gets fixed by staring at it longer.</div>
        </div>
      </div>

      <div className="gap">
        <span className="gap-stamp">A FEW DAYS LATER</span>
        <div className="gap-no">Session {session}</div>
        <p className="log-sub">
          Some of the robots on the bench are waiting on a retest. When one comes due, its
          own problem turns up quietly inside ordinary work — no warning, no label.
        </p>
      </div>

      <button className="btn" onClick={onContinue}>
        Open the lab →
      </button>

      {/*
        Said out loud because it is a demo affordance, not a fiction we are
        trying to sell: in the shipped game these are real days apart.
      */}
      <p className="aside">
        In the real thing this is a different day. Here it is a button, so the delayed
        retest fits inside a demo.
      </p>
    </main>
  );
}
