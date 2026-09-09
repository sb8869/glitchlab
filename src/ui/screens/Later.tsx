import { Bot } from "../components/Bot.tsx";

/**
 * The gap between sessions, made visible.
 *
 * The whole mastery rule rests on delay being real: a robot is not repaired
 * until its own problem comes back, unannounced, a few sessions later. That gap
 * used to be invisible — a button called "Come back later" that immediately
 * dropped you into the next session's warm-up, which reads as arriving rather
 * than as leaving. One beat between the two makes the mechanic legible.
 */
export function Later({
  session,
  waiting,
  onContinue,
}: {
  session: number;
  /** How many robots are on probation. Never which, and never whether one is due. */
  waiting: number;
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
        {/*
          Three nights, filling in one at a time. The delayed retest is the
          whole thesis of this app and this is the screen that carries it, and
          until now it carried it entirely in words on a static card. The marks
          are deliberately unnumbered: the delay is two sessions plus a jitter,
          so "a few" is the honest claim and three dots make it without
          promising a count.
        */}
        <div className="gap-days" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="day-mark" style={{ animationDelay: `${300 + i * 230}ms` }} />
          ))}
        </div>
        <div className="gap-no">Session {session}</div>
        <p className="log-sub">
          {waiting > 0 ? (
            <>
              {waiting === 1 ? "One robot is" : `${waiting} robots are`} waiting on a retest.
              When one comes due, its own problem turns up quietly inside ordinary work — no
              warning, no label.
            </>
          ) : (
            <>
              Nothing is waiting on a retest yet. Get three in a row on a robot and it goes
              back on the bench for a couple of sessions before it counts as fixed.
            </>
          )}
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
