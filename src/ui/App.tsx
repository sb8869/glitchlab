import { useCallback, useMemo, useState } from "react";

import { BUGS } from "../bugs/library.ts";
import { mulberry32 } from "../engine/session.ts";
import {
  beginSession,
  currentBand,
  getRecord,
  loadLearner,
  progress,
  recordDiagnosis,
  recordPractice,
  recordRetest,
  saveLearner,
  type LearnerState,
} from "../learner/index.ts";
import { SKINS } from "./assets/palette.ts";
import { Sprocket } from "./components/Bot.tsx";
import { buildWarmup, type Warmup as WarmupData } from "./game/warmup.ts";
import { Bay } from "./screens/Bay.tsx";
import { Case } from "./screens/Case.tsx";
import { Later } from "./screens/Later.tsx";
import { Log } from "./screens/Log.tsx";
import { Outcome, type RetestOutcome } from "./screens/Outcome.tsx";
import { Warmup } from "./screens/Warmup.tsx";

const TOTAL = BUGS.length;

type Screen =
  | { at: "bay" }
  /** The beat between sessions. */
  | { at: "later"; session: number; waiting: number }
  | { at: "warmup"; data: WarmupData; next: string }
  | { at: "outcome"; results: RetestOutcome[]; next: string }
  | { at: "case"; bugId: string }
  | { at: "log" };

export function App() {
  /*
   * One learner, persisted on every change. The mastery rule spans sessions,
   * so the state that carries it has to outlive a page load.
   */
  const [learner, setLearnerState] = useState<LearnerState>(() => {
    const loaded = loadLearner();
    return loaded.sessionIndex === 0 ? beginSession(loaded) : loaded;
  });
  const [saved, setSaved] = useState(true);
  const [screen, setScreen] = useState<Screen>({ at: "bay" });

  const setLearner = useCallback((next: LearnerState) => {
    setLearnerState(next);
    setSaved(saveLearner(next));
  }, []);

  const done = progress(learner);
  const rng = useMemo(() => mulberry32(Date.now() % 100000), []);

  function openCase(bugId: string) {
    // A due retest is served first, hidden inside ordinary warm-up problems
    // drawn from the current rung rather than from this robot's own band.
    const warm = buildWarmup(learner, currentBand(learner), rng);
    setScreen(warm ? { at: "warmup", data: warm, next: bugId } : { at: "case", bugId });
  }

  function finishWarmup(results: RetestOutcome[], next: string) {
    let s = learner;
    for (const r of results) s = recordRetest(s, r.bugId, r.correct).state;
    setLearner(s);
    setScreen(results.length > 0 ? { at: "outcome", results, next } : { at: "case", bugId: next });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Sprocket size={44} />
          <span className="brand-name">Glitch Lab</span>
        </div>
        <div className="tally">
          <div className="slots">
            {BUGS.map((b) => {
              const st = getRecord(learner, b.id).state;
              return (
                <span
                  key={b.id}
                  className={`slot${st === "repaired" ? " fixed" : st === "probation" ? " prob" : ""}`}
                />
              );
            })}
          </div>
          <span className={`tally-label${saved ? "" : " warn"}`}>
            {saved ? `${done.repaired} / ${TOTAL} fixed` : "not saving"}
          </span>
        </div>
      </header>

      {!saved && (
        <div className="notice">
          <b>Progress can't be saved on this device right now.</b>
          <span>
            You can still play everything. Repairs will be forgotten when this tab closes —
            usually because the browser is in private mode or storage is full.
          </span>
        </div>
      )}

      {screen.at === "bay" && (
        <Bay
          learner={learner}
          onOpen={openCase}
          onLog={() => setScreen({ at: "log" })}
          onNextSession={() => {
            const next = beginSession(learner);
            setLearner(next);
            /*
             * Closing up advances the clock and NOTHING ELSE.
             *
             * This used to build a warm-up here too, which meant inventing a
             * robot for it to lead into — the child had not picked one yet, so
             * it named whichever was first on the bench and then walked them
             * into that case. A warm-up belongs to a case the child chose. A
             * due retest surfaces on its own the next time they open one.
             */
            setScreen({
              at: "later",
              session: next.sessionIndex,
              waiting: BUGS.filter((b) => getRecord(next, b.id).state === "probation").length,
            });
          }}
        />
      )}

      {screen.at === "later" && (
        <Later
          session={screen.session}
          waiting={screen.waiting}
          onContinue={() => setScreen({ at: "bay" })}
        />
      )}

      {screen.at === "warmup" && (
        <Warmup
          data={screen.data}
          nextBugId={screen.next}
          onDone={(results) => finishWarmup(results, screen.next)}
        />
      )}

      {screen.at === "outcome" && (
        /*
         * On to the robot the child actually picked. The retest rode along
         * inside their warm-up; it was never what they came here to do, and
         * dropping them back at the bench threw their choice away.
         */
        <Outcome
          results={screen.results}
          nextName={SKINS[screen.next]?.name ?? null}
          onContinue={() => setScreen({ at: "case", bugId: screen.next })}
        />
      )}

      {screen.at === "case" && (
        <Case
          bugId={screen.bugId}
          streak={getRecord(learner, screen.bugId).streak}
          onFound={(id) => setLearner(recordDiagnosis(learner, id))}
          onPractice={(id, ok) => setLearner(recordPractice(learner, id, ok))}
          onExit={() => setScreen({ at: "bay" })}
        />
      )}

      {screen.at === "log" && <Log learner={learner} onBack={() => setScreen({ at: "bay" })} />}
    </div>
  );
}
