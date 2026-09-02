# Glitch Lab

A K-4 math game that diagnoses **which broken procedure** a child is running,
instead of lowering the difficulty when they answer wrong.

Children's arithmetic errors are not random. They are consistent buggy
algorithms. A child running smaller-from-larger subtraction answers
`71 - 28 = 57` every single time. Standard adaptive systems see "wrong answer,
lower difficulty", which is exactly backwards: that child does not need easier
problems, they need the bug named.

The child's framing is that they are debugging a robot. The robot does math
wrong, and the child hunts for its bug while the system hunts for theirs.
Mutual diagnosis, the same mechanic running in both directions.

Literature: Brown & Burton, *Diagnostic Models for Procedural Bugs in Basic
Mathematical Skills* (BUGGY, 1978); VanLehn on repair theory.

---

## Status

| Layer | State |
| --- | --- |
| 1. Bug library (13 executable misconceptions) | done, 19 tests |
| 2. Inference engine (Bayes + information gain) | done, 15 tests |
| 3. Simulation harness (500 students) | done, result below |
| 4. Progression and mastery | done, 29 tests |
| 5. Game layer | full mastery loop playable, 8 screens |
| 6. Remediation layer | done, 19 tests |

`npm run check` — typecheck plus 121 tests, all green.

---

## The headline result

500 synthetic students, each assigned a known bug, run through the engine
twice: once with information-gain item selection, once with random item
selection from the same bank.

|  | information gain | random |
| --- | ---: | ---: |
| identification accuracy | **98.8%** | 79.0% |
| 95% CI | 97.8 – 99.8% | 75.4 – 82.6% |
| mean items to diagnosis | **4.35** | 9.73 |
| reached confidence threshold | 99.4% | 56.8% |

Paired on the identical student: info-gain right and random wrong on 104
students; random right and info-gain wrong on 5. McNemar χ² = 89.9 (1 df,
p < 0.001).

Two things make this a number worth quoting rather than a number the harness
manufactured:

**The design is paired.** Whether a student slips on a given item is a
deterministic function of `(student, item)`, so both arms face the identical
child. Any difference is the selector, not the draw.

**The slip model is deliberately not the engine's model.** The engine assumes
slips spread uniformly over the other predicted answers. The simulated child
instead perturbs one digit of what they meant to write. The likelihood is
misspecified on purpose — a result that only holds when the engine's own
assumptions are exactly true is not a result.

It also degrades the way a real method should:

| slip rate | info gain | random | items (IG) |
| ---: | ---: | ---: | ---: |
| 0.00 | 100.0% | 82.0% | 3.89 |
| 0.05 | 99.4% | 81.2% | 4.10 |
| 0.10 | 98.8% | 79.0% | 4.35 |
| 0.20 | 97.2% | 75.8% | 4.93 |
| 0.30 | 92.8% | 69.4% | 5.57 |
| 0.50 | 78.6% | 53.8% | 7.13 |

Monotone, and the gap survives at every noise level including a child
coin-flipping half their answers.

Reproduce with `npm run simulate` (writes `out/simulation.{json,csv}`).

---

## Why an accuracy score cannot do this

The clearest case in the bank. Two subtraction bugs:

- `sub_smaller_from_larger` — takes the smaller digit from the larger in every
  column, never regroups. `71 - 28 = 57`.
- `sub_zero_minus_n_is_n` — when the top digit is 0, copies the bottom digit
  down. `40 - 27 = 27`.

On `40 - 27` **both predict 27.** The item cannot separate them at all, no
matter how the child answers. On `62 - 35` they come apart: smaller-from-larger
writes 33, and the zero rule does not fire, so that child writes the correct 27.

`62 - 35` is not harder than `40 - 27`. It is *more informative*. A difficulty
slider has no way to prefer it, because on every item where both bugs are live
they write the identical wrong answer — their accuracy is indistinguishable by
construction. Selecting on expected information does prefer it, and that is the
entire mechanic.

`npm run collisions` prints, for every item, which hypotheses share a predicted
answer. Two pairs turn out to be **structurally confounded** — fused on *every*
item where both are live, so they can only be separated by elimination:

- `sub_smaller_from_larger | sub_zero_minus_n_is_n`
- `frac_bigger_denominator_wins | frac_numerator_only`

