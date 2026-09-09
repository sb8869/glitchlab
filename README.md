# Glitch Lab

A K-5 math game that diagnoses **which broken procedure** a child is running,
instead of lowering the difficulty when they answer wrong.

**Play it: https://glitchlab-lyart.vercel.app**

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
| 1. Bug library (13 executable misconceptions) + problem generation | done, 32 tests |
| 2. Inference engine (Bayes + information gain) | done, 15 tests |
| 3. Simulation harness (500 students) | done, result below |
| 4. Progression and mastery (ladder, probation, delayed retest, storage) | done, 45 tests |
| 5. Game layer | full loop playable, 13 screens, 34 tests |
| 6. Remediation layer | done, 17 tests |

`npm run check` — typecheck plus 147 tests, all green.

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
src/remediation/ counterexample, column-by-column trace, the validation gate, copy
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

### The robots are alive when nothing is happening

Every robot used to be a static drawing until something happened to it, which
for a game aimed at five-year-olds is most of the screen for most of the time.
Three loops fix that: the antenna sways, the eyes blink, and a robot that
still has a tell twitches it. All three are transform-only, so a bench of
fifteen costs compositing and nothing else, and all three run at a
per-character **negative** delay so the robots start partway through their
cycles — in lockstep, thirteen blinking bots read as a screensaver rather than
a room full of machines.

Two details are load-bearing. The hooks are **classes spliced in after
composition, never ids**, for the reason `assets.test.ts` gives: fifteen bots
on a page means fifteen `#bot-antenna`s. And the sway is **skipped for the two
robots wearing the bent-antenna tell**, because that tell is itself an inline
transform on the same group — animating the property would have straightened
the bend and silently erased their glitch.

### Arriving, reacting, and one moment worth being loud about

A robot **arrives** on the bench rather than appearing there — it drops in and
settles. The animation sits on the `.bot` span inside `.patient` rather than on
`.patient` itself, which is not fussiness: the shudder below toggles a class on
an ancestor, and with both animations on the same element every shudder
replayed the entrance. An ancestor's class does not change a child's computed
`animation-name`, so on separate elements the two compose instead of fighting.

A robot **reacts to being tested**. When it produces its wrong answer it
shudders, brightens, throws a red flash behind itself and kicks the spotlight —
the one moment the child is looking straight at it, and previously a number
appearing in a box. The class rides the wrapper rather than the robot, because
the spotlight is a sibling that comes *before* the robot in the markup and CSS
cannot select backwards.

And the **empty bench** — thirteen robots repaired, every repair held through a
delayed retest days later — gets a full-window burst of 52 pieces, a stamp that
lands, and the one fanfare in the app. That is the end of the game. It was a
sentence. It happens exactly once, which is the argument for it being the one
place here that is genuinely extravagant.

All of it off under `prefers-reduced-motion`, where the fanfare still plays:
sound is not motion.

### One stylesheet, and the guard that makes it safe

There is a single stylesheet, no CSS modules and no scoping. That is a
reasonable choice at this size and a sharp edge at the same time: a class
styled by a bare selector is a global name, and reusing one for something
unrelated restyles the original silently. It happened three times in one
afternoon — `.pick` (the fraction picker's row layout, reused for a tappable
suspect card, which laid the card out as a flex row and shrank its probability
meter from a 105px bar to a 4px stub), `.mute` (the bench's tone for the locked
shelf, reused for the sound toggle, which restyled a whole `<section>` into a
34px square), and `.verdict` (the case-closed banner, reused for a line inside
a suspect card). None threw. None failed a test. Two were found by looking at
a screenshot.

So `styles.test.ts` enforces three things instead: every class a component
applies has a rule, every rule is applied by some component, and a global
class name is used by only one component unless it is listed as deliberately
shared. It found the three above, plus a `.np-row.active` that was being
applied to style nothing at all and three rules left behind by removed
features.

`assets.test.ts` enforces the matching invariant in the art: bot SVGs may
define ids but must never reference them, because composition keeps the
skeleton's slot ids and a page renders up to fifteen bots — a gradient or
clipPath reference would bind every robot to the first one's paint.

