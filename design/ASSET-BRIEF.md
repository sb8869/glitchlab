# Claude Design brief — Glitch Lab character system

*Paste everything below the line. Attach `src/ui/assets/bot-skeleton.svg`,
`eyes.svg`, `tells.svg` and `out/contact-sheet.html` — they are the working
placeholder system and they define the contract you must match.*

---

I'm building **Glitch Lab**, a math game for 6–10 year olds. A child debugs a
robot that does arithmetic wrong: the robot has a broken procedure, and the
child hunts for its bug while the system hunts for theirs. Mutual diagnosis.

I need you to design a **character system**, not a set of illustrations. There
is one body skeleton; every character is that skeleton with different colors,
a different eye group, and at most one glitch tell. Fourteen characters have to
cost roughly one drawing plus a table, because that is what fits the schedule.

I have a working placeholder version of exactly this system, attached. Open
`contact-sheet.html` to see all fourteen characters rendered. **Your job is to
replace the art while keeping the structure identical.** Treat the placeholder
files as an interface, not as a style reference — the shapes should get much
better, the ids and coordinates must not move.

## What to produce

1. **`bot-skeleton.svg`** — one body. Rounded, friendly, chunky enough to read
   at 96px. Named parts exactly as in the placeholder.
2. **`eyes.svg`** — three expressions, driven by **eye shape alone**: dots
   (idle), dashes (thinking), chevrons (celebrating). Same bounding box for
   each, so swapping never shifts layout. No mouths, no eyebrows, no color
   change between states — the whole point is that expression is a group swap
   and never new art.
3. **`tells.svg`** — six or seven glitch tells. Keep the five in the
   placeholder (cracked chassis, chest static, loose wire, dented head,
   sparks) and the two eye-based ones (dizzy spirals, mismatched eyes). Add one
   or two more if you see a good one.
4. **`silhouettes.svg`** — *this is the piece my placeholder is missing.*
   Three or four interchangeable variants each for **head shape** (square /
   round / tall), **antenna** (single knob / double / coiled) and **feet**
   (blocks / treads / round). Same anchor coordinates as the base parts so any
   combination composes. This is what stops thirteen bots reading as one bot in
   thirteen colors.
5. **A palette table** — 13 patient bots, each a `body` + `accent` hex pair,
   all clearly distinct from each other at thumbnail size and none of them
   teal. Plus one entry for Sprocket.
6. **App icon** — Sprocket, legible at 32px.

## Hard technical contract

Non-negotiable, because these files get swapped into a running build:

- **`viewBox="0 0 240 240"`** on every file. Every part stays at the
  coordinates in the placeholder — I compose characters by string-substituting
  groups, so a moved anchor breaks composition silently.
- **Every `id` spelled exactly** as in the placeholder files.
- **Color only via `var(--token, #fallback)`.** Never a bare hex in a `fill`
  or `stroke`. The tokens are `--bot-body`, `--bot-accent`, `--bot-face`,
  `--bot-outline`, `--bot-eye`, `--bot-glitch`. This is the entire "fill swap"
  mechanism; hard-coded color breaks it.
- **`#bot-eyes` and `#bot-tell` ship empty.** They are slots I fill at runtime.
- **No `<style>` blocks, no external references, no embedded raster images, no
  filters, no gradients.** Flat vector only. It has to stay a single
  dependency-free file that inlines into the page.
- Consistent stroke weight (the placeholder uses 4 for structure, 4.5 for
  tells) and `stroke-linecap="round"`.

If you can only export raster, say so — then I need transparent PNGs at 3x plus
the hex values, and I will rebuild the skeleton as vector myself. Vector is
much better; the whole color system depends on it.

## Art direction — the parts that are load-bearing

**Sprocket is the host.** Teal, permanently competent, *never broken*. Teal is
reserved for Sprocket so a child never confuses the helper with a patient.
Sprocket is the app icon and the voice of the remediation.

**Sprocket has no sad state, and this is deliberate.** When the child answers
wrong, Sprocket goes to *thinking*, not to a frown. Wrongness is data in this
app and the mascot has to behave like it. Please don't add a sad or
disappointed expression even if it seems like an obvious gap — it is the one
thing that would undermine the product.

**Patient bots are a puzzle, not a rescue.** They are glitching, not suffering.
Nothing may read as sad, sick, frightened, or dead. A broken robot the child
pities creates exactly the wrong emotional loop. Specifically: no X eyes, no
tears, no droop, no gray "powered down" state. Glitching should look *funny and
intriguing* — the child should want to poke it.

**The tell must be obvious before any math appears.** The child sees the robot
first and has to immediately think "something's wrong with that one." If the
tell needs looking for, it has failed. Bold, high-contrast, readable at 96px.

**A tell must never cover the eye band** (y 68–94). Expression is carried by
eye shape alone, so occluding the eyes removes the only expressive channel the
characters have. Tells belong on the body, the head edge, or the antenna. I
already hit this problem — my first static tell covered the face and the
character went dead. Tells live below or beside the face, never on it.

Warm, rounded, confident. Think a friendly workshop, not a hospital and not a
sci-fi lab. Colors should be saturated and cheerful but must hold contrast
against both a light and a dark UI background.

## Explicitly not needed

Please don't produce these — I'm building them in code and they'd only create
drift:

- Screen designs, layouts, wireframes, or UI chrome
- Backgrounds, scenery, or environment art
- Buttons, panels, progress bars, typography specs
- Animations or motion design (expressions are group swaps)
- Marketing, logo lockups, or app-store art beyond the single icon

Characters and the palette table only. That is the whole ask.

## Acceptance checklist

- [ ] All 14 characters render from one skeleton plus color + eyes + tell
- [ ] Every expression swap is a group swap with no layout shift
- [ ] Every glitch tell is legible at 96px and clear of the eye band
- [ ] No character reads as sad, hurt, or switched off
- [ ] Sprocket is the only teal character and has no tell
- [ ] Zero hard-coded colors; every fill goes through a `--bot-*` token
- [ ] Files drop into `src/ui/assets/` and the contact sheet still renders
