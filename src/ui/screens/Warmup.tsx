import { useState } from "react";

import { itemLabel } from "../../bugs/procedures.ts";
import { Bot } from "../components/Bot.tsx";
import { digitsOnly } from "../components/answer.ts";
import type { Warmup as WarmupData } from "../game/warmup.ts";

/**
 * Warm-up problems, one of which is a delayed retest.
 *
 * NOTHING here distinguishes the retest. No marker, no ordering, no styling,
 * no copy. The child is doing four quick problems; the app is quietly finding
 * out whether a repair held. That silence is the mechanic.
 */
export function Warmup({
  data,
  onDone,
}: {
  data: WarmupData;
  onDone: (results: Array<{ bugId: string; correct: boolean; problem: string }>) => void;
}) {
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [given, setGiven] = useState<string[]>([]);

  function submit() {
    const value = entry.trim();
    if (!value) return;
    const answers = [...given, value];
    setGiven(answers);
    setEntry("");

    if (answers.length < data.slots.length) {
      setIndex(index + 1);
      return;
    }
    const results = data.slots
      .map((slot, i) => ({ slot, answer: answers[i] ?? "" }))
      .filter(({ slot }) => slot.retestFor)
      .map(({ slot, answer }) => ({
        bugId: slot.retestFor!,
        correct: answer === slot.answer,
        problem: itemLabel(slot.item),
      }));
    onDone(results);
  }

  return (
    <main className="panel">
      <div className="say">
        <Bot character="sprocket" eyes="idle" showTell={false} size={64} />
        <div className="bubble">
          {/*
            No robot is named here. This screen names nobody and looks the
            same every session, because the moment it hints at who is being
            tested, the probe is one the child can prime for.
          */}
          <div className="line">A few to warm up on.</div>
          <div className="quiet">Just you this time — no robot answers to check.</div>
        </div>
      </div>

      <div className="notepad">
        {data.slots.map((slot, i) => {
          const done = i < given.length;
          const active = i === index;
          return (
            <div key={slot.item.id} className={`np-row${active ? " active" : ""}`}>
              <span className="np-q">{itemLabel(slot.item)} =</span>
              {done ? (
                <span className="np-a done">{given[i]}</span>
              ) : active ? (
                <input
                  autoFocus
                  inputMode="numeric"
                  className="np-in"
                  value={entry}
                  placeholder="?"
                  aria-label={`Answer for ${itemLabel(slot.item)}`}
                  onChange={(e) => setEntry(digitsOnly(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              ) : (
                <span className="np-a">?</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="np-foot">
        <span className="np-dots">
          {data.slots.map((s, i) => (
            <span key={s.item.id} className={`np-dot${i < given.length ? " on" : ""}`} />
          ))}
          <span className="np-count">
            {Math.min(given.length + 1, data.slots.length)} of {data.slots.length}
          </span>
        </span>
        <button className="btn sm" disabled={!entry.trim()} onClick={submit}>
          Next
        </button>
      </div>
    </main>
  );
}