### Look and feel: "Case Files"

The child is a detective and the suspect board is a corkboard. Thick ink
outlines, hard offset shadows, index cards on pushpins, rubber stamps, twine
— everything a seven-year-old already knows about finding the culprit.
Designed in Claude Design against the brief in `design/UI-BRIEF.md`.

Five things in it are load-bearing rather than decorative.

**A suspect card is a number, not a sentence.** Each card leads with what that
bug *writes* — `33 - 25 -> 12` — and its description stays hidden until the
board is down to three suspects or the child taps the card. The sentences used
to lead, which made the opening board ninety-five words of prose across
thirteen cards: a reading test wearing a math game's clothes, on the one
screen a five-year-old meets first. It is also the wrong way round. A bug here
*is* an executable procedure, so the evidence a child should compare is the
output, which they can check, rather than a description of it, which they can
only take on trust. Tapping reveals; naming the culprit is a separate button
on the revealed card, so a mis-tap on a thirteen-card grid is no longer a
wrong accusation.

**The board changes density with evidence.** Before any test, nothing is known
and every suspect is equally likely, so the board is a plain roster with no
meters — thirteen identical bars would be noise dressed as data. Meters appear
only once a test has ruled something out.

**Ruling a suspect out is staged, not repainted.** Narrowing thirteen
possibilities to one is the most exciting thing a child does here, and it used
to happen as a re-render: the cards were simply not there any more. Now each
eliminated card is stamped where it hangs and swept off toward the pile, in a
staggered cascade, and the whole board runs on two clocks. The headline count
moves when the sweep *begins*, because the compare screen puts "1 suspect
left" in a chip a few inches away and the board must not contradict it. The
cards, their sentences and the pile move when the sweep *lands*, because a
suspect must never be listed as filed while its card is visibly still pinned
up. The board is also held through the answer: the engine narrows the moment
a test tool is picked, but the child is looking at the answer box then, so the
sweep waits for their answer and lands on the sentence that describes it.
Everything is off under `prefers-reduced-motion`, which costs no information.

**The tie hangs two cards from one twine at the same height**, with an `=`
tag between them, rather than stacking them in a list. Two things at equal
height read as tied; two things stacked always read faintly as ranked. That
distinction matters because the deadlock is the clearest evidence the engine
is reasoning rather than sorting.

**A card can be asked the last question.** Opening a suspect shows what *it*
would have written on the problem just run, beside what the robot actually
wrote. For anything still on the board the two always match, and that is the
content rather than a flaw: it is the reason that card survived, checkable one
card at a time in numbers rather than asserted in a sentence. It earns its
place on a test that ruled nothing out — Sprocket says "some tests don't", and
the cards can then be asked why: every one of them writes what the robot
wrote. It is deliberately about the problem already run and never about the
tests on offer, because showing what each suspect would say to an unplayed
test would turn choosing a good question — the numeracy work this game exists
for — into reading answers off the board.

The design fit exactly fourteen cards with the last row on the bottom edge, so
one more bug would have broken it. Above ten suspects the cards tighten
(`.cards.dense`) and the board keeps slack at any count.

The same word budget governs the how-to-play screen, which is **28 words**:
the premise, the cast, and three verbs. It was 113, and the test applied to
every sentence cut was whether the game already says it at the moment it
matters. It did, every time, nearly verbatim — "some questions tell you far
more than others" is Sprocket's line on the screen where a test is picked,
"you need the right answer to spot what the robot got wrong" is his line on
the screen where the child answers, and the delayed-retest rule is explained
at the end of the repair drills, where it applies. Front-loading all three
taught nothing and spent the only attention a five-year-old arrives with. The
grown-up note below it is untouched at 97 words and still folded away: it is
written for the one reader who came here to read.

