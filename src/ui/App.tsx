import { useCallback, useMemo, useState } from "react";

import { BUGS } from "../bugs/library.ts";
import { mulberry32 } from "../engine/session.ts";
import {
  beginSession,
  clearLearner,
  createLearner,
  hasSeenGuide,
  markGuideSeen,
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
import { Sprocket } from "./components/Bot.tsx";
import { Peek, peekEnabled } from "./components/Peek.tsx";
import { buildWarmup, type Warmup as WarmupData } from "./game/warmup.ts";
import { Bay } from "./screens/Bay.tsx";
import { Case } from "./screens/Case.tsx";
import { Guide } from "./screens/Guide.tsx";
import { Later } from "./screens/Later.tsx";
import { Log } from "./screens/Log.tsx";
import { Outcome, type RetestOutcome } from "./screens/Outcome.tsx";
import { Warmup } from "./screens/Warmup.tsx";

const TOTAL = BUGS.length;

type Screen =
  | { at: "bay" }
  /** How to play. The first screen of a first session, and nothing after that. */
  | { at: "guide" }
  /** The beat between sessions, carrying the warm-up that opens the next one. */
  | { at: "later"; session: number; waiting: number; warm: WarmupData }
  | { at: "warmup"; data: WarmupData }
  | { at: "outcome"; result: RetestOutcome }
  /** `reopen` when the bug is already known: skip the board, go to the bench. */
  | { at: "case"; bugId: string; reopen: boolean }
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
  /*
   * A first-time player meets the instructions, not the bench. The bench on
   * its own is thirteen robots and no verb — nothing on it says what the game
   * is or what you are meant to do with them.
   */
  const [screen, setScreen] = useState<Screen>(() =>
    hasSeenGuide() ? { at: "bay" } : { at: "guide" },
  );
  /** The same guide, reachable from the bench forever after. */
  const [guideOpen, setGuideOpen] = useState(false);

  const setLearner = useCallback((next: LearnerState) => {
    setLearnerState(next);
    setSaved(saveLearner(next));
  }, []);

  const done = progress(learner);
  const rng = useMemo(() => mulberry32(Date.now() % 100000), []);

  /*
   * Opening a robot opens that robot, and nothing else happens on the way.
   * Retests live in the session warm-up; putting one in front of a case the
   * child chose spent their click on someone else's business.
   *
   * A robot whose bug is already known — cracked open by a failed retest, or
   * left half-drilled — goes straight to the repair bench. Making them
   * re-run a fourteen-suspect diagnosis to rediscover something the app
   * already holds is busywork dressed as a game.
   */
  function openCase(bugId: string) {
    setScreen({ at: "case", bugId, reopen: getRecord(learner, bugId).state === "diagnosed" });
  }

  function finishWarmup(results: RetestOutcome[]) {
    let s = learner;
    for (const r of results) s = recordRetest(s, r.bugId, r.correct).state;
    setLearner(s);
    // At most one, by construction — see buildWarmup.
    setScreen(results[0] ? { at: "outcome", result: results[0] } : { at: "bay" });
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

      {screen.at === "guide" && (
        <Guide
          mode="start"
          onDone={() => {
            markGuideSeen();
            setScreen({ at: "bay" });
          }}
        />
      )}

      {guideOpen && <Guide mode="overlay" onDone={() => setGuideOpen(false)} />}

      {screen.at === "bay" && (
        <Bay
          learner={learner}
          onOpen={openCase}
          onHowToPlay={() => setGuideOpen(true)}
          onLog={() => setScreen({ at: "log" })}
          onStartOver={() => {
            // Wipe and open a fresh lab. Only reachable from the all-repaired
            // screen, behind a confirm, so nothing in progress can be lost.
            clearLearner();
            setLearner(beginSession(createLearner()));
            setScreen({ at: "guide" });
          }}
          onNextSession={() => {
            const next = beginSession(learner);
            setLearner(next);
            /*
             * A day passes, and the next one opens with a warm-up — every
             * time, whether or not a retest is riding in it. That is the
             * point: a warm-up that only appeared when something was due
             * would announce the probe by existing.
             */
            setScreen({
              at: "later",
              session: next.sessionIndex,
              waiting: BUGS.filter((b) => getRecord(next, b.id).state === "probation").length,
              warm: buildWarmup(next, rng),
            });
          }}
        />
      )}

      {screen.at === "later" && (
        <Later
          session={screen.session}
          waiting={screen.waiting}
          onContinue={() => setScreen({ at: "warmup", data: screen.warm })}
        />
      )}

      {screen.at === "warmup" && (
        <Warmup data={screen.data} onDone={finishWarmup} />
      )}

      {screen.at === "outcome" && (
        /* Back to the bench: what to work on next is the child's call. */
        <Outcome result={screen.result} onContinue={() => setScreen({ at: "bay" })} />
      )}

      {screen.at === "case" && (
        <Case
          bugId={screen.bugId}
          reopen={screen.reopen}
          streak={getRecord(learner, screen.bugId).streak}
          onFound={(id) => setLearner(recordDiagnosis(learner, id))}
          onPractice={(id, ok) => setLearner(recordPractice(learner, id, ok))}
          onExit={() => setScreen({ at: "bay" })}
        />
      )}

      {screen.at === "log" && <Log learner={learner} onBack={() => setScreen({ at: "bay" })} />}

      {/* ?peek — playtesting only, and never in a child's way. */}
      {peekEnabled() && (
        <Peek
          learner={learner}
          warm={
            screen.at === "warmup" ? screen.data : screen.at === "later" ? screen.warm : null
          }
        />
      )}
    </div>
  );
}