The second one is provable rather than accidental: on a comparison item, if a
child picks the fraction with the larger numerator and is wrong, that fraction
necessarily also has the larger denominator. The two rules cannot disagree.
This is why `frac_numerator_only` is the engine's hardest case — 7.9 items on
average, and only 41.4% identification under random selection versus 96.6%
under information gain. It is the clearest single demonstration that the
selector is doing real inferential work.

---

## Architecture

**Diagnosis is deterministic TypeScript. There is no LLM anywhere in the
inference path.** Bugs are executable functions, the posterior is Bayes, item
selection is mutual information. Zero latency, zero cost, and legible to an
engineer in a way that "I prompted a model to guess the misconception" is not.

```
src/bugs/       types, digit/fraction procedures, the 13 bugs, the probe bank
src/engine/     posterior, likelihood, information gain, session driver
src/learner/    repair log, delayed interleaved mastery, band ladder, storage
src/remediation/ counterexample, prompts, the validation gate, cost, fallback
src/ui/assets/  bot skeleton, eye states, glitch tells, palette, composition
scripts/        collision report, simulation harness, contact sheet, mastery walkthrough
design/         the Claude Design asset brief
```

### Bugs are executable, not descriptive

```ts
type Bug = {
  id: string;
  label: string;       // technical / parent-facing
  childLabel: string;  // "Takes ten but forgets to pay it back"
  applies(item: Item): boolean;
  compute(item: Item): Answer;   // what THIS child writes down
};
```

Two labels per bug is deliberate. The technical id never surfaces to a child.

### The distinctness invariant

Enforced once, structurally, by wrapping every bug at registration:

> A bug may not `apply` to an item where its `compute` returns the correct
> answer.

Without it, a hypothesis can claim an item it does not discriminate on, and a
*correct* response becomes spurious evidence *for* the bug.

This was not hypothetical. `sub_zero_minus_n_is_n` on `305 - 128` never fires:
the units column borrows first, the rule requires no incoming borrow, and the
procedure silently returns the correct 177. It surfaced as a failing test, and
the right question was whether it was a code bug or a modeling question. It was
a modeling question, which is why the fix lives in one wrapper rather than as a
special case inside one bug. `305 - 128` is pinned as a regression test.

A bug that does not apply predicts the *correct* answer, so non-discriminating
items carry exactly zero evidence — which falls out of the model rather than
being special-cased. Two items in the bank (`23 + 45`, `64 - 31`) have
information gain of exactly 0 and the selector never picks them.

### Inference

- **Space** — `CORRECT` plus every bug live on at least one bank item.
- **Prior** — 0.5 on `CORRECT`, the rest uniform. Most children are not broken.
- **Likelihood** — slip-and-guess. `P(obs | h) = 1 - ε` on a match, else `ε`
  spread over the other distinct predictions plus a residual bucket for answers
  nobody predicts. `ε = 0.1`.
- **Floor** — every posterior is floored and renormalized. Nothing is ever
  eliminated; children slip, and one unlucky response must not permanently kill
  the truth. Pinned by a test.
- **Selection** — maximize `I(H ; R)` over unasked items.
- **Stopping** — one hypothesis past 0.85, budget exhausted, or no remaining
  item carries information.
- **Trace** — the full posterior sequence is returned. The UI animates belief
  narrowing, so the trace is a product requirement, not debug output.

The engine is stateless; learner state is passed in.

### The asset swap contract

Final art is produced outside the repo (brief in `design/ASSET-BRIEF.md`) and
dropped in wholesale, so composition depends on structure that an outside tool
could easily break. `src/ui/assets/assets.test.ts` encodes that structure:
shared 240x240 coordinate space, no hard-coded colors (every fill resolves
through a `--bot-*` token), self-contained flat SVG, the runtime slots shipping
empty, and every tell and silhouette the palette names actually existing.

One of those tests exists because the rule was broken in practice: a tell drawn
over the eyes removes the only expressive channel the characters have and the
bot goes dead on screen. Expression is carried by eye shape alone, so
`no overlay tell draws inside the eye band` is now asserted rather than
remembered.

### Look and feel: "Case Files"

The child is a detective and the suspect board is a corkboard. Thick ink
outlines, hard offset shadows, index cards on pushpins, rubber stamps, twine
— everything a seven-year-old already knows about finding the culprit.
Designed in Claude Design against the brief in `design/UI-BRIEF.md`.

