import { useState } from "react";

import { SKINS } from "../assets/palette.ts";
import { bugById } from "../../bugs/library.ts";
import { formatUsd, generationCost, remediationFor } from "../../remediation/index.ts";
import { traceArith, type Trace } from "../../remediation/trace.ts";
import { BANK } from "../../bugs/bank.ts";
import { generateForBug } from "../../bugs/generate.ts";

/**
 * The one screen whose words a model wrote — and only the words. Every number
 * shown here was computed by the engine, and the sentences around them passed
 * the validation gate before they were ever written to disk.
 */
function Working({
  tone,
  cap,
  trace,
  problem,
  answer,
  note,
}: {
  tone: "bad" | "ok";
  cap: string;
  trace: Trace;
  problem: string;
  answer: string;
  note?: string;
}) {
  if (trace.kind !== "columns") {
    // Fractions and expanded form have no column layout to show.
    return (
      <div className={`way ${tone}`}>
        <div className="way-cap">{cap}</div>
        <div className="way-sum">{problem}</div>
        <div className="way-ans">{answer}</div>
      </div>
    );
  }
  const cols = trace.top.length;
  return (
    <div className={`way ${tone}`}>
      <div className="way-cap">{cap}</div>
      <div className="sum" style={{ gridTemplateColumns: `auto repeat(${cols}, 1fr)` }}>
        <span className="sign" />
        {trace.top.map((c, i) => (
          <span className="cell" key={`t${i}`}>
            {c.borrowIn && <sup className="mark pre">{c.borrowIn}</sup>}
            {c.digit}
            {c.carryIn && <sup className="mark pre">{c.carryIn}</sup>}
            {c.becomes && <sup className="mark post">{c.becomes}</sup>}
          </span>
        ))}
        <span className="sign">{trace.op === "-" ? "\u2212" : "+"}</span>
        {trace.bottom.map((c, i) => (
          <span className="cell" key={`b${i}`}>{c.digit}</span>
        ))}
        <span className="rule" style={{ gridColumn: `1 / span ${cols + 1}` }} />
        <span className="sign" />
        {trace.result.map((d, i) => (
          <span className={`cell res${trace.differs[i] ? " hot" : ""}`} key={`r${i}`}>{d}</span>
        ))}
      </div>
      {(trace.caption ?? note) && <div className="way-note">{trace.caption ?? note}</div>}
    </div>
  );
}

export function Remediation({ bugId }: { bugId: string }) {
  const [showParent, setShowParent] = useState(false);
  const [tryAnswer, setTryAnswer] = useState("");
  const [tried, setTried] = useState<null | boolean>(null);
  const r = remediationFor(bugId);
  const name = SKINS[bugId]?.name ?? "The robot";
  const cost = generationCost();

  /*
   * The working, column by column. A buggy procedure is a procedure, so
   * showing only the two answers hides the thing being taught: WHERE the two
   * methods part company. Every digit, borrow and carry here is computed.
   */
  const exampleItem =
    generateForBug(bugId, 4242, 1)[0] ?? BANK.find((i) => i.id === r.example.itemId) ?? null;
  const robotTrace: Trace = exampleItem
    ? traceArith(exampleItem, r.example.robotAnswer, r.example.correctAnswer, false)
    : { kind: "plain" };
  const correctTrace: Trace = exampleItem
    ? traceArith(exampleItem, r.example.correctAnswer, r.example.robotAnswer, true)
    : { kind: "plain" };

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
