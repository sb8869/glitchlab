import { BUGS } from "../../bugs/library.ts";
import { getRecord, type LearnerState } from "../../learner/index.ts";
import { SKINS } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";

const BAND_NAME: Record<string, string> = {
  place_value: "place value",
  add_regroup: "addition",
  sub_regroup: "subtraction",
  fraction_number: "fractions",
};

/**
 * The bench. Three shelves, and the shelf a robot sits on is the whole story:
 * glitching robots keep their tell, robots waiting on a retest have lost the
 * tell but are not signed off, and repaired robots are plain and checked.
 */
export function Bay({
  learner,
  onOpen,
  onNextSession,
  onLog,
}: {
  learner: LearnerState;
  onOpen: (bugId: string) => void;
  onNextSession: () => void;
  onLog: () => void;
}) {
  const by = (want: string[]) =>
    BUGS.filter((b) => want.includes(getRecord(learner, b.id).state)).map((b) => b.id);

  const glitching = by(["unseen", "diagnosed"]);
  const probation = by(["probation"]);
  const repaired = by(["repaired"]);
  /*
   * The bench is clear when nothing is glitching and nothing is on probation.
   * That is the end of the game and it has to look like one: an empty
   * "Glitching · 0" shelf reads as a bug, not as a finish.
   */
  const clear = glitching.length === 0 && probation.length === 0 && repaired.length > 0;

  return (
    <main className="panel bay">
      <div className="say">
        <Bot character="sprocket" eyes={clear ? "celebrating" : "idle"} showTell={false} size={64} />
        <div className="bubble">
          <div className="line">
            {clear ? "The bench is clear." : "Who's on the bench today?"}
          </div>
          <div className="quiet">
            {clear ? (
              <>
                All {repaired.length} of them came back days later and got it right anyway.
                That is the part that counts.
              </>
            ) : (
              <>
                {glitching.length} glitching. {probation.length} waiting for a retest.{" "}
                {repaired.length} done.
              </>
            )}
          </div>
        </div>
      </div>

      {clear && (
        <section className="allclear">
          <span className="clear-stamp">EVERY ROBOT REPAIRED</span>
          <p className="log-sub">
            Not one of them was signed off on a streak. Each one sat on the bench for two
            sessions first, then had its own problem slipped back into ordinary work — and
            passed it then.
          </p>
        </section>
      )}

      {glitching.length > 0 && (
        <Shelf
          title="Glitching"
          hint="pick one to open up"
          tone="bad"
          ids={glitching}
          onOpen={onOpen}
          tell
        />
      )}

      {/*
        The probation shelf is INERT on purpose. It used to say "one is due
        now", relabel the due robot "retest due", and let the child click it —
        which handed them the answer to the only question the retest asks:
        which procedure is being checked. A child who knows that can prime for
        it, and "got it right when they saw it coming" is exactly what the
        streak already measured and what this mechanic exists to stop
        trusting. Seeing that robots are waiting is honest; saying which one
        is up, or letting them take the probe deliberately, is not.
      */}
      {probation.length > 0 && (
        <Shelf
          title="Waiting on a retest"
          hint="the problem comes back later"
          tone="warn"
          ids={probation}
          dashed
        />
      )}

      {repaired.length > 0 && (
        <Shelf title="Repaired" hint="the retest held" tone="good" ids={repaired} eyes="celebrating" />
      )}

      <div className="bay-actions">
        <button className="btn sm ghost" onClick={onLog}>
          Repair log
        </button>
        {/*
          A session boundary is a real visit in the shipped game. This button
          exists so the delayed retest can be seen inside a three-minute demo
          without waiting two days for it, and it is labeled as what it is.
        */}
        {!clear && (
          <button className="btn sm" onClick={onNextSession}>
            Close up for today →
          </button>
        )}
      </div>
    </main>
  );
}

function Shelf({
  title,
  hint,
  tone,
  ids,
  onOpen,
  tell = false,
  dashed = false,
  eyes = "idle",
}: {
  title: string;
  hint: string;
  tone: "bad" | "warn" | "good";
  ids: string[];
  onOpen?: (bugId: string) => void;
  tell?: boolean;
  dashed?: boolean;
  eyes?: "idle" | "celebrating";
}) {
  return (
    <section className={`shelf ${tone}${dashed ? " dashed" : ""}`}>
      <div className="shelf-head">
        <span className={`shelf-tag ${tone}`}>{title} · {ids.length}</span>
        <span className="shelf-hint">{hint}</span>
      </div>
      <div className="shelf-row">
        {ids.map((id) => {
          const skin = SKINS[id]!;
          const bug = BUGS.find((b) => b.id === id)!;
          return (
            <button
              key={id}
              className={`bot-card${onOpen ? " open" : ""}`}
              onClick={onOpen ? () => onOpen(id) : undefined}
              disabled={!onOpen}
            >
              <Bot character={id} eyes={eyes} showTell={tell} size={72} />
              <span className="bot-name">{skin.name}</span>
              <span className="bot-band">{BAND_NAME[bug.band]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
