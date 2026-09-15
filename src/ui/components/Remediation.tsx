import { useState } from "react";

import { SKINS } from "../assets/palette.ts";
import { bugById } from "../../bugs/library.ts";
import { remediationFor } from "../../remediation/index.ts";
import { exampleItemFor, practiceItemFor } from "../../remediation/example.ts";
import { Working } from "./Working.tsx";
import { traceFor, type Trace } from "../../remediation/trace.ts";
import { AnswerInput, answerReady } from "./AnswerInput.tsx";
import { BANK } from "../../bugs/bank.ts";

/**
 * The screen that teaches, once the bug is known. Every number shown here was
 * computed by the engine, and every sentence around those numbers is held to
 * the validation gate in `remediation/validate.ts` — for all thirteen bugs, in
 * the test suite. Nothing on this screen leaves the device.
 */
export function Remediation({ bugId }: { bugId: string }) {
  const [showParent, setShowParent] = useState(false);
  const [tryAnswer, setTryAnswer] = useState("");
  const [tried, setTried] = useState<null | boolean>(null);
  const r = remediationFor(bugId);
  const name = SKINS[bugId]?.name ?? "The robot";

  /*
   * The working, column by column. A buggy procedure is a procedure, so
   * showing only the two answers hides the thing being taught: WHERE the two
   * methods part company. Every digit, borrow and carry here is computed.
   */
  const exampleItem = exampleItemFor(bugId) ?? BANK.find((i) => i.id === r.example.itemId) ?? null;
  const practiceItem = practiceItemFor(bugId);
  const isRight = (value: string) => value.trim() === r.practice?.correctAnswer;
  const traceOf = (answer: string, against: string, annotate: boolean): Trace =>
    exampleItem ? traceFor(exampleItem, answer, against, annotate) : { kind: "plain" };
  const robotTrace = traceOf(r.example.robotAnswer, r.example.correctAnswer, false);
  const correctTrace = traceOf(r.example.correctAnswer, r.example.robotAnswer, true);

  return (
    <section className="remedy">
      <div className="remedy-head">
        <span className="remedy-tag">SPROCKET EXPLAINS</span>
        <span className="remedy-src">worked out on this device</span>
      </div>

      <p className="remedy-copy">{r.childExplanation}</p>

      <div className="ways">
        <Working
          tone="bad"
          cap={`${name}'s way`}
          trace={robotTrace}
          problem={r.example.problem}
          answer={r.example.robotAnswer}
          /*
           * The robot's caption is the bug's own words. Narrating its columns
           * the way the correct side does would mean inventing a reason for
           * each digit, and a made-up reason is exactly what this whole layer
           * is built to avoid.
           */
          note={bugById(bugId).childLabel}
        />
        <Working
          tone="ok"
          cap="Really"
          trace={correctTrace}
          problem={r.example.problem}
          answer={r.example.correctAnswer}
        />
      </div>

      {r.practice && (
        <div className="tray">
          <span className="tray-head">YOUR TURN · NOW YOU TRY</span>
          <div className="answer-tray">
            <span className="practice">
              {r.practice.problem}
              {practiceItem?.kind === "fracCompare" ? " — which is bigger?" : " ="}
            </span>
            <AnswerInput
              item={practiceItem}
              value={tryAnswer}
              label="Your answer"
              onChange={(next) => {
                setTryAnswer(next);
                setTried(null);
              }}
              onSubmit={(value) => setTried(isRight(value))}
            />
            {practiceItem?.kind !== "fracCompare" && (
              <button
                className="btn sm"
                disabled={!answerReady(practiceItem, tryAnswer)}
                onClick={() => setTried(isRight(tryAnswer))}
              >
                Check
              </button>
            )}
            {tried !== null && (
              <span className={`chip ${tried ? "win" : ""}`}>
                {/* Never a scold: a miss is a nudge back to the counterexample. */}
                {tried ? "That's it" : `Not yet — look at ${r.example.problem} again`}
              </span>
            )}
          </div>
        </div>
      )}

      <button className="btn ghost sm" onClick={() => setShowParent((v) => !v)}>
        {showParent ? "Hide the grown-up note" : "Note for a grown-up"}
      </button>

      {showParent && (
        <div className="parent-note">
          <div className="pn-head">For a grown-up</div>
          <p>{r.parentNote}</p>
          <div className="pn-facts">
            <div>
              <b>What this cost</b>
              <span>Nothing. The app works this out itself, on this device.</span>
            </div>
            <div>
              <b>Where the data lives</b>
              <span>
                On this device only. Nothing your child types is sent anywhere, and the
                explanation above was assembled here rather than requested from a service,
                so no request was made at all.
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