Two things in it are load-bearing rather than decorative.

**The board changes density with evidence.** Before any test, nothing is known
and every suspect is equally likely, so the board is a plain roster with no
meters — thirteen identical bars would be noise dressed as data. Meters appear
only once a test has ruled something out.

**The tie hangs two cards from one twine at the same height**, with an `=`
tag between them, rather than stacking them in a list. Two things at equal
height read as tied; two things stacked always read faintly as ranked. That
distinction matters because the deadlock is the clearest evidence the engine
is reasoning rather than sorting.

The design fit exactly fourteen cards with the last row on the bottom edge, so
one more bug would have broken it. Above ten suspects the cards tighten
(`.cards.dense`) and the board keeps slack at any count.

### The game: mutual diagnosis

The child debugs the robot while the engine debugs the child, and the same
item does both jobs at once.

A patient robot arrives visibly glitching. The child **picks which problem to
test it with**, the robot answers wrongly and consistently according to its
bug, and the suspect board narrows. The child is then asked what the answer
should really have been — which is where their own arithmetic is exercised,
because you cannot notice a deviation from a rule you do not know.

The suspect board opens as the *whole* library: the robot could have any of
the thirteen bugs. One wrong answer rules out most of them at once, because
every hypothesis predicting the correct answer is contradicted immediately.

The flagship case runs **14 suspects -> 2 -> 1 in two tests**, and the middle
step is the best thing in the demo. After `40 - 27` the board does not narrow
to the answer — it deadlocks on exactly two suspects at 48.5% each:

    48.5%  Always takes the small number from the big one
    48.5%  Thinks zero take away something is that something

Those are the structurally confounded pair from the collision report. Both
write 27 on that problem, so no amount of repeating it or making it harder can
separate them. `71 - 28` splits them apart and the leader jumps to 99.2%.
The mechanic the whole submission rests on is visible on screen, in two moves,
without anyone having to explain it.

Three tests are offered each round, deliberately of mixed quality, and they
are **not labeled**. One of them cannot separate the remaining suspects at all.
Discovering that some questions are worth more than others is the numeracy
work, so the feedback arrives after the choice, not before.

Problems are **generated**, not drawn from a list. The bank holds ten
subtraction items and a child fixing one robot sees about twelve of them —
three offer rounds of three, plus three practice drills — so a fixed pool is
exhausted inside a single case and every retest afterwards is a rerun.
Shuffling the order does not help; it permutes the same numbers. Generation
reaches roughly 8,000 distinct subtraction problems, 4,300 addition, 3,000
place value and 1,900 fraction.

The engine is untouched by this. Items are generated and then **classified by
running the real bug library over them**, so an item's diagnostic role is
measured rather than assumed: a control is an item on which nothing fires, a
deadlock item is one where two live bugs write the same answer. The
distinctness invariant does the rest — a generated item a bug does not
discriminate on is automatically not claimed by it.

Generation preserves two promises the hand-built bank made. Subtraction never
goes negative, and a generated fraction sum is only kept when it is already in
lowest terms — otherwise a child writing 1/2 for 2/4 would be right and marked
wrong.

**This made the engine visibly better, and cost the demo something.** The bank's
strongest question was a three-way split worth 1.19 bits. Generation finds
items where all four live bugs write different answers, worth 1.32 bits, and
information gain correctly prefers those. So the deadlock that used to be
guaranteed on the best opening pick now happens about 71% of the time; the rest
are resolved outright. That is the engine doing its job better than the bank
allowed, and forcing it back to 100% would mean choosing offers using the
robot's actual bug — the one thing the game is about not doing.

A test with *lower* expected gain can still resolve the board in one move,
because gain is an average over answers the robot might give and a narrow
question sometimes lands on a bucket nobody shares. When that happens Sprocket
names it rather than letting it pass as an unremarked shortcut.

Diagnosing the robot uses the same engine with honest parameters rather than
the child's: a machine never slips (`eps` 0.02 against a child's 0.1), and it
arrived in the repair bay visibly broken, so almost no prior mass sits on "no
bug" (0.06 against a child's 0.5).

Finding the bug is explicitly not fixing it. The repair screen says so, which
is what sets up the mastery rule below.

### The mastery loop, as the child meets it

The rule below is not just modeled, it is playable end to end:

**bench → case → bug named → practice → probation → (two sessions) → warm-up →
repaired or cracked**

Nothing on the warm-up screen marks the retest. It is one of four quick
problems, never first, drawn from the current rung of the ladder so the
material around it really is new. No marker, no grouping, no styling, no copy —
a probe the child can see coming is one they can prime for, and priming is
exactly what this mechanic exists to rule out.

The failing outcome was the screen most at risk of going wrong, so it is worth
naming what it does not do: no sad face, no red, no grade. Sprocket goes to
thinking, the answer sits in a neutral slate, and the result is framed as
information — "that's useful: now we know exactly where to look". A robot that
cracks back open is a puzzle reopening, not a punishment.

The bench sorts robots by state and the shelf is the whole story: glitching
robots keep their tell, robots waiting on a retest have lost the tell but are
not signed off, repaired robots are plain. **Come back later** advances the
session clock; it exists so the delayed retest can be seen inside a
three-minute demo rather than two days, and it is labeled as what it is.

### Mastery: why a streak is not enough

Everyone else rewards consecutive correct answers. Three in a row measures
short-term recall, which a child can produce by holding a procedure in working
memory for ninety seconds. This measures retention instead.

A bug moves through four states. Reaching a streak earns **probation**, never
repair — that one line is the whole difference:

```
unseen -> diagnosed -> probation -> repaired
              ^                        (permanent)
              |
              +-- failed retest: the robot cracks back open
```

Two sessions after the streak, that bug's discriminating item quietly
reappears **mixed into new material** — never first, and kept apart from other
retests, because a probe presented in its own block is announced and the child
primes the procedure. Pass it and the repair is permanent. Fail it and the
robot cracks open, the streak is wiped, and the retest clock is cleared.

Three guards exist because without them the rule quietly degrades back into a
streak counter, and each is pinned by a test:

- streaks reset between sessions, so "three in a row" can only mean one sitting
- practice on a bug already in probation cannot restart or shortcut its clock
- the retest item is chosen to be the *least ambiguous* live item for that bug,
  so a wrong answer pins the blame on that bug and no other

The retest clock survives a page reload, since the mechanic spans sessions and
therefore has to span `localStorage` too.

`npm run mastery` prints the whole story end to end, including both outcomes.

Progress is a repair log rather than XP: the bar is made of competencies and it
is finite, so the child can see the end. The band ladder runs place value ->
addition regrouping -> subtraction regrouping -> fractions as numbers, and a
rung only opens when every bug in the band below is repaired.

### Remediation: the only place a model belongs

It runs strictly after diagnosis, so nothing here touches the inference path.
The division of labor is what makes it safe to put in front of a child:

**Every number is computed; the model only writes the words.** The
counterexample, the broken procedure's answer and the true answer all come
from the engine. A model that hallucinates arithmetic can therefore only
produce prose that contradicts numbers already on file.

**And that contradiction is checked.** `src/remediation/validate.ts` extracts
every arithmetic assertion from generated text and verifies it before the copy
is ever written to disk. The subtlety is that this copy is *supposed* to quote
wrong answers — "Rivet says 71 - 28 is 57" is false as arithmetic and true
about the robot — so a claim passes when it matches real arithmetic **or** when
it is exactly what that bug's procedure computes. Anything else is a number
nobody can account for and it is rejected. The gate also blocks technical ids,
scolding, model artifacts, and copy too hard for a seven-year-old.

The deterministic fallback is held to the same gate, because a fallback nobody
checks is just an unvalidated string with a nicer name.

**Generation is offline** (`npm run remediation`), and the result is committed.
The deployed game needs no API key, no backend and no network at play time, and
the cost on screen is a measured number rather than an estimate. Routing is by
task complexity: the child explanation to Sonnet, the parent note to Haiku.
Prices are per the published pricing page, and a model missing from the table
reports a null cost rather than a guessed one.

**The prompt contains the bug and three example problems — no name, no answers,
no history.** The parent note says so on screen, so it is enforced by
construction and pinned by a test rather than left to good intentions.

Without a key the game runs entirely on the deterministic copy, which is what
is committed today.

### The 13 bugs

