import type { Trace } from "../../remediation/trace.ts";

/**
 * One method's working, laid out the way it would be written by hand.
 *
 * Shared by the remediation screen and by the moment a child gets a problem
 * wrong, because those two places must never disagree about what a procedure
 * looks like.
 *
 * `blank` hides the result — the borrows, the carries and the caption stay.
 * That is the difference between teaching a child and handing them the answer
 * to copy: they get the scaffold and still have to finish it themselves.
 */
export function Working({
  tone,
  cap,
  trace,
  problem,
  answer,
  note,
  blank = false,
}: {
  tone: "bad" | "ok";
  cap: string;
  trace: Trace;
  problem: string;
  answer: string;
  note?: string;
  blank?: boolean;
}) {
  if (trace.kind === "steps") {
    const steps = blank ? trace.steps.slice(0, -1) : trace.steps;
    return (
      <div className={`way ${tone}`}>
        <div className="way-cap">{cap}</div>
        <ol className="steps">
          {steps.map((st, i) => (
            <li className={`step${st.hot ? " hot" : ""}`} key={i}>
              {st.text}
            </li>
          ))}
          {blank && <li className="step blank">?</li>}
        </ol>
        {(trace.caption ?? note) && <div className="way-note">{trace.caption ?? note}</div>}
      </div>
    );
  }

  if (trace.kind !== "columns") {
    return (
      <div className={`way ${tone}`}>
        <div className="way-cap">{cap}</div>
        <div className="way-sum">{problem}</div>
        <div className={`way-ans${blank ? " blank" : ""}`}>{blank ? "?" : answer}</div>
        {note && <div className="way-note">{note}</div>}
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
        <span className="sign">{trace.op === "-" ? "−" : "+"}</span>
        {trace.bottom.map((c, i) => (
          <span className="cell" key={`b${i}`}>{c.digit}</span>
        ))}
        <span className="rule" style={{ gridColumn: `1 / span ${cols + 1}` }} />
        <span className="sign" />
        {trace.result.map((d, i) => (
          <span
            className={`cell res${blank ? " blank" : trace.differs[i] ? " hot" : ""}`}
            key={`r${i}`}
          >
            {blank ? "?" : d}
          </span>
        ))}
      </div>
      {(trace.caption ?? note) && <div className="way-note">{trace.caption ?? note}</div>}
    </div>
  );
}
