# Glitch Lab — submission

**A K-5 math game that diagnoses *which* broken procedure a child is running,
instead of deciding they are "bad at subtraction" and giving them easier sums.**

Live link: **https://glitchlab-lyart.vercel.app** · Repo: this one · `npm run check` — typecheck + 147 tests

No sign-in, nothing to configure. Progress lives in `localStorage`, so every visit
starts a fresh lab at session 1. Append `?peek` for a read-only view of the
retest schedule — the delayed retest is invisible by design, which makes it
invisible to anyone evaluating it too.

---

## The one-paragraph version

When a child writes `40 - 27 = 27`, they are not guessing and they are not
missing "subtraction." They are running a procedure — one that takes the small
digit from the big one in every column — and it is perfectly consistent. Glitch
Lab treats that procedure as the thing to find. The child meets a robot that
does math wrong, picks which problem to test it with, and watches a board of
fourteen suspects narrow to one. What the child never sees is that they are
being diagnosed by the same engine at the same time: their own answer to each
problem updates a second posterior over the same fourteen hypotheses. Mutual
diagnosis, dressed as debugging a robot.

Grounded in Brown & Burton's BUGGY (1978) and VanLehn's repair theory: children's
arithmetic errors are overwhelmingly systematic, and a bug is a *procedure*,
not a gap.

## The architectural claim

> **Diagnosis is deterministic TypeScript. There is no model anywhere in the
> inference path.**

- A misconception is an **executable function**, not a description. `applies(item)`
  says whether the bug fires; `compute(item)` returns exactly what a child running
  it would write. Predicting an answer is a function call.
- The posterior over the fourteen hypotheses is **Bayes with a slip-and-guess
  likelihood**, floored so nothing is ever eliminated outright.
- The next problem is chosen by **expected information gain** over that posterior.
- A structural invariant is enforced in a wrapper around every bug: a bug may not
  claim an item where its own procedure returns the *correct* answer. A "bug" that
  is invisible on an item is not live on it, and it does not get to absorb
  probability there.

This is auditable, reproducible and fast, in a way that "I asked a model what the
child's misconception is" is not. It also means the diagnosis cannot hallucinate.

**Nothing calls a service.** There is no API key, no backend, no network at play
time, and no per-session cost. Remediation is derived from the same bug object
the diagnosis used, and it works on a plane.

## Does the method actually pay?

`npm run simulate` — 500 synthetic students, 10% slip rate, 12-item budget,
identical students in both arms, measured on a hand-verified 37-item bank the
child's game never draws from:

| | information gain | random items |
| --- | --- | --- |
| identification accuracy | **98.8%** (95% CI 97.8–99.8) | 79.0% (75.4–82.6) |
| mean items asked | **4.35** | 9.73 |
| reached the confidence threshold | 99.4% | 56.8% |

Paired McNemar χ² = **89.92** (1 df; >3.84 is p<0.05). It degrades gracefully:
at a 30% slip rate the engine is still at 92.8%.

Two hypothesis pairs are **structurally confounded** — on every item where both
are live they write the identical answer, provably, not accidentally — and are
separable only by elimination. The game says so on screen rather than pretending
otherwise.

### Where this sits in K-5

The brief is the K-5 arithmetic strand. Every band maps to a specific standard,
and the fraction band reaches the top of the range:

| band | what it is | standard | grade |
| --- | --- | --- | --- |
| Place value | expanded form, three-digit numerals | 2.NBT.A.3 | 2 |
| Addition regrouping | add within 1000 | 2.NBT.B.7, 3.NBT.A.2 | 2-3 |
| Subtraction regrouping | subtract within 1000, across zeros | 2.NBT.B.7, 3.NBT.A.2 | 2-3 |
| Fractions as numbers | compare fractions with unlike denominators | 4.NF.A.2 | 4 |
| Fractions as numbers | add fractions with unlike denominators | 5.NF.A.1 | 5 |

The bottom of the range is deliberately empty, and the reason is the method
rather than the schedule. This engine diagnoses **buggy procedures**, and a
procedure has to have steps before it can have a broken one. Kindergarten and
first-grade arithmetic is counting, number sense and fluency within twenty:
real content, but not multi-step written algorithms, so there is nothing for a
bug library to be a library *of*. The first place a child's arithmetic becomes
a procedure that can go systematically wrong is regrouping, and that is where
this starts.

## Progression and mastery

Rewarding a streak measures short-term recall. Glitch Lab measures retention:

- Three correct in a row moves a robot to **probation**, never to repaired.
- Two sessions later — plus up to one more, jittered per robot so a batch
  repaired together does not come due together — that robot's own discriminating
  problem is **slipped back into ordinary warm-up work**, unannounced and
  interleaved. Pass it and the repair is permanent. Fail and the robot cracks
  back open, and returns to the *repair* loop rather than the retest queue:
  probing the same gap again without teaching anything in between would only
  measure the same miss twice.
- **The probe cannot be picked out.** A warm-up opens every session whether or
  not one is riding, is always the same four problems long, carries at most one
  probe, and is built as two matched pairs — so the retest always has a twin of
  its own band and kind and is never the odd one out. Material comes from the
  bands the child has worked in rather than the probe's band, because a mix that
  shifted when a probe was present would itself be the tell. The shelf of robots
  waiting on a retest is inert: it never says which one is due, and it cannot be
  clicked.
- Progress is a **repair log**, not XP: thirteen competencies, finite, so a child
  can see the end of the game from the first session. The band ladder runs place
  value → addition regrouping → subtraction regrouping → fractions as numbers,
  and a rung opens the session *after* every robot on the rung below has been
  found and drilled. One rung a visit — a child who blitzes place value in
  twenty minutes does not get to cram the whole curriculum into an afternoon.

## Problems are generated, not curated

Every problem a child sees is procedurally generated and then **classified by
running the real bug library over it** — so an item's role (control, tie, or
splitter) is measured rather than asserted. Roughly 8,000 subtraction, 4,300
addition, 3,000 place value and 1,900 fraction problems are reachable. The
37-item bank exists only to evaluate the engine, and a test asserts that nothing
the child sees comes from it.

## Remediation shows the working

Naming the bug is not teaching it. Once the bug is known the screen puts the two
procedures side by side, worked out step by step — every borrow, carry and
common-denominator rewrite computed by the engine:

```
   RIVET'S WAY                REALLY
    4  4  5                4³ ¹4³ ¹5
  − 1  4  7              − 1  4  7
  ─────────              ─────────
    3  0  2                2  9  8
  always takes the small   trade a ten:
  number from the big one  15 take away 7 is 8
```

The robot's side deliberately has **no** invented middle step: the taught
procedure's steps are derivable, a buggy procedure's are not. Every sentence on
that screen also passes a validator that extracts each arithmetic claim and
checks it against engine-computed truth — including the sentences the app wrote
itself, because "we wrote it" is not a proof that the arithmetic is right.

## Two rules the interface never breaks

1. **Sprocket never says "you're wrong."** A wrong answer is *data* in this app,
   and the mascot has to behave like it. A miss shows the child the truth and
   asks them to write it in; their original answer is what gets recorded.
2. **The child is never shown a suspect list filtered by knowledge they don't
   have.** The offered tests are not screened using the robot's actual bug, even
   though that would make the demo more reliable.
3. **A wrong answer is never waved through.** Anywhere a child answers —
   diagnosis, drills, warm-ups — a miss shows the working with the result left
   blank and asks again; a second miss fills it in so nobody is stuck. What gets
   *scored* is their first answer, because being shown how it is done and then
   writing it in is not the same as knowing it, and a retest passable with help
   would not be measuring retention.

## Scope

No auth, accounts, leaderboard, backend or server-side persistence. Progress is
`localStorage`. Four bands, grade 2 through grade 5. Those cost days and prove
nothing.

---

## Demo script (2:30)

| time | on screen | said |
| --- | --- | --- |
| 0:00–0:20 | `40 - 27 = 27` written by a child | "This isn't a guess. It's a procedure — take the small digit from the big one, every column. Most math apps see one wrong answer and lower the difficulty." |
| 0:20–0:50 | the bench, open Rivet, the glitch tell | "Fourteen suspects. The child picks which problem to test the robot with." |
| 0:50–1:30 | pick a test, watch the board go 14 → 4 → 1 | "Those cards are not falling on a timer. Each answer is a Bayesian update over fourteen executable procedures, and the next problem is chosen by expected information gain. 4.35 questions on average instead of 9.73." |
| 1:30–1:50 | the tie card: two suspects, same answer | "These two are structurally confounded — on every item where both are live they write the identical answer. The game says so instead of guessing." |
| 1:50–2:15 | CASE CLOSED, the two workings side by side | "Naming the bug isn't teaching it. Here's where the two procedures part company, computed, not written by a model." |
| 2:15–2:30 | a later session, the retest hidden in the warm-up | "It was never marked fixed on a streak. A few sessions later its own problem turns up inside ordinary work — unlabelled, never first, one per visit. Pass it then and it's repaired." |