**Four cues, and none of them for a correct answer.** A suspect ruled out
gets a rubber-stamp thud (one per card, capped at four, or thirteen at once
would be a machine gun), a closed case gets a rising three-note figure, and a
repaired robot gets the only short cue that resolves upward and rings, and an
empty bench gets a fanfare that is deliberately longer than the rest, because
it happens once. Each marks something the repair log already recorded. Nothing fires on a right
answer, for the same reason nothing else here rewards one: the diagnosis is
fed by honest wrong answers, and a child who learns that being right makes a
happy noise starts guessing safe. They are synthesized from oscillators and a
noise buffer — no files, nothing fetched, consistent with the rest of the app
running entirely on the device — and the mute toggle in the header is
remembered. Sound is not motion, so `prefers-reduced-motion` silences the
animation and keeps the cue: a child who has turned motion off is still told
that something happened.

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

The case worth watching for runs **14 suspects -> 2 -> 1 in two tests**, and
the middle step is the best thing in the demo. After `40 - 27` the board does
not narrow to the answer — it deadlocks on exactly two suspects at 48.5% each:

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

**bench → case → bug named → practice → probation → (a few sessions) →
warm-up → repaired or cracked**

Nothing on the warm-up screen marks the retest. It is one of four quick
problems, never first. No marker, no grouping, no styling, no copy — a probe
the child can see coming is one they can prime for, and priming is exactly what
this mechanic exists to rule out.

Four properties do the hiding, and all four are load-bearing:

- **A warm-up opens every session**, retest or not. One that appeared only when
  something was due would announce the probe by existing.
- **It is always the same length.** One that grew with the queue would announce
  the probe by size.
- **At most one retest rides in it.** With five robots due, five probes among
  eight problems is not camouflage — the difficulty visibly jumps. The rest
  keep their place in the queue; waiting past the minimum is stronger evidence
  of retention, not weaker.
- **The probe is never the odd one out.** A warm-up is two matched pairs — two
  problems of one band and kind, two of another — so a retest always has a
  twin. Material is drawn from every band the child has worked in, not from the
  current rung, and not from the probe's band. Warm-ups used to come from the
  current rung alone, which early on is place value, so a subtraction retest
  was the only subtraction on the page and could be pointed at by a child who
  had learned no arithmetic at all. A mix that shifted to the probe's band only
  when a probe was present would be the same tell wearing a different hat.

The warm-up names no robot, and the shelf of robots waiting on a retest is
inert: not clickable, no "due now", no relabeling. Letting a child walk up and
take the probe deliberately would hand them the one thing the retest is asking.

The failing outcome was the screen most at risk of going wrong, so it is worth
naming what it does not do: no sad face, no red, no grade. Sprocket goes to
thinking, the answer sits in a neutral slate, and the result is framed as
information — "that's useful: now we know exactly where to look". A robot that
cracks back open is a puzzle reopening, not a punishment.

The bench sorts robots by state and the shelf is the whole story: glitching
robots keep their tell, robots waiting on a retest have lost the tell but are
not signed off, repaired robots are plain. **Close up for today** advances the
session clock; it exists so the delayed retest can be seen inside a
three-minute demo rather than over a week, and the screen after it says so
rather than pretending days really passed.

Append `?peek` to the URL for a read-only readout of the schedule and of which
warm-up problem is the probe. The mechanic is invisible by design, which makes
it invisible to whoever is testing it — this is the window, and a child never
meets it.

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

Two sessions after the streak — plus up to one more, jittered per robot so a
batch repaired in one sitting does not all come due in the same later one —
that bug's discriminating item quietly reappears **mixed into new material**,
never first and never alongside another retest, because a probe presented in
its own block is announced and the child primes the procedure. Pass it and the
repair is permanent. Fail it and the robot cracks open, the streak is wiped,
and the retest clock is cleared.

A cracked robot goes back to the *repair* loop, not the retest queue: probing
the same gap again without teaching anything in between would only measure the
same miss twice. It reopens at the bench with the working already on screen,
because the bug is known and rediscovering it on a fourteen-suspect board is
busywork dressed as a game.

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
rung opens the session AFTER every robot on the rung below has been found and
drilled to probation.

Drilled, not repaired — a deliberate choice. Gating on repair would hold each
rung hostage to a two-to-three session retest delay for every robot beneath
it, so addition would not appear for five or more visits. Reaching probation
is the child's own work and takes one sitting; the retest is the app's
business, and the ladder should not punish them for a clock they cannot see.

