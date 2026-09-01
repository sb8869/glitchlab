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
| 5. Game layer | characters + final art done, screens not started |
| 6. Remediation layer | not started |

`npm run check` — typecheck plus 77 tests, all green.

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
