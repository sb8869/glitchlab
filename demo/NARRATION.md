# Glitch Lab — demo narration

Timed to `glitchlab-demo.mp4` — **2:22**, 1920×1080, 30fps.

Each block is sized for an unhurried read at roughly **2.3 words per second**.
The on-screen text is short labels, not a transcript, so the voice carries the
argument and never competes with the captions.

For TTS use `narration.txt`: the same words, no markup, one block per line, in
scene order.

---

### 0:00 – 0:13 · Title

> When a child writes forty minus twenty-seven equals twenty-seven, that is not
> a guess. It is a procedure — take the smaller digit from the larger, in every
> column. Perfectly consistent, and wrong every time.

### 0:13 – 0:23 · The bench

> Glitch Lab gives that procedure a body. Thirteen robots, each running one
> broken method, the same way every time.

### 0:23 – 0:36 · The suspect board

> The board opens as the whole library — fourteen suspects, because it could be
> any of them. Each card shows what that bug writes, not a sentence describing
> it. Evidence a five-year-old can check.

### 0:36 – 0:48 · One test

> The child picks which problem to test with — some rule out far more than
> others. Then they answer it themselves. You cannot spot a deviation from a
> rule you do not know.

### 0:48 – 0:54 · Ask a survivor

> Tap a suspect that is still standing, and it writes what the robot wrote.

### 0:54 – 1:08 · The engine

> None of that is a model. Every card is a Bayesian update over fourteen
> executable procedures, and the next question is chosen by expected
> information gain. Ninety-eight point eight percent identification, in four
> questions instead of nearly ten.

### 1:08 – 1:21 · Case closed

> Naming the bug is not teaching it. So the app works both procedures side by
> side — the robot's way and the right way — computed by the engine, not
> written by a language model.

### 1:21 – 1:31 · Not fixed yet

> Three correct in a row, and the robot still is not fixed. A streak measures
> short-term recall and nothing else.

### 1:31 – 1:38 · A few days later

> So it goes back on the bench, and days have to pass before anything counts.

### 1:38 – 1:52 · The retest

> Then its own problem comes back, buried inside an ordinary warm-up.
> Unlabelled. Never first. One per visit. There is nothing to see coming, and
> passing it then is the only thing that marks a repair.

### 1:52 – 2:09 · Structurally confounded

> And when two suspects are genuinely indistinguishable, the app says so. These
> two write the identical answer on every problem where both are live. No
> amount of repeating it, or making it harder, will separate them — so the game
> names the one problem that will.

### 2:09 – 2:22 · Close

> A wrong answer is not a score to lower. It is a procedure to find. Glitch Lab
> runs entirely on the device, with no model anywhere in the inference path.

---

## Delivery notes

- Two lines carry the submission: **"fourteen suspects down to one"** at 0:36
  and the whole confounded-pair beat from 1:52. Slow down for both — everything
  else can move.
- Do not read the on-screen labels aloud. They are already on screen.
- Every number is measured: 98.8% vs 79.0% identification, 4.35 vs 9.73 mean
  items, on the 37-item bank in `src/bugs/bank.ts`. If you would rather quote
  the significance test, it is McNemar chi-square 89.92.
- If a block runs long, the safest words to drop are the second halves of the
  Title and Case-closed blocks. Do not trim the confounded-pair beat.