But not the *same* sitting. A child who blitzes place value in twenty minutes
would otherwise roll straight into addition, then subtraction, and finish the
whole ladder in one go — which is cramming, and cramming is the thing this
app spends its entire mastery rule refusing to reward. **One rung a visit.**
It also gives a session a shape and an ending: you work the rung that is
open, and when it is done the bench says so and sends you home.

The gate is monotonic: a robot that cracks open on a failed retest never
re-locks a rung the child is already working on. Robots on a shut rung stay
visible on the bench, because a finite bar is only worth having if the end of
it is in view.

### Remediation: teaching, after the diagnosis

It runs strictly after diagnosis, so nothing here touches the inference path.

**Every number is computed, and so is the working.** The counterexample, the
broken procedure's answer and the true answer all come from the engine, and
`src/remediation/trace.ts` replays both procedures column by column with the
borrows and carries written in. This matters more than the two answers do: a
buggy procedure is a *procedure*, so showing only the results hides the thing
being taught, which is where the two methods part company. The child sees the
robot's column work beside the correct column work with the differing digits
lit.

**The words are assembled here too, and they are still checked.**
`src/remediation/validate.ts` extracts every arithmetic assertion from the copy
and verifies it against what the engine computed. The subtlety is that this
copy is *supposed* to quote wrong answers — "Rivet says 71 - 28 is 57" is false
as arithmetic and true about the robot — so a claim passes when it matches real
arithmetic **or** when it is exactly what that bug's procedure computes.
Anything else is a number nobody can account for and it is rejected. The gate
also blocks technical ids, scolding, and copy too hard for a seven-year-old.
Text we wrote ourselves goes through it too: "we wrote it" is not a proof that
the arithmetic in it is right.

**Nothing here calls a service.** There is no API key, no backend, no network
at play time and no per-session cost, because the explanation is derived from
the same bug object the diagnosis used. Remediation works on a plane.

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
item quietly reappears two or three sessions later, mixed into new material.

---

## Where this sits in K-5

Every band maps to a specific standard, and the fraction band reaches the top
of the range:

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
first-grade arithmetic is counting, number sense and fluency within twenty —
real content, but not multi-step written algorithms, so there is nothing for a
bug library to be a library *of*. The first place a child's arithmetic becomes
a procedure that can go systematically wrong is regrouping, and that is where
this starts.

---

## Scope discipline

No auth, no accounts, no leaderboard, no backend, no server-side persistence.
Those cost days and prove nothing. Progression is `localStorage`.

Four bands spanning grade 2 through grade 5 (see the standards table above),
not every topic in K-5. The missing multiplication and division band is a time
decision, not a principled one — those misconceptions are well documented and
would fit this engine as well as any band here. Said plainly rather than
dressed up as a choice.

---

## Running it

```bash
npm install          # react + vite for the game; the engine itself has zero deps
npm run check        # typecheck + 147 tests
npm run simulate     # the evaluation numbers above
npm run collisions   # per-item hypothesis fusion report
npm run cast         # renders every character to out/contact-sheet.html
npm run mastery      # walks through the delayed interleaved retest
npm run dev          # the game
npm run build        # production build into dist/
npm run preview      # serve that build
```

Node 22+. Everything under `src/bugs`, `src/engine`, `src/learner` and
`scripts/` runs directly under Node's native type stripping with no build step
— which is why the tests, the simulation and the collision report need no
toolchain at all. Only the React front end is bundled, by Vite. Relative
imports end in `.ts` throughout so both paths resolve the same files.

Append `?peek` to the URL for a read-only readout of the retest schedule and of
which warm-up problem is the probe. The mechanic is invisible by design, which
makes it invisible to whoever is testing it too.

---

## What is next

1. **A fifth band: multiplication and division.** Long multiplication and long
   division are the richest documented source of buggy procedures in the
   literature — dropping the zero placeholder in the second partial product,
   shifting the wrong way, mishandling the bring-down — and they would fit this
   engine almost unchanged, being column procedures with carries and place
   shifts. Left out for time, not for principle.
2. **Real children.** Everything below the interface is validated against
   synthetic students generated from the same bug library the engine reasons
   over. That tests the inference; it cannot test the library.

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
