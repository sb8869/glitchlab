import { useEffect, useState } from "react";

import { BUGS, bugById } from "../../bugs/library.ts";
import { BAND_ORDER, type Band } from "../../bugs/types.ts";
import {
  bandBelow,
  bandOpensNextSession,
  bandsOpenedThisSession,
  getRecord,
  hasCheered,
  isBandOpen,
  markCheered,
  type LearnerState,
} from "../../learner/index.ts";
import { play } from "../audio.ts";
import { SKINS } from "../assets/palette.ts";
import { Bot } from "../components/Bot.tsx";

const bandOf = (bugId: string) => bugById(bugId).band;

/**
 * The burst for an empty bench, computed once and deterministically.
 *
 * Not random: a celebration that looks different on every render is a nuisance
 * to verify and nobody sees it twice anyway. Each piece carries its landing
 * point, spin and color as custom properties, so there are no generated class
 * names for the stylesheet to have to know about.
 */
const CONFETTI_PIECES = 52;
const CONFETTI = Array.from({ length: CONFETTI_PIECES }, (_, i) => {
  const angle = (i / CONFETTI_PIECES) * Math.PI * 2;
  const reach = 200 + (i % 5) * 95;
  return {
    x: Math.round(Math.cos(angle) * reach),
    y: Math.round(Math.sin(angle) * reach * 0.6) - 60,
    spin: (i % 7) * 120 + 180,
    delay: (i % 8) * 45,
    tint: ["var(--teal)", "var(--accent)", "var(--glitch)", "var(--good)"][i % 4]!,
  };
});

const BAND_NAME: Record<Band, string> = {
  place_value: "place value",
  add_regroup: "addition",
  sub_regroup: "subtraction",
  fraction_number: "fractions",
};

/**
 * The bench. Four shelves, and the shelf a robot sits on is the whole story:
 * glitching robots keep their tell, robots on rungs not yet open are dimmed
 * behind a dashed edge, robots waiting on a retest have lost the tell but are
 * not signed off, and repaired robots are plain and checked.
 */
