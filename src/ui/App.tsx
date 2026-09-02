import { useMemo, useState } from "react";

import { bugById } from "../bugs/library.ts";
import { itemLabel } from "../bugs/procedures.ts";
import type { Item } from "../bugs/types.ts";
import { loadLearner, progress } from "../learner/index.ts";
import { Bot, Sprocket } from "./components/Bot.tsx";
import { SuspectBoard } from "./components/SuspectBoard.tsx";
import { SKINS, type EyeState } from "./assets/palette.ts";
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
} from "./game/session.ts";

/** The flagship case: the bug the whole submission is built around. */
const PATIENT = "sub_smaller_from_larger";
const TOTAL = 13;

type Phase = "meet" | "choose" | "answer" | "compare" | "repaired";

export function App() {
  const [game, setGame] = useState<GameState>(() => startGame(PATIENT));
  const [phase, setPhase] = useState<Phase>("meet");
  const [childInput, setChildInput] = useState("");
  const [missed, setMissed] = useState(false);

  const learner = useMemo(() => loadLearner(), []);
  const done = progress(learner);

  const skin = SKINS[game.patientBugId]!;
  const bug = bugById(game.patientBugId);
  const last = game.history[game.history.length - 1] ?? null;
  const tests = useMemo(() => (phase === "choose" ? offerTests(game) : []), [game, phase]);

  const solved = phase === "repaired";
  const tied = isTied(game.posterior);
  const tieHint = useMemo(() => {
    if (!tied) return null;
    const live = liveSuspects(game.posterior).filter((s) => s.p >= 0.02);
    const a = live[0]?.id;
    const b = live[1]?.id;
    if (!a || !b) return null;
    const item = splittingTest(game, a, b);
    return item ? itemLabel(item) : null;
  }, [game, tied]);

  const sprocketEyes: EyeState = solved
    ? "celebrating"
    : missed || last?.childWasRight === false
      ? "thinking"
      : "idle";

  function chooseTest(item: Item) {
    setGame(runTest(game, item));
    setChildInput("");
    setMissed(false);
    setPhase("answer");
  }
  function submitAnswer() {
    setGame(recordChildAnswer(game, childInput.trim()));
    setPhase("compare");
  }
  function accuse(bugId: string) {
    if (bugId === game.patientBugId) {
      setMissed(false);
      setPhase("repaired");
    } else {
      setMissed(true);
    }
  }
  function restart() {
    setGame(startGame(PATIENT));
    setPhase("meet");
    setChildInput("");
    setMissed(false);
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
            {Array.from({ length: TOTAL }, (_, i) => (
              <span key={i} className={`slot${i < done.repaired ? " fixed" : ""}`} />
            ))}
          </div>
          <span className="tally-label">
            {done.repaired} / {TOTAL} fixed
          </span>
        </div>
      </header>

      <div className="stage">
        <main className="panel">
          <Say eyes={sprocketEyes}>
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
                  {skin.name} says {last.robotAnswer}. What should it really be?
                </div>
                <div className="quiet">You need the right answer to spot what it got wrong.</div>
              </>
            )}
            {phase === "compare" && last && (
              <>
                <div className="line">
                  {missed
                    ? `Not that one — ${skin.name} would have answered differently.`
                    : last.childWasRight
                      ? `Good — so ${skin.name} is off in a very particular way.`
                      : `Let's check that one together. ${itemLabel(last.item)} is ${last.correctAnswer}.`}
                </div>
                <div className="quiet">
                  {tied
                    ? "Two suspects left, and they're tied."
                    : last.suspectsBefore - last.suspectsAfter > 0
                      ? `That test ruled out ${last.suspectsBefore - last.suspectsAfter} suspects.`
                      : "That test didn't rule anything out. Some don't."}
                </div>
              </>
            )}
            {phase === "repaired" && (
              <>
                <div className="line">
                  Found it. {skin.name} {bug.childLabel.toLowerCase()}.
                </div>
                <div className="quiet">Every single time — that is what made it findable.</div>
              </>
            )}
          </Say>

          {phase !== "repaired" && (
            <div className="bench-wrap">
              <div className="spotlight" />
              <div className="patient">
                <Bot character={game.patientBugId} eyes="idle" showTell size={260} />
              </div>
              <div className="bench">
                <span className="nameplate">{skin.name.toUpperCase()}</span>
              </div>
              <span className="status">glitching</span>
            </div>
          )}

          {phase === "meet" && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn" onClick={() => setPhase("choose")}>
                Open it up!
              </button>
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

          {phase === "answer" && last && (
            <>
              <div className="readout">
                <div className="slate">
                  <div className="label">Problem</div>
                  <div className="value">{itemLabel(last.item)}</div>
                </div>
                <div className="slate robot">
                  <div className="label">{skin.name} says</div>
                  <div className="value">{last.robotAnswer}</div>
                </div>
              </div>
              <div className="tray">
                <span className="tray-head">YOUR TURN · WHAT IS IT REALLY?</span>
                <div className="answer-tray">
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={childInput}
                    placeholder="?"
                    onChange={(e) => setChildInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && childInput.trim()) submitAnswer();
                    }}
                    aria-label="The correct answer"
                  />
                  <button className="btn sm" disabled={!childInput.trim()} onClick={submitAnswer}>
                    That's it!
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === "compare" && last && (
            <>
              <div className="readout">
                <div className="slate">
                  <div className="label">Problem</div>
                  <div className="value">{itemLabel(last.item)}</div>
                </div>
                <div className="slate robot">
                  <div className="label">{skin.name} says</div>
                  <div className="value">{last.robotAnswer}</div>
                </div>
                <div className="slate truth">
                  <div className="label">Really</div>
                  <div className="value">{last.correctAnswer}</div>
                </div>
              </div>

              <div className="chips">
                <span className={`chip ${last.childWasRight ? "win" : ""}`}>
                  {last.childWasRight ? "You had it right" : `You said ${last.childAnswer}`}
                </span>
                <span className="chip">{suspectCount(game.posterior)} suspects left</span>
                {tied && <span className="chip warn">2 left, tied</span>}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
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

          {phase === "repaired" && last && (
            <div className="repair">
              <div className="patient">
                <Bot character={game.patientBugId} eyes="celebrating" showTell={false} size={190} />
              </div>
              <span className="found">CASE CLOSED</span>
              <h2 className="bugname">{bug.childLabel}</h2>
              <div className="readout">
                <div className="slate">
                  <div className="label">Proof</div>
                  <div className="value">{itemLabel(last.item)}</div>
                </div>
                <div className="slate robot">
                  <div className="label">{skin.name}</div>
                  <div className="value">{last.robotAnswer}</div>
                </div>
                <div className="slate truth">
                  <div className="label">Really</div>
                  <div className="value">{last.correctAnswer}</div>
                </div>
              </div>
              <div className="chips">
                <span className="chip win">Found in {game.history.length} tests</span>
                <span className="chip warn">Not fixed yet</span>
              </div>
              <p className="aside">
                Finding the bug is not fixing it. {skin.name} comes back in a couple of sessions
                with this exact problem mixed into new work. Get it right then and the repair
                sticks.
              </p>
              <button className="btn ghost sm" onClick={restart}>
                Start over
              </button>
            </div>
          )}

          {game.history.length > 0 && phase !== "meet" && (
            <div className="runlog">
              <span className="cap">Tests run</span>
              {game.history.map((h, i) => {
                const dropped = h.suspectsBefore - h.suspectsAfter;
                return (
                  <span className="run" key={`${h.item.id}-${i}`}>
                    {itemLabel(h.item)} → <b className="bad">{h.robotAnswer}</b>
                    <span className="dot">·</span>
                    <span className="out">{dropped > 0 ? `ruled out ${dropped}` : "no news"}</span>
                  </span>
                );
              })}
            </div>
          )}
        </main>

        <SuspectBoard
          posterior={game.posterior}
          onAccuse={phase === "compare" || phase === "repaired" ? accuse : undefined}
          tieHint={tieHint}
          tieAnswer={last?.robotAnswer ?? null}
        />
      </div>
    </div>
  );
}

function Say({ eyes, children }: { eyes: EyeState; children: React.ReactNode }) {
  return (
    <div className="say">
      <Sprocket eyes={eyes} size={64} />
      <div className="bubble">{children}</div>
    </div>
  );
}
