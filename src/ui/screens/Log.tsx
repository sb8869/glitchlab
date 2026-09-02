import { BUGS } from "../../bugs/library.ts";
import { BAND_ORDER, type Band } from "../../bugs/types.ts";
import { bandProgress, getRecord, progress, type LearnerState } from "../../learner/index.ts";
import { SKINS } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";

const BAND_LABEL: Record<Band, string> = {
  place_value: "Place value",
  add_regroup: "Addition regrouping",
  sub_regroup: "Subtraction regrouping",
  fraction_number: "Fractions as numbers",
};

/**
 * The repair log. Better than XP because the bar is made of competencies and
 * it is FINITE — thirteen slots, so the child can see the end of the game from
 * the first session.
 */
export function Log({ learner, onBack }: { learner: LearnerState; onBack: () => void }) {
  const p = progress(learner);
  const rungs = [...BAND_ORDER].reverse();

  return (
    <main className="panel">
      <div className="log-head">
        <div>
          <div className="log-count">
            <b>{p.repaired}</b> of {p.total}
          </div>
          <p className="log-sub">
            {p.repaired === 0
              ? `Nothing repaired yet — every slot below is a robot waiting to be worked out. Fill all ${p.total} and the bench is clear. That's the whole game.`
              : p.repaired === p.total
                ? "Every slot is full. There is nothing left on the bench."
                : `When all ${p.total} slots are full, the bench is clear. That's the whole game.`}
          </p>
        </div>
        <button className="btn sm ghost" onClick={onBack}>
          ← Back to the bench
        </button>
      </div>

      <div className="slots-big">
        {BUGS.map((b) => {
          const st = getRecord(learner, b.id).state;
          return (
            <span
              key={b.id}
              className={`big-slot ${st}`}
              title={`${SKINS[b.id]?.name ?? b.id} — ${st}`}
            >
              {st === "repaired" ? <Bot character={b.id} eyes="celebrating" showTell={false} size={34} /> : null}
            </span>
          );
        })}
      </div>

      <div className="legend">
        <span><i className="k repaired" /> repaired</span>
        <span><i className="k probation" /> waiting on a retest</span>
        <span><i className="k diagnosed" /> still glitching</span>
      </div>

      <div className="ladder">
        <div className="ladder-head">The ladder</div>
        <p className="log-sub">Each rung is a kind of math. Every robot lives on one rung.</p>
        {rungs.map((band, i) => {
          const bp = bandProgress(learner, band);
          const done = bp.repaired === bp.total;
          return (
            <div key={band} className={`rung${done ? " done" : ""}`}>
              <span className="rung-no">{rungs.length - i}</span>
              <div className="rung-body">
                <div className="rung-name">{BAND_LABEL[band]}</div>
                <div className="rung-sub">
                  {bp.repaired} of {bp.total} repaired
                </div>
              </div>
              <div className="rung-bots">
                {BUGS.filter((b) => b.band === band).map((b) => (
                  <Bot
                    key={b.id}
                    character={b.id}
                    eyes="idle"
                    showTell={getRecord(learner, b.id).state !== "repaired"}
                    size={40}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
