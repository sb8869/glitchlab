/**
 * Three sounds.
 *
 * Synthesized from oscillators and a noise buffer rather than loaded from
 * files: nothing in this app is fetched, and three cues are not worth a
 * network request or a licence. The whole module is inert if the browser has
 * no Web Audio, which is why every entry point tolerates a null context
 * instead of guarding at the call sites.
 *
 * There are exactly four, and each marks a thing that already happened in the
 * repair log — a suspect ruled out, a case closed, a robot repaired, and the
 * bench finally empty. None of them fires on a correct answer, for the same
 * reason nothing else in this game rewards one: the diagnosis is fed by honest
 * wrong answers, and a child who learns that being right makes a happy noise
 * starts guessing safe.
 *
 * The fourth is deliberately longer than the others. Thirteen robots repaired
 * and every one of them held through a delayed retest is the end of the game,
 * it happens once, and it should not sound like closing a case.
 */

export type Cue = "eliminate" | "closed" | "repaired" | "cleared";

const MUTE_KEY = "glitchlab.muted.v1";

let ctx: AudioContext | null = null;
let muted = false;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
muted = readMuted();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // Private mode. The setting lasts the session, which is the best on offer.
  }
}

/**
 * The shared context, created on first use.
 *
 * Every cue follows a click, so the context is always created or resumed
 * inside a user gesture and the autoplay policy never blocks it.
 */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOptions = {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  peak?: number;
  /** Glide to this frequency across the note. */
  to?: number;
};

function tone(c: AudioContext, { freq, at, dur, type = "sine", peak = 0.16, to }: ToneOptions): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  // Exponential ramps cannot reach zero, hence the near-silent floor.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** The paper part of a rubber stamp: filtered noise with a hard decay. */
function stamp(c: AudioContext, at: number): void {
  const len = Math.ceil(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const fade = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * fade * fade * fade;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  const gain = c.createGain();
  gain.gain.value = 0.2;
  src.connect(lp).connect(gain).connect(c.destination);
  src.start(at);
}

export function play(cue: Cue, count = 1): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  try {
    if (cue === "eliminate") {
      // One stamp per card, up to four. Thirteen would be a machine gun, one
      // would undersell the moment the board collapses.
      const hits = Math.max(1, Math.min(count, 4));
      for (let i = 0; i < hits; i++) {
        const at = now + i * 0.055;
        stamp(c, at);
        tone(c, { freq: 190, to: 90, at, dur: 0.07, type: "triangle", peak: 0.12 });
      }
    } else if (cue === "closed") {
      [660, 990, 1320].forEach((f, i) =>
        tone(c, { freq: f, at: now + i * 0.085, dur: 0.16, type: "triangle", peak: 0.13 }),
      );
    } else if (cue === "repaired") {
      // Repaired: the only short cue that resolves upward and rings.
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(c, { freq: f, at: now + i * 0.075, dur: i === 3 ? 0.5 : 0.2, peak: 0.14 }),
      );
    } else {
      // Cleared: the whole bench. A fanfare, once per lab.
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      fanfare.forEach((f, i) =>
        tone(c, {
          freq: f,
          at: now + i * 0.11,
          dur: i === fanfare.length - 1 ? 1.1 : 0.26,
          type: "triangle",
          peak: 0.13,
        }),
      );
      // A fifth above the held note, so the last chord is not a single voice.
      tone(c, { freq: 1567.98, at: now + 0.44, dur: 1.1, peak: 0.07 });
    }
  } catch {
    // A cue that will not play is never a reason to interrupt the game.
  }
}
