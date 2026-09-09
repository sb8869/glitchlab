# The demo film

`glitchlab-demo.mp4` — 2:22, 1920×1080, 30fps, silent.

## What it is

Twelve scenes composed in [Remotion](https://remotion.dev) over **real
footage of the real app**. Nothing in the footage is mocked, re-created or
sped up: it is a scripted Playwright session driving the built site, recorded
at native 1080p.

Three takes were shot:

| take | what it captures | state it needed |
| --- | --- | --- |
| `a-diagnose` | start screen, bench, one robot diagnosed, the board collapsing, case closed, both procedures worked out, the repair | a clean lab, session 1 |
| `b-later` | closing up, the days passing, the warm-up with the retest hidden in it | session 3 |
| `c-tie` | the structurally confounded pair deadlocking on `= TIED` | session 3, a subtraction robot |

The session-3 state was **played, not fabricated**: a walker script actually
diagnoses and drills the three place-value robots and the two addition robots,
closing up between sessions, then hands the resulting `localStorage` to the
takes that need it. The ladder gate is real, so there is no shortcut past it.

Two takes were shot more than once on purpose, and it is worth being straight
about why:

- **`a-diagnose`** is re-shot until the first test collapses the board to three
  or fewer suspects. Information gain usually does that; when it does not, the
  caption "fourteen suspects down to one" would be describing something the
  footage does not show. The recorder rejects those takes rather than letting
  the film overclaim.
- **`c-tie`** is re-shot until the tie actually appears, and the test tool is
  chosen preferring a minuend containing a zero — which is exactly where
  smaller-from-larger and zero-minus-n write the same answer. That is the
  mechanism the beat is about, not a trick to produce it.

## The narration

The film is silent by design. `NARRATION.md` is the script with per-scene
timings; `narration.txt` is the same words with no markup, one block per line
in scene order, for reading aloud or for TTS.

The on-screen captions are deliberately short labels rather than a transcript,
so that a voice track has somewhere to live.