export function Bay({
  learner,
  onOpen,
  onNextSession,
  onLog,
  onHowToPlay,
  onStartOver,
}: {
  learner: LearnerState;
  onOpen: (bugId: string) => void;
  onNextSession: () => void;
  onLog: () => void;
  onHowToPlay: () => void;
  onStartOver: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const by = (want: string[]) =>
    BUGS.filter((b) => want.includes(getRecord(learner, b.id).state)).map((b) => b.id);

  const unfixed = by(["unseen", "diagnosed"]);
  /*
   * The ladder is a gate, not just a picture. A robot on a rung that has not
   * opened yet is still on the bench — the game is finite and the child should
   * be able to see the end of it — but it cannot be worked on.
   */
  const glitching = unfixed.filter((id) => isBandOpen(learner, bandOf(id)));
  const locked = unfixed.filter((id) => !isBandOpen(learner, bandOf(id)));
  const probation = by(["probation"]);
  const repaired = by(["repaired"]);
  /*
   * The bench is clear when nothing is glitching and nothing is on probation.
   * That is the end of the game and it has to look like one: an empty
   * "Glitching · 0" shelf reads as a bug, not as a finish.
   */
  const clear = unfixed.length === 0 && probation.length === 0 && repaired.length > 0;
  /*
   * The finale, exactly once per lab.
   *
   * An empty bench is a state; the celebration is an event. Firing it on the
   * state meant a trip to the repair log and back set off the confetti and a
   * second fanfare — a moment whose whole pitch is that it happens once,
   * happening on a loop. The flag is persisted, so a reload does not re-throw
   * the party either, and "Start a new lab" clears it so the next lab can
   * earn its own.
   */
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (!clear || hasCheered()) return;
    markCheered();
    setCheer(true);
    play("cleared");
  }, [clear]);
  /*
   * Nothing left to open today. Either everything is on probation, or this
   * rung is finished and the next one does not open until tomorrow. Sprocket
   * used to go on asking "who's on the bench today?" over a screen where
   * nothing was clickable.
   */
  const nothingToOpen = glitching.length === 0 && !clear;
  /*
   * A rung that opened while the child was away. This is the only milestone
   * between the first robot and the last, and it used to be the line "these
   * open next time you come in" — read yesterday, on a different screen.
   */
  const opened = bandsOpenedThisSession(learner);
  const freshIds = new Set(
    opened.length > 0 ? unfixed.filter((id) => opened.includes(bandOf(id))) : [],
  );
  const openedName = opened.length > 0 ? BAND_NAME[opened[opened.length - 1]!] : null;

  /*
   * Name the rung they are actually on, which is the one below the LOWEST
   * locked band — not below whichever locked robot happens to come first in
   * the library, which is a subtraction robot and would send them to the
   * wrong rung.
   */
  const lockedBands = BAND_ORDER.filter((b) => locked.some((id) => bandOf(id) === b));
  const nextBand = lockedBands[0] ?? null;
  const nextRung = nextBand ? bandBelow(nextBand) : null;
  /** The rung below is done; these are waiting on the calendar, not on work. */
  const opensTomorrow = nextBand !== null && bandOpensNextSession(learner, nextBand);

  return (
    <main className="panel bay">
      <div className="say">
        <Bot character="sprocket" eyes={clear ? "celebrating" : "idle"} showTell={false} size={64} />
        <div className="bubble">
          <div className="line">
            {clear
              ? "The bench is clear."
              : !nothingToOpen
                ? /*
                     A rung opening is the only milestone between the first
                     robot and the last, and it used to arrive as a line on
                     YESTERDAY's screen. It gets the headline on the day it
                     happens; the tally below stays whole either way.
                   */
                  openedName
                  ? `The ${openedName} robots just opened up.`
                  : "Who's on the bench today?"
                : opensTomorrow
                  ? "That's this lot sorted."
                  : "Every one of them is waiting on a retest."}
          </div>
          <div className="quiet">
            {clear ? (
              <>
                All {repaired.length} of them came back days later and got it right anyway.
                That is the part that counts.
              </>
            ) : nothingToOpen ? (
              opensTomorrow ? (
                <>
                  The {nextBand ? BAND_NAME[nextBand] : "next"} robots are next, and they
                  open next time you come in. One rung a day.
                </>
              ) : (
                <>
                  Nothing more to do today. Close up, and their problems come back round on
                  their own.
                </>
              )
            ) : (
              <>
                {glitching.length} glitching. {probation.length} waiting for a retest.{" "}
                {repaired.length} done.
              </>
            )}
          </div>
        </div>
      </div>

      {clear && (
        <section className={`allclear${cheer ? " cheer" : ""}`}>
          {cheer && (
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((p, i) => (
              <span
                key={i}
                className="bit"
                style={{
                  ["--x" as string]: `${p.x}px`,
                  ["--y" as string]: `${p.y}px`,
                  ["--spin" as string]: `${p.spin}deg`,
                  ["--tint" as string]: p.tint,
                  animationDelay: `${p.delay}ms`,
                }}
              />
            ))}
          </div>
          )}
          <span className="clear-stamp">EVERY ROBOT REPAIRED</span>
          <p className="log-sub">
            Not one of them was signed off on a streak. Each one sat on the bench for a
            few sessions first, then had its own problem slipped back into ordinary work —
            and passed it then.
          </p>
          {/*
             A reset lives here and nowhere else. It is the one screen where
             starting over is a reasonable thing to want, and the one screen
             where a stray click cannot cost anybody their work in progress.
          */}
          {confirming ? (
            <div className="chips">
              <button className="btn sm" onClick={onStartOver}>
                Yes, wipe it and start again
              </button>
              <button className="btn sm ghost" onClick={() => setConfirming(false)}>
                Keep my repair log
              </button>
            </div>
          ) : (
            <button className="btn sm ghost" onClick={() => setConfirming(true)}>
              Start a new lab
            </button>
          )}
        </section>
      )}

      {glitching.length > 0 && (
        <Shelf
          title="Glitching"
          hint="pick one to open up"
          tone="bad"
          ids={glitching}
          onOpen={onOpen}
          tell
          fresh={freshIds}
        />
      )}

      {/*
        Locked robots stay visible. The whole point of a finite bar is that the
        child can see the end of it from the first session; hiding the rungs
        they have not reached would take that away to save a little clutter.
      */}
      {locked.length > 0 && (
        <Shelf
          title="Not yet"
          hint={
            opensTomorrow
              ? "these open next time you come in"
              : nextRung
                ? `finish the ${BAND_NAME[nextRung]} robots first`
                : "coming up later"
          }
          tone="mute"
          ids={locked}
          dashed
        />
      )}

      {/*
        The probation shelf is INERT on purpose. It used to say "one is due
        now", relabel the due robot "retest due", and let the child click it —
        which handed them the answer to the only question the retest asks:
        which procedure is being checked. A child who knows that can prime for
        it, and "got it right when they saw it coming" is exactly what the
        streak already measured and what this mechanic exists to stop
        trusting. Seeing that robots are waiting is honest; saying which one
        is up, or letting them take the probe deliberately, is not.
      */}
      {probation.length > 0 && (
        <Shelf
          title="Waiting on a retest"
          hint="the problem comes back later"
          tone="warn"
          ids={probation}
          dashed
        />
      )}

      {repaired.length > 0 && (
        <Shelf title="Repaired" hint="the retest held" tone="good" ids={repaired} eyes="celebrating" />
      )}

      <div className="bay-actions">
        <button className="btn sm ghost" onClick={onHowToPlay}>
          How to play
        </button>
        <button className="btn sm ghost" onClick={onLog}>
          Repair log
        </button>
        {/*
          A session boundary is a real visit in the shipped game. This button
          exists so the delayed retest can be seen inside a three-minute demo
          without waiting two days for it, and it is labeled as what it is.
        */}
        {!clear && (
          <button className="btn sm" onClick={onNextSession}>
            Close up for today →
          </button>
        )}
      </div>
    </main>
  );
}

