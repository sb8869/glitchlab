import { useMemo, useState } from "react";

import { bugById } from "../bugs/library.ts";
import { itemLabel } from "../bugs/procedures.ts";
import type { Item } from "../bugs/types.ts";
import { CORRECT } from "../engine/infer.ts";
import { loadLearner, progress } from "../learner/index.ts";
import { Bot, Sprocket } from "./components/Bot.tsx";
import { SuspectBoard } from "./components/SuspectBoard.tsx";
import { SKINS } from "./assets/palette.ts";
import {
  canAccuse,
  leadingSuspect,
  offerTests,
  recordChildAnswer,
  runTest,
  startGame,
  suspectCount,
  type GameState,
} from "./game/session.ts";
import type { EyeState } from "./assets/palette.ts";

/** The flagship case: the bug the whole submission is built around. */
const PATIENT = "sub_smaller_from_larger";

type Phase = "meet" | "choose" | "answer" | "compare" | "repaired";

export function App() {
  const [game, setGame] = useState<GameState>(() => startGame(PATIENT));
  const [phase, setPhase] = useState<Phase>("meet");
  const [childInput, setChildInput] = useState("");
  const [missedGuess, setMissedGuess] = useState<string | null>(null);

  const learner = useMemo(() => loadLearner(), []);
  const done = progress(learner);

  const skin = SKINS[game.patientBugId]!;
  const bug = bugById(game.patientBugId);
  const last = game.history[game.history.length - 1] ?? null;
  const tests = useMemo(
    () => (phase === "choose" ? offerTests(game) : []),
    [game, phase],
  );

  const solved = phase === "repaired";
  const sprocketEyes: EyeState = solved
    ? "celebrating"
    : missedGuess || last?.childWasRight === false
      ? "thinking"
      : "idle";

  function chooseTest(item: Item) {
    setGame(runTest(game, item));
    setChildInput("");
    setPhase("answer");
  }

  function submitAnswer() {
    setGame(recordChildAnswer(game, childInput.trim()));
    setPhase("compare");
  }

  function accuse(bugId: string) {
    if (bugId === game.patientBugId) {
      setMissedGuess(null);
      setPhase("repaired");
    } else {
      setMissedGuess(bugId);
    }
  }

  function restart() {
    setGame(startGame(PATIENT));
    setPhase("meet");
    setChildInput("");
    setMissedGuess(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Sprocket size={34} />
          Glitch Lab
        </div>
        <div className="spacer" />
        <div className="progress-pill">
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${done.fraction * 100}%` }} />
          </div>
          {done.repaired} of {done.total} robots repaired
        </div>
      </header>

      <div className="stage">
        <main className="card">
          <Say eyes={sprocketEyes}>
            {phase === "meet" && (
              <>
                This is <b>{skin.name}</b>. Something in there is glitching.
                <span className="quiet">Your job is to work out exactly what it does wrong.</span>
              </>
            )}
            {phase === "choose" && (
              <>
                Pick a problem to test {skin.name} with.
                <span className="quiet">Some tests rule out far more suspects than others.</span>
              </>
            )}
            {phase === "answer" && last && (
              <>
                {skin.name} says <b>{last.robotAnswer}</b>. What should it really be?
                <span className="quiet">You need the right answer to spot what it got wrong.</span>
              </>
            )}
            {phase === "compare" && last && (
              <>
                {last.childWasRight
                  ? `Good — so ${skin.name} is off in a very particular way.`
                  : `Let's check that one together. ${itemLabel(last.item)} is ${last.correctAnswer}.`}
                <span className="quiet">
                  {last.suspectsBefore - last.suspectsAfter > 0
                    ? `That test ruled out ${last.suspectsBefore - last.suspectsAfter} suspects.`
                    : "That test didn't rule anything out. Some don't."}
                </span>
              </>
            )}
            {phase === "repaired" && (
              <>
                Found it. {skin.name} <b>{bug.childLabel.toLowerCase()}</b>.
                <span className="quiet">Every single time — that is what made it findable.</span>
              </>
            )}
          </Say>

          <div className="patient">
            <Bot
              character={game.patientBugId}
              eyes={solved ? "celebrating" : "idle"}
              showTell={!solved}
              size={168}
            />
            <div className="patient-name">{skin.name}</div>
            <div className={`patient-status${solved ? " fixed" : ""}`}>
              {solved ? "bug found" : "glitching"}
            </div>
          </div>

          {phase === "meet" && (
            <div style={{ textAlign: "center" }}>
              <button className="btn" onClick={() => setPhase("choose")}>
                Open it up
              </button>
            </div>
          )}

          {phase === "choose" && (
            <>
              <p className="card-title">Choose a test</p>
              <div className="tests">
                {tests.map((item) => (
                  <button key={item.id} className="test-btn" onClick={() => chooseTest(item)}>
                    {/* Deliberately unlabeled. One of these tests cannot
                        separate the remaining suspects at all, and finding
                        that out afterward is the numeracy work. */}
                    <span className="problem">{itemLabel(item)}</span>
                  </button>
                ))}
              </div>
            </>
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
              <div className="answer-row">
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
                <button className="btn" disabled={!childInput.trim()} onClick={submitAnswer}>
                  That's the answer
                </button>
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

              <div className="badge-row">
                <span className={`badge ${last.childWasRight ? "win" : ""}`}>
                  {last.childWasRight ? "You had it right" : `You said ${last.childAnswer}`}
                </span>
                <span className="badge">
                  {suspectCount(game.posterior)} suspects left
                </span>
              </div>

              <div style={{ textAlign: "center", marginTop: 18 }}>
                {canAccuse(game) ? (
                  <>
                    <button
                      className="btn accent"
                      onClick={() => accuse(leadingSuspect(game).id)}
                    >
                      I know what's wrong with {skin.name}
                    </button>
                    <p className="hint" style={{ color: "var(--ink-faint)", fontSize: 13, marginTop: 10 }}>
                      or pick any suspect on the right
                    </p>
                  </>
                ) : (
                  <button className="btn" onClick={() => setPhase("choose")}>
                    Run another test
                  </button>
                )}
              </div>

              {missedGuess && (
                <p style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 700, marginTop: 12 }}>
                  Not that one — {skin.name} would have answered differently. Keep looking.
                </p>
              )}
            </>
          )}

          {phase === "repaired" && (
            <div className="repair">
              <div className="found">The bug, named</div>
              <h2 className="bugname">{bug.childLabel}</h2>
              <div className="proof">
                <span>{itemLabel(last!.item)}</span>
                <span className="bad">{skin.name}: {last!.robotAnswer}</span>
                <span className="ok">Really: {last!.correctAnswer}</span>
              </div>
              <div className="badge-row">
                <span className="badge win">Found in {game.history.length} tests</span>
                <span className="badge warn">Not repaired yet</span>
              </div>
              <p style={{ color: "var(--ink-soft)", fontWeight: 600, maxWidth: "46ch", margin: "14px auto 0" }}>
                Finding the bug is not fixing it. {skin.name} comes back in a couple of
                sessions with this exact problem mixed into new work. Get it right then and
                the repair sticks.
              </p>
              <div style={{ marginTop: 18 }}>
                <button className="btn ghost" onClick={restart}>
                  Start over
                </button>
              </div>
            </div>
          )}

          {game.history.length > 0 && phase !== "meet" && (
            <>
              <p className="card-title" style={{ marginTop: 26 }}>Tests run</p>
              <div className="timeline">
                {game.history.map((h, i) => {
                  const dropped = h.suspectsBefore - h.suspectsAfter;
                  return (
                    <div className="tl-row" key={`${h.item.id}-${i}`}>
                      <span className="eq">{itemLabel(h.item)}</span>
                      <span className="arrow">→ {h.robotAnswer}</span>
                      <span className={`drop${dropped > 0 ? " good" : ""}`}>
                        {dropped > 0 ? `ruled out ${dropped}` : "no new information"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>

        <SuspectBoard
          posterior={game.posterior}
          onAccuse={phase === "compare" || phase === "repaired" ? accuse : undefined}
        />
      </div>
    </div>
  );
}

function Say({ eyes, children }: { eyes: EyeState; children: React.ReactNode }) {
  return (
    <div className="say">
      <Sprocket eyes={eyes} size={62} />
      <div className="bubble">{children}</div>
    </div>
  );
}
