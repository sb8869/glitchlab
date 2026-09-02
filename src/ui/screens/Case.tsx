import { useMemo, useState } from "react";

import { bugById } from "../../bugs/library.ts";
import { correct, itemLabel } from "../../bugs/procedures.ts";
import { traceFor } from "../../remediation/trace.ts";
import { Working } from "../components/Working.tsx";
import {
  AnswerInput,
  answerPrompt,
  answerReady,
  answerStatement,
  answerTrayHead,
} from "../components/AnswerInput.tsx";
import type { Item } from "../../bugs/types.ts";
import { generateForBug } from "../../bugs/generate.ts";
import { STREAK_TO_PROBATION } from "../../learner/index.ts";
import { SKINS, type EyeState } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";
import { Remediation } from "../components/Remediation.tsx";
import { SuspectBoard } from "../components/SuspectBoard.tsx";
import {
  canAccuse,
  isTied,
  leadingSuspect,
  liveSuspects,
  offerTests,
  recordChildAnswer,
  runTest,
  splittingTest,
  startGame,
  suspectCount,
  type GameState,
} from "../game/session.ts";

type Phase = "meet" | "choose" | "answer" | "compare" | "found" | "practice";

/** "1 test", "2 tests" — a seven-year-old notices. */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function Case({
  bugId,
  streak,
  onFound,
  onPractice,
  onExit,
}: {
  bugId: string;
  /** Consecutive correct practice answers so far, from the learner. */
  streak: number;
  onFound: (bugId: string) => void;
  onPractice: (bugId: string, wasCorrect: boolean) => void;
  onExit: () => void;
}) {
  const [game, setGame] = useState<GameState>(() => startGame(bugId));
  const [phase, setPhase] = useState<Phase>("meet");
  const [childInput, setChildInput] = useState("");
  const [missed, setMissed] = useState(false);
  /** Their first answer, when it was not the right one. */
  const [answerMiss, setAnswerMiss] = useState<string | null>(null);
  /*
   * How many times they have missed THIS problem. The first miss is a lesson
   * — the working, with the result left blank — and only the second one hands
   * over the answer. Revealing it immediately turns the moment a child is most
   * ready to be taught into a copying exercise.
   */
  const [misses, setMisses] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceEntry, setPracticeEntry] = useState("");
  const [practiceMiss, setPracticeMiss] = useState(false);
  /** Misses on the CURRENT drill, so the repair drills teach the same way. */
  const [drillMisses, setDrillMisses] = useState(0);

  const skin = SKINS[bugId]!;
  const bug = bugById(bugId);
  const last = game.history[game.history.length - 1] ?? null;
  const tests = useMemo(() => (phase === "choose" ? offerTests(game) : []), [game, phase]);
  // Generated per visit: the drills a child does after finding a bug were
  // otherwise the same six problems every time they met that robot.
  const drills = useMemo(() => generateForBug(bugId, game.seed, 8), [bugId, game.seed]);
  const drill: Item | undefined = drills[practiceIndex % Math.max(1, drills.length)];

  const tied = isTied(game.posterior);
  const tieHint = useMemo(() => {
    if (!tied) return null;
    const live = liveSuspects(game.posterior).filter((s) => s.p >= 0.02);
    if (!live[0] || !live[1]) return null;
    const item = splittingTest(game, live[0].id, live[1].id);
    return item ? itemLabel(item) : null;
  }, [game, tied]);

  const done = streak >= STREAK_TO_PROBATION;
  const eyes: EyeState =
    phase === "found" || done
      ? "celebrating"
      : missed || practiceMiss || misses > 0
        ? "thinking"
        : "idle";

  function chooseTest(item: Item) {
    setGame(runTest(game, item));
    setChildInput("");
    setMissed(false);
    setAnswerMiss(null);
    setMisses(0);
    setPhase("answer");
  }

  /*
   * Sprocket says you need the right answer to spot what the robot got wrong,
   * so the case cannot close on an answer the child never produced. A miss
   * shows them the truth and asks them to write it in; their original answer
   * is what gets recorded, because that is what they actually knew.
   */
  function submitChildAnswer(raw: string = childInput) {
    if (!last) return;
    const value = raw.trim();
    if (!answerReady(last.item, value)) return;
    const right = value === last.correctAnswer;

    if (!right) {
      // Their FIRST answer is the one that gets recorded — that is what they
      // actually knew before being taught anything.
      if (answerMiss === null) setAnswerMiss(value);
      setMisses(misses + 1);
      setChildInput("");
      return;
    }

    setGame(recordChildAnswer(game, answerMiss ?? value));
    setPhase("compare");
  }
  function accuse(id: string) {
    if (id === bugId) {
      onFound(bugId);
      setMissed(false);
      setPhase("found");
    } else setMissed(true);
  }
  function submitDrill(raw: string = practiceEntry) {
    if (!drill) return;
    if (!answerReady(drill, raw)) return;
    const ok = raw.trim() === correct(drill);
    // Only the first attempt at a drill counts toward the streak. After that
    // they have been shown the working, so getting it right proves nothing
    // about what they knew — and getting it wrong again should not punish
    // them twice for one gap.
    if (drillMisses === 0) onPractice(bugId, ok);
    setPracticeMiss(!ok);
    setPracticeEntry("");
    if (ok) {
      setPracticeIndex(practiceIndex + 1);
      setDrillMisses(0);
    } else {
      setDrillMisses(drillMisses + 1);
    }
  }

  return (
    <div className="stage">
      <main className="panel">
        <div className="say">
          <Bot character="sprocket" eyes={eyes} showTell={false} size={64} />
          <div className="bubble">
            {phase === "meet" && (
              <>
                <div className="line">This is {skin.name}. Something in there is glitching.</div>
                <div className="quiet">Your job: work out exactly what it does wrong.</div>
              </>
            )}
            {phase === "choose" && (
              <>
                <div className="line">Pick a problem to test {skin.name} with.</div>
                <div className="quiet">Some tests rule out far more suspects than others.</div>
              </>
            )}
            {phase === "answer" && last && (
              <>
                <div className="line">
                  {misses === 0
                    ? `${skin.name} says ${last.robotAnswer}. ${answerPrompt(last.item)}`
                    : misses === 1
                      ? "Not quite. Let's do it together."
                      : `${answerStatement(last.item, itemLabel(last.item), last.correctAnswer)}.`}
                </div>
                <div className="quiet">
                  {misses === 0
                    ? "You need the right answer to spot what it got wrong."
                    : misses === 1
                      ? "Here's how this one goes. Follow it through and tell me what you get."
                      : "Now you've seen it worked out. Write it in and we'll carry on."}
                </div>
              </>
            )}
            {phase === "compare" && last && (
              <>
                <div className="line">
                  {missed
                    ? `Not that one — ${skin.name} would have answered differently.`
                    : last.childWasRight
                      ? `Good — so ${skin.name} is off in a very particular way.`
                      : `Let's check that together. ${answerStatement(last.item, itemLabel(last.item), last.correctAnswer)}.`}
                </div>
                <div className="quiet">
                  {/*
                    A test with lower expected gain can still resolve the board
                    outright, because gain is an average over answers the robot
                    might give and this one landed on a bucket nobody shares.
                    Naming that turns a lucky pick into something the child can
                    learn from instead of an unremarked shortcut.
                  */}
                  {last.suspectsAfter === 1 && last.suspectsBefore > 2
                    ? "That one was sharper than it looked — it split them in one."
                    : tied
                      ? "Two suspects left, and they're tied."
                      : last.suspectsBefore - last.suspectsAfter > 0
                        ? `That test ruled out ${plural(last.suspectsBefore - last.suspectsAfter, "suspect")}.`
                        : "That test didn't rule anything out. Some don't."}
                </div>
              </>
            )}
            {phase === "found" && (
              <>
                <div className="line">
                  Found it. {skin.name} {bug.childLabel.toLowerCase()}.
                </div>
                <div className="quiet">Every single time — that is what made it findable.</div>
              </>
            )}
            {phase === "practice" && (
              <>
                <div className="line">
                  {done
                    ? `${skin.name} is holding together. Good.`
                    : practiceMiss
                      ? drillMisses > 1
                        ? "Here it is worked out. Try it once more."
                        : "Close. Let's do it together."
                      : `Now show ${skin.name} how it's done.`}
                </div>
                <div className="quiet">
                  {done
                    ? "It looks fixed — but looking fixed isn't fixed."
                    : `${streak} of ${STREAK_TO_PROBATION} in a row.`}
                </div>
              </>
            )}
          </div>
        </div>

        {phase !== "found" && phase !== "practice" && (
          <div className="bench-wrap">
            <div className="spotlight" />
            <div className="patient">
              <Bot character={bugId} eyes="idle" showTell size={260} />
            </div>
            <div className="bench">
              <span className="nameplate">{skin.name.toUpperCase()}</span>
            </div>
            <span className="status">glitching</span>
          </div>
        )}

        {phase === "meet" && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn" onClick={() => setPhase("choose")}>Open it up!</button>
          </div>
        )}

        {phase === "choose" && (
          <div className="tray">
            <span className="tray-head">YOUR TURN · PICK A TEST TOOL</span>
            <div className="tools">
              {tests.map((item) => (
                <button key={item.id} className="tool" onClick={() => chooseTest(item)}>
                  {itemLabel(item)}
                </button>
              ))}
            </div>
          </div>
        )}

        {(phase === "answer" || phase === "compare") && last && (
          <div className="readout">
            <div className="slate">
              <div className="label">Problem</div>
              <div className="value">{itemLabel(last.item)}</div>
            </div>
            <div className="slate robot">
              <div className="label">{skin.name} says</div>
              <div className="value">{last.robotAnswer}</div>
            </div>
            {phase === "compare" && (
              <div className="slate truth">
                <div className="label">Really</div>
                <div className="value">{last.correctAnswer}</div>
              </div>
            )}
          </div>
        )}

        {/*
          The teaching moment. A child who has just got this wrong is as ready
          to be shown the procedure as they will ever be, so the first miss
          gets the working — every borrow and carry, computed — with the result
          left blank. The second miss fills the result in, so nobody can be
          stuck; but by then they have already seen how it is done.
        */}
        {phase === "answer" && misses > 0 && last && (
          <div className="teach">
            <div className="chips">
              <span className="chip">You said {answerMiss}</span>
              {misses > 1 && (
                <span className="chip win">
                  {answerStatement(last.item, itemLabel(last.item), last.correctAnswer)}
                </span>
              )}
            </div>
            <Working
              tone="ok"
              cap={misses > 1 ? "How it goes" : "Follow it through"}
              trace={traceFor(last.item, last.correctAnswer, last.robotAnswer, true)}
              problem={itemLabel(last.item)}
              answer={last.correctAnswer}
              blank={misses === 1}
              note="work it out one column at a time"
            />
          </div>
        )}

        {phase === "answer" && (
          <div className="tray">
            <span className="tray-head">
              {misses === 0
                ? `YOUR TURN · ${last ? answerTrayHead(last.item) : "WHAT IS IT REALLY?"}`
                : misses === 1
                  ? "YOUR TURN · NOW TRY IT AGAIN"
                  : "YOUR TURN · WRITE IT IN AND WE'LL CARRY ON"}
            </span>
            <div className="answer-tray">
              <AnswerInput
                autoFocus
                item={last?.item}
                value={childInput}
                label="The correct answer"
                onChange={setChildInput}
                onSubmit={submitChildAnswer}
              />
              {last?.item.kind !== "fracCompare" && (
                <button
                  className="btn sm"
                  disabled={!answerReady(last?.item, childInput)}
                  onClick={() => submitChildAnswer()}
                >
                  {misses === 0 ? "That's it!" : misses === 1 ? "Try again" : "Write it in"}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "compare" && last && (
          <>
            <div className="chips">
              <span className={`chip ${last.childWasRight ? "win" : ""}`}>
                {last.childWasRight ? "You had it right" : `You said ${last.childAnswer}`}
              </span>
              <span className="chip">{plural(suspectCount(game.posterior), "suspect")} left</span>
              {tied && <span className="chip warn">2 left, tied</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {canAccuse(game) ? (
                <button className="btn" onClick={() => accuse(leadingSuspect(game).id)}>
                  I know what's wrong!
                </button>
              ) : (
                <button className="btn teal" onClick={() => setPhase("choose")}>
                  Run another test
                </button>
              )}
            </div>
          </>
        )}

        {phase === "found" && last && (
          <div className="repair">
            {/*
              The verdict is a banner, not a stage. A full-height celebration
              here pushed the actual teaching — the two methods worked out
              column by column — below the fold, so the one screen built to
              explain the bug was the one screen a child had to scroll to find.
            */}
            <div className="verdict">
              <div className="patient sm">
                <Bot character={bugId} eyes="celebrating" showTell={false} size={110} />
              </div>
              <div className="verdict-text">
                <span className="found">CASE CLOSED</span>
                <h2 className="bugname">{bug.childLabel}</h2>
                <div className="chips">
                  <span className="chip win">Found in {plural(game.history.length, "test")}</span>
                  <span className="chip warn">Not fixed yet</span>
                </div>
              </div>
            </div>
            <Remediation bugId={bugId} />
            <button className="btn" onClick={() => setPhase("practice")}>
              Now fix it
            </button>
          </div>
        )}

        {phase === "practice" && (
          <div className="repair">
            <div className="patient">
              <Bot character={bugId} eyes={done ? "celebrating" : "idle"} showTell={!done} size={170} />
            </div>
            <div className="streak">
              {Array.from({ length: STREAK_TO_PROBATION }, (_, i) => (
                <span key={i} className={`pip${i < streak ? " on" : ""}`} />
              ))}
            </div>

            {done ? (
              <>
                <p className="aside">
                  Three in a row only means it looks fixed. {skin.name} goes back on the bench,
                  and in a couple of sessions this exact problem turns up inside ordinary work.
                  Get it right then and the repair is permanent.
                </p>
                <button className="btn" onClick={onExit}>Back to the bench</button>
              </>
            ) : (
              drill && (
                <div className="tray">
                  <span className="tray-head">YOUR TURN · {STREAK_TO_PROBATION - streak} TO GO</span>
                  {/* Same rule as the diagnosis: a miss is taught, not answered. */}
                  {drillMisses > 0 && (
                    <div className="teach">
                      <Working
                        tone="ok"
                        cap={drillMisses > 1 ? "How it goes" : "Follow it through"}
                        trace={traceFor(drill, correct(drill), correct(drill), true)}
                        problem={itemLabel(drill)}
                        answer={correct(drill)}
                        blank={drillMisses === 1}
                        note="work it out one column at a time"
                      />
                    </div>
                  )}
                  <div className="answer-tray">
                    <span className="practice">
                      {itemLabel(drill)}
                      {drill.kind === "fracCompare" ? " — which is bigger?" : " ="}
                    </span>
                    <AnswerInput
                      autoFocus
                      item={drill}
                      value={practiceEntry}
                      label={`Answer for ${itemLabel(drill)}`}
                      onChange={setPracticeEntry}
                      onSubmit={submitDrill}
                    />
                    {drill.kind !== "fracCompare" && (
                      <button
                        className="btn sm"
                        disabled={!answerReady(drill, practiceEntry)}
                        onClick={() => submitDrill()}
                      >
                        Check
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {game.history.length > 0 && phase !== "meet" && (
          <div className="runlog">
            <span className="cap">Tests run</span>
            {game.history.map((h, i) => (
              <span className="run" key={`${h.item.id}-${i}`}>
                {itemLabel(h.item)} → <b className="bad">{h.robotAnswer}</b>
                <span className="dot">·</span>
                <span className="out">
                  {h.suspectsBefore - h.suspectsAfter > 0
                    ? `ruled out ${h.suspectsBefore - h.suspectsAfter}`
                    : "no news"}
                </span>
              </span>
            ))}
          </div>
        )}
      </main>

      <SuspectBoard
        posterior={game.posterior}
        onAccuse={phase === "compare" ? accuse : undefined}
        tieHint={tieHint}
        tieAnswer={last?.robotAnswer ?? null}
        tieProblem={last ? itemLabel(last.item) : null}
      />
    </div>
  );
}
