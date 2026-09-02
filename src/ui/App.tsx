import { useCallback, useMemo, useState } from "react";

import { BUGS } from "../bugs/library.ts";
import { mulberry32 } from "../engine/session.ts";
import {
  beginSession,
  currentBand,
  dueRetests,
  getRecord,
  loadLearner,
  progress,
  recordDiagnosis,
  recordPractice,
  recordRetest,
  saveLearner,
  type LearnerState,
} from "../learner/index.ts";
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
  /** The beat between sessions. `warm` is null when nothing is due back. */
  | { at: "later"; session: number; warm: WarmupData | null; next: string | null }
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
             * The warm-up leads into the robot the child is about to work on,
             * never the one being retested — naming the patient would give the
             * probe away. Fresh problems come from the current rung of the
             * ladder so they really are new material rather than a replay of
             * the case that produced the retest.
             */
            const upNext = BUGS.find((b) => {
              const st = getRecord(next, b.id).state;
              return st === "unseen" || st === "diagnosed";
            });
            const warm =
              dueRetests(next).length > 0 && upNext
                ? buildWarmup(next, currentBand(next), rng)
                : null;
            /*
             * Always show the gap, even when nothing is due. Closing the lab
             * and having the screen not change at all is the same bug in the
             * other direction: time passed and the child could not tell.
             */
            setScreen({
              at: "later",
              session: next.sessionIndex,
              warm,
              next: warm ? upNext!.id : null,
            });
          }}
        />
      )}

      {screen.at === "later" && (
        <Later
          session={screen.session}
          onContinue={() =>
            setScreen(
              screen.warm && screen.next
                ? { at: "warmup", data: screen.warm, next: screen.next }
                : { at: "bay" },
            )
          }
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
        <Outcome results={screen.results} onContinue={() => setScreen({ at: "bay" })} />
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