function Shelf({
  title,
  hint,
  tone,
  ids,
  onOpen,
  tell = false,
  dashed = false,
  eyes = "idle",
  fresh,
}: {
  title: string;
  hint: string;
  tone: "bad" | "warn" | "good" | "mute";
  ids: string[];
  onOpen?: (bugId: string) => void;
  tell?: boolean;
  dashed?: boolean;
  eyes?: "idle" | "celebrating";
  /** Robots whose rung opened today: they rise onto the shelf, in order. */
  fresh?: ReadonlySet<string>;
}) {
  return (
    <section className={`shelf ${tone}${dashed ? " dashed" : ""}`}>
      <div className="shelf-head">
        <span className={`shelf-tag ${tone}`}>{title} · {ids.length}</span>
        <span className="shelf-hint">{hint}</span>
      </div>
      <div className="shelf-row">
        {ids.map((id, i) => {
          const skin = SKINS[id]!;
          const bug = bugById(id);
          const justOpened = fresh?.has(id) ?? false;
          return (
            <button
              key={id}
              className={`bot-card${onOpen ? " open" : ""}${justOpened ? " fresh" : ""}`}
              style={justOpened ? { animationDelay: `${i * 90}ms` } : undefined}
              onClick={onOpen ? () => onOpen(id) : undefined}
              disabled={!onOpen}
            >
              <Bot character={id} eyes={eyes} showTell={tell} size={72} />
              <span className="bot-name">{skin.name}</span>
              <span className="bot-band">{BAND_NAME[bug.band]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
