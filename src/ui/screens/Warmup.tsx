import { useState } from "react";

import { itemLabel } from "../../bugs/procedures.ts";
import { traceFor } from "../../remediation/trace.ts";
import { AnswerInput, answerReady } from "../components/AnswerInput.tsx";
import { Bot } from "../components/Bot.tsx";
import { Working } from "../components/Working.tsx";
import type { Warmup as WarmupData } from "../game/warmup.ts";

export type WarmupResult = {
  bugId: string;
  correct: boolean;
  problem: string;
  /** True when they only reached the answer after being shown the working. */
  needed: boolean;
};

/**
 * Warm-up problems, one of which may be a delayed retest.
 *
 * NOTHING here distinguishes the retest. No marker, no ordering, no styling,
 * no copy. The child is doing four quick problems; the app is quietly finding
 * out whether a repair held. That silence is the mechanic.
 *
 * A wrong answer does not move on. It used to: any number was accepted, went
 * green, and the warm-up became a thing you could type your way past — which
 * both told a child a wrong answer was right and threw away the moment they
 * were most ready to be taught. Now a miss shows the working with the result
 * blanked, exactly as it does everywhere else in the app.
 *
 * What gets SCORED is their first answer. Being shown how it is done and then
 * writing it in is not the same as knowing it, and a retest that could be
 * passed with help would not be measuring retention.
 */
export function Warmup({
  data,
  onDone,
}: {
  data: WarmupData;
  onDone: (results: WarmupResult[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [given, setGiven] = useState<string[]>([]);
  /** First answers, kept apart from what finally landed on the page. */
  const [first, setFirst] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);

  const slot = data.slots[index];

  function submit(raw: string = entry) {
    if (!slot) return;
    const value = raw.trim();
    if (!answerReady(slot.item, value)) return;

    const firstSoFar = first.length === index ? [...first, value] : first;
    if (first.length === index) setFirst(firstSoFar);

    if (value !== slot.answer) {
      setMisses(misses + 1);
      setEntry("");
      return;
    }

    const answers = [...given, value];
    setGiven(answers);
    setEntry("");
    setMisses(0);

    if (answers.length < data.slots.length) {
      setIndex(index + 1);
      return;
    }
    onDone(
      data.slots
        .map((s, i) => ({ s, answer: firstSoFar[i] ?? "" }))
        .filter(({ s }) => s.retestFor)
        .map(({ s, answer }, _, __) => ({
          bugId: s.retestFor!,
          correct: answer === s.answer,
          problem: itemLabel(s.item),
          needed: answer !== s.answer,
        })),
    );
  }

  return (
    <main className="panel">
      <div className="say">
        <Bot character="sprocket" eyes={misses > 0 ? "thinking" : "idle"} showTell={false} size={64} />
        <div className="bubble">
          {/*
            No robot is named here. This screen names nobody and looks the
            same every session, because the moment it hints at who is being
            tested, the probe is one the child can prime for.
          */}
          <div className="line">
            {misses === 0
              ? "A few to warm up on."
              : misses === 1
                ? "Not quite. Let's do it together."
                : `${slot ? itemLabel(slot.item) : "That one"} is ${slot?.answer ?? ""}.`}
          </div>
          <div className="quiet">
            {misses === 0
              ? "Just you this time — no robot answers to check."
              : misses === 1
                ? "Here's how this one goes. Follow it through and tell me what you get."
                : "Now you've seen it worked out. Write it in and we'll carry on."}
          </div>
        </div>
      </div>

      <div className="notepad">
        {data.slots.map((s, i) => {
          const done = i < given.length;
          const active = i === index;
          return (
            <div key={s.item.id} className={`np-row${active ? " active" : ""}`}>
              <span className="np-q">
                {itemLabel(s.item)}
                {s.item.kind === "fracCompare" ? "?" : " ="}
              </span>
              {done ? (
                <span className="np-a done">{given[i]}</span>
              ) : active ? (
                <AnswerInput
                  autoFocus
                  className="np-in"
                  item={s.item}
                  value={entry}
                  label={`Answer for ${itemLabel(s.item)}`}
                  onChange={setEntry}
                  onSubmit={submit}
                />
              ) : (
                <span className="np-a">?</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Same rule as everywhere else: a miss is taught, not waved through. */}
      {misses > 0 && slot && (
        <div className="teach">
          <Working
            tone="ok"
            cap={misses > 1 ? "How it goes" : "Follow it through"}
            trace={traceFor(slot.item, slot.answer, slot.answer, true)}
            problem={itemLabel(slot.item)}
            answer={slot.answer}
            blank={misses === 1}
            note="work it out one column at a time"
          />
        </div>
      )}

      <div className="np-foot">
        <span className="np-dots">
          {data.slots.map((s, i) => (
            <span key={s.item.id} className={`np-dot${i < given.length ? " on" : ""}`} />
          ))}
          <span className="np-count">
            {Math.min(given.length + 1, data.slots.length)} of {data.slots.length}
          </span>
        </span>
        {slot?.item.kind !== "fracCompare" && (
          <button className="btn sm" disabled={!answerReady(slot?.item, entry)} onClick={() => submit()}>
            {misses === 0 ? "Next" : misses === 1 ? "Try again" : "Write it in"}
          </button>
        )}
      </div>
    </main>
  );
}