| id | band | child sees |
| --- | --- | --- |
| `sub_smaller_from_larger` | sub_regroup | Always takes the small number from the big one |
| `sub_borrow_no_decrement` | sub_regroup | Takes ten but forgets to pay it back |
| `sub_zero_minus_n_is_n` | sub_regroup | Thinks zero take away something is that something |
| `sub_zero_minus_n_is_zero` | sub_regroup | Thinks zero take away anything is still zero |
| `add_carry_dropped` | add_regroup | Forgets to carry the one |
| `add_carry_written_both` | add_regroup | Writes the whole number in one box |
| `add_left_align` | place_value | Lines the numbers up on the wrong side |
| `pv_concatenate` | place_value | Glues the numbers together instead of adding |
| `pv_drop_empty_place` | place_value | Skips the empty box instead of writing zero |
| `frac_add_across` | fraction_number | Adds the tops and the bottoms |
| `frac_common_denom_keep_numerators` | fraction_number | Fixes the bottoms but forgets the tops |
| `frac_bigger_denominator_wins` | fraction_number | Thinks a bigger bottom means a bigger piece |
| `frac_numerator_only` | fraction_number | Only looks at the top number |

`add_left_align` is filed under place value rather than addition because that
is what it actually diagnoses.

Fraction answers stay unreduced where the bug produces them that way. `2/6` is
what the child writes; reducing it to `1/3` erases the signal.

---

## How the rubric clauses get answered

**"interactive, gamified, intuitive"** — the debugging frame. Diagnosing a
broken rule requires understanding the correct rule well enough to notice the
deviation. Most math games make arithmetic faster; this makes the procedure
visible by showing a broken version of it.

**"innovative mechanics"** — mutual diagnosis, and information-gain item
selection. Not difficulty adaptation.

**"steady progression"** — belief narrowing within a session, the repair log
across sessions, the band ladder within a skill.

**"reward mastery"** — delayed interleaved retesting, not streaks. Three in a
row measures short-term recall. A bug is retired only when its discriminating
item quietly reappears two sessions later, mixed into new material.

---

## Scope discipline

No auth, no accounts, no leaderboard, no backend, no server-side persistence.
Those cost days and prove nothing. Progression is `localStorage`.

Grades 1–4, not all of K–5. Multiplication misconceptions are well documented,
but a fifth band buys breadth instead of depth, and depth is what the
subtraction band demonstrates. Stated deliberately rather than silently.

---

## Running it

```bash
npm install          # typescript + @types/node, dev only — the engine has zero deps
npm run check        # typecheck + 34 tests
npm run simulate     # the evaluation numbers above
npm run collisions   # per-item hypothesis fusion report
npm run cast         # renders every character to out/contact-sheet.html
npm run mastery      # walks through the delayed interleaved retest
npm run remediation  # regenerate the model-written copy (needs ANTHROPIC_API_KEY)
npm run dev          # the game
npm run build        # production build into dist/
```

Node 22+, native type stripping, no build step. Relative imports end in `.ts`.

---

## What is next

1. **Game layer** (`src/ui/`) — screens. The character system is done and the
   final art is in: one 240x240 skeleton, three eye states, seven glitch tells,
   nine silhouette variants and a 13-entry palette table compose the whole cast,
   so a bot is a fill swap rather than a drawing. `npm run cast` renders all
   fourteen. Sprocket the host, patient bots with a visible
   glitch tell *before* the math starts, the belief display narrowing from nine
   suspects to four to one, and the repair moment where the bug is named in
   `childLabel` language. Sprocket never says "you're wrong": wrongness is data
   in this app and the mascot has to behave like it.
2. **Remediation** — the one place a model belongs. Once the bug is known, it
   generates the counterexample that breaks that specific bug in language a
   seven-year-old parses, plus a plain-English parent note. Cheap generations to
   Haiku, explanations to Sonnet, cost per session instrumented and shown on
   screen.

### Known limitations

- Two hypothesis pairs are structurally confounded and resolvable only by
  elimination (above). This is a property of the arithmetic, not of the engine,
  but it means those bugs need more items and are the first place accuracy
  drops.
- The bug library is 13 of the ~100 procedural bugs Brown & Burton cataloged.
  Breadth here is cheap to add later and would not change the architecture.
- Evaluation is against synthetic students generated from the same bug library
  the engine reasons over. It validates the *inference*, not the claim that
  these 13 bugs are the right 13 — that claim rests on the literature, and
  real-child validation is out of scope for a two-week build.
