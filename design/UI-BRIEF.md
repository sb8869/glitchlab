# Claude Design brief — Glitch Lab screens

*Paste everything below the line. Attach `glitchlab-current-ui.png` (the five
built screens as they look today) and, if it helps, point at the repo:
https://github.com/sb8869/glitchlab*

---

I'm building **Glitch Lab**, a math game for 6–10 year olds. A child debugs a
robot that does arithmetic wrong: the robot has a broken procedure, and the
child hunts for its bug while the system hunts for theirs.

**There is already a working React app.** The attached image shows all five
built screens exactly as they render today. I am not asking you to invent this
product — I'm asking you to make it look designed rather than assembled, and to
design the seven screens that don't exist yet. Treat the screenshot as the
brief's real content: the copy, the data shapes and the states in it are all
real and all constrained.

The deliverable this feeds is a 2–3 minute demo video reviewed by engineers.
Anything that doesn't read in three minutes at 1280px doesn't matter.

## The loop, so the screens make sense

A patient robot arrives visibly glitching. The child picks a problem to test it
with. The robot answers wrongly and consistently. The **suspect board** on the
right narrows. The child is also asked what the answer *should* have been —
that's their own arithmetic being exercised, and it's how the system diagnoses
the child in parallel. When one suspect is left, the child names the bug.

Finding the bug is deliberately **not** fixing it. Two sessions later that
bug's problem quietly reappears mixed into new work; passing it makes the
repair permanent, failing cracks the robot back open.

## What to design

**Redesign these five** (they exist and work — see the screenshot):

1. **Meet the patient** — a robot arrives, glitch tell visible before any math.
2. **Choose a test** — three problems offered, deliberately unlabeled.
3. **Robot answered** — the robot's wrong answer, and an input for the child to
   say what it really should be.
4. **Narrowing** — problem / robot's answer / true answer side by side, plus
   how many suspects that test ruled out.
5. **Bug named** — the misconception stated in a child's words, with the proof.

**Design these seven from scratch** (they don't exist yet):

6. **Repair bay / home** — choose which robot to work on. Shows which are
   glitching, which are on probation, which are repaired.
7. **Repair log** — the progress bar is made of competencies and is **finite**
   (13 robots), so the child can see the end. Also shows the band ladder:
   place value → addition regrouping → subtraction regrouping → fractions.
8. **The delayed retest** — the moment a repaired-looking bug's problem
   reappears, quietly, inside new work. It must NOT look like an exam.
9. **Cracked back open** — the retest was failed. This is the hardest screen in
   the set: it has to be honest without being a punishment. No sad faces, no
   red X, no "you failed". The robot cracks; the child gets another go.
10. **Remediation** — one counterexample that makes the bug visible, written for
    a seven-year-old. This is the only screen where an LLM writes the copy, so
    design it to hold 2–4 short sentences plus a worked example.
11. **Parent note** — the same diagnosis in plain English for an adult, plus a
    small honest "this session cost $0.004" meter.
12. **All repaired** — the finite bar is full. What does the end look like?

Plus the unglamorous ones, which I will otherwise get wrong: **empty state**
(no robot diagnosed yet) and **storage unavailable** (progress can't be saved —
must be honest, not alarming).

## Hard constraints

**Use the existing characters. Do not draw new ones.** Sprocket (teal host) and
13 patient bots already exist as a composed SVG system — one skeleton, swapped
colors, eyes and glitch tells. They're in the repo under `src/ui/assets/`. If a
screen needs a robot, use these.

**Sprocket never says "you're wrong" and has no sad state.** On a child's
error, Sprocket goes to *thinking*, never to a frown. Wrongness is data in this
app and the mascot has to behave like it. Please don't add a disappointed
expression even where one seems obviously missing — that's the single thing
most likely to break the product.

**Patient robots are a puzzle, not a rescue.** Glitching, never suffering. No
tears, no droop, no grey powered-down state, no X eyes.

**The suspect board is the hero and it has a brutal range.** It opens holding
14 items and ends holding 1. Both extremes have to look deliberate. Today the
ruled-out ones collapse to compact strikethrough lines under a "Ruled out · 11"
divider; improve on that if you can, but the live suspects must never be
crowded out by the dead ones.

**The most important single frame in the entire video is a tie.** After the
first test the board often deadlocks on exactly two suspects at 48.5% each:

    48.5%  Always takes the small number from the big one
    48.5%  Thinks zero take away something is that something

These two are mathematically indistinguishable on that problem — both write 27
— and the next test splits them. That deadlock is the whole thesis of the
project made visible. **Design a state for it.** It must read instantly as
*"these two are tied and we cannot yet tell them apart"*, not as a ranked list
where one happens to be on top.

**Content limits, from the real data:**
- Suspect labels are 24–49 characters. The longest is "Thinks zero take away
  something is that something". They must wrap, never truncate.
- Every suspect carries a signature example like `305 - 128 → 223`, where the
  wrong answer is the emphasized part.
- Suspect count is 1–14. Percentages are 0–100 and frequently tied.
- Never show a technical id (`sub_smaller_from_larger`) to a child.

**Accessibility:** color can't be the only signal — ruled-out, live and leading
suspects need a non-color difference too. Numbers use tabular figures so digits
line up between the robot's answer and the true answer.

## The existing design tokens

Keep these **names**; change the values freely if you can do better, and give
me a table of what you changed.

```
--ink #14343f   --ink-soft #5b7683   --ink-faint #93a9b3
--paper #f2efe7 --surface #ffffff    --line #dfe7ea
--teal #4fd1c5  --teal-deep #2fa89d  (Sprocket / the system)
--accent #f6b93b (the child's turn to act)
--glitch #e8536f (the robot being wrong)
--good #2e9a5f   (the true answer)
--radius 18px
```

The background is warm paper with a faint 26px graph-paper grid — a workshop
bench, not a clinic and not a sci-fi lab. Type is a rounded system sans.

## Deliverables

- One artboard per screen at **1280 × 832** (the frame the demo video records).
- Mobile variants at **390 × 844** for screens 2, 3 and 4 only.
- A **component and state sheet**: suspect card (live / leading / tied /
  ruled out), test button (default / hover / chosen), the three answer slates,
  badges, buttons, and Sprocket's speech bubble.
- A **token table** of any values you changed, using the names above.

## Not needed

- New characters or character art — that system is finished.
- Renaming or reinventing the mechanics. "Suspects", "ruled out", "repair",
  "glitching" are the product's vocabulary.
- Marketing pages, logos, app-store art, onboarding tours.
- Animation specs. Transitions I can infer; motion design I can't implement in
  the time I have.
- Any screen that scolds, grades, or shows a failure face.

## Acceptance checklist

- [ ] All 12 screens present at 1280 × 832
- [ ] The tie state is unmistakably a tie, not a ranking
- [ ] The suspect board is legible holding 14 items and holding 1
- [ ] The longest suspect label wraps without truncating anywhere
- [ ] Nothing scolds the child; Sprocket has no sad state anywhere in the set
- [ ] "Cracked back open" reads as another go, not a punishment
- [ ] Live / ruled-out / leading differ by more than color alone
- [ ] Existing token names preserved, changes listed in a table
