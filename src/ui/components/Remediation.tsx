import { useState } from "react";

import { SKINS } from "../assets/palette.ts";
import { formatUsd, generationCost, remediationFor } from "../../remediation/index.ts";

/**
 * The one screen whose words a model wrote — and only the words. Every number
 * shown here was computed by the engine, and the sentences around them passed
 * the validation gate before they were ever written to disk.
 */
export function Remediation({ bugId }: { bugId: string }) {
  const [showParent, setShowParent] = useState(false);
  const [tryAnswer, setTryAnswer] = useState("");
  const [tried, setTried] = useState<null | boolean>(null);
  const r = remediationFor(bugId);
  const name = SKINS[bugId]?.name ?? "The robot";
  const cost = generationCost();

  return (
    <section className="remedy">
      <div className="remedy-head">
        <span className="remedy-tag">SPROCKET EXPLAINS</span>
        <span className="remedy-src">
          {r.source === "generated" ? "written for this bug" : "the plain version"}
        </span>
      </div>

      <p className="remedy-copy">{r.childExplanation}</p>

      <div className="ways">
        <div className="way bad">
          <div className="way-cap">{name}'s way</div>
          <div className="way-sum">{r.example.problem}</div>
          <div className="way-ans">{r.example.robotAnswer}</div>
        </div>
        <div className="way ok">
          <div className="way-cap">Really</div>
          <div className="way-sum">{r.example.problem}</div>
          <div className="way-ans">{r.example.correctAnswer}</div>
        </div>
      </div>

      {r.practice && (
        <div className="tray">
          <span className="tray-head">YOUR TURN · NOW YOU TRY</span>
          <div className="answer-tray">
            <span className="practice">{r.practice.problem} =</span>
            <input
              inputMode="numeric"
              placeholder="?"
              aria-label="Your answer"
              value={tryAnswer}
              onChange={(e) => {
                setTryAnswer(e.target.value);
                setTried(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tryAnswer.trim()) {
                  setTried(tryAnswer.trim() === r.practice!.correctAnswer);
                }
              }}
            />
            <button
              className="btn sm"
              disabled={!tryAnswer.trim()}
              onClick={() => setTried(tryAnswer.trim() === r.practice!.correctAnswer)}
            >
              Check
            </button>
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
              <span>
                {r.source === "generated"
                  ? `${formatUsd(cost.usd)} to write all thirteen explanations, once.`
                  : "Nothing — this version is written by the app itself."}
              </span>
            </div>
            <div>
              <b>Where the data lives</b>
              <span>
                On this device only — nothing your child types is sent anywhere.
                {r.source === "generated"
                  ? " The one request that wrote this text contained the robot's bug and three example problems: no name, no answers, no history."
                  : " This text was written by the app itself, so no request was made at all."}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
