import type { Frac, Item } from "../../bugs/types.ts";
import { fracStr } from "../../bugs/procedures.ts";
import { answerReady, digitsOnly } from "./answer.ts";

export {
  answerPrompt,
  answerReady,
  answerStatement,
  answerTrayHead,
  compareChoices,
  digitsOnly,
} from "./answer.ts";

/**
 * The answer box, shaped by the item.
 *
 * Four of the thirteen robots are fraction robots, and a numeric-only text
 * field made them unplayable: a child cannot type "17/24" into it, and asking
 * a seven-year-old to type a slash to answer "which is bigger" is a question
 * about keyboards rather than about fractions. So the box follows the item:
 *
 *   fracCompare -> two fractions to pick between, tapped not typed
 *   fracAdd     -> a numerator box over a denominator box, joined as "n/d"
 *   everything else -> the numeric field it has always been
 *
 * The value handed up is always the same flat answer string the engine
 * compares against, so nothing downstream has to know which shape was used.
 */

export function FracGlyph({ f }: { f: Frac }) {
  return (
    <span className="fracglyph">
      <span className="fg-n">{f.n}</span>
      <span className="fg-bar" />
      <span className="fg-d">{f.d}</span>
    </span>
  );
}

export function AnswerInput({
  item,
  value,
  onChange,
  onSubmit,
  autoFocus = false,
  label = "Your answer",
}: {
  item: Item | null | undefined;
  value: string;
  onChange: (next: string) => void;
  /** Takes the value explicitly: a tapped fraction submits before state lands. */
  onSubmit: (value: string) => void;
  autoFocus?: boolean;
  label?: string;
}) {
  if (item?.kind === "fracCompare") {
    return (
      <div className="pick" role="group" aria-label={label}>
        {[item.a, item.b].map((f) => {
          const s = fracStr(f);
          return (
            <button
              type="button"
              key={s}
              className={`pickbtn${value === s ? " on" : ""}`}
              aria-label={`${f.n} over ${f.d}`}
              onClick={() => {
                onChange(s);
                onSubmit(s);
              }}
            >
              <FracGlyph f={f} />
            </button>
          );
        })}
      </div>
    );
  }

  if (item?.kind === "fracAdd") {
    const [n = "", d = ""] = value.split("/");
    const set = (nn: string, dd: string) => onChange(`${digitsOnly(nn)}/${digitsOnly(dd)}`);
    const enter = (e: { key: string }) => {
      if (e.key === "Enter" && answerReady(item, value)) onSubmit(value);
    };
    return (
      <div className="fracbox">
        <input
          className="fracin"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={n}
          placeholder="?"
          aria-label={`${label} — top number`}
          onChange={(e) => set(e.target.value, d)}
          onKeyDown={enter}
        />
        <span className="fracbar" />
        <input
          className="fracin"
          inputMode="numeric"
          value={d}
          placeholder="?"
          aria-label={`${label} — bottom number`}
          onChange={(e) => set(n, e.target.value)}
          onKeyDown={enter}
        />
      </div>
    );
  }

  return (
    <input
      autoFocus={autoFocus}
      inputMode="numeric"
      value={value}
      placeholder="?"
      aria-label={label}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onSubmit(value);
      }}
    />
  );
}
