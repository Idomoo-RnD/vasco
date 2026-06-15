# Motion design — pro-level craft for IDM scenes

How to make IDM videos that look like a studio made them, using this engine's real primitives (keyframe tweens + easings, per-character animators, effects, masks, sub-comps, motion blur). Read this when the user wants something polished, cinematic, "high-end", an ad, a title sequence, or just "make it look great".

Contents: [Mindset](#1-mindset--concept-first) · [Timing & spacing](#2-timing--spacing-the-soul) · [Easing vocabulary](#3-easing-vocabulary-what-each-feels-like) · [Entrances & exits](#4-entrances--exits) · [Text in motion](#5-text-in-motion) · [Transitions between beats](#6-transitions-between-beats) · [Effects with intent](#7-effects-with-intent) · [Depth, camera & atmosphere](#8-depth-camera--atmosphere) · [Rhythm & continuity](#9-rhythm--continuity) · [Polish details](#10-polish-the-1-that-reads-as-pro) · [Anti-patterns](#11-anti-patterns-amateur-tells) · [Recipes](#12-recipes-drop-in-keyframe-patterns)

---

## 1. Mindset — concept first

- **One idea per beat.** A beat is 1.5–4s. Decide its single job (hook, value, proof, CTA) and give it one clear focal point. If two things compete for the eye, stagger them.
- **Motion serves meaning.** Every move should direct attention, show a relationship, or express brand personality — never decorate for its own sake. Energetic brand → snappier eases and overshoots; premium/luxury → slow `inOutSine`/`outExpo`, lots of negative space, restraint.
- **Read time is real.** A line of text needs time on screen ≈ 0.5s + ~0.3s per word after it finishes animating in. Don't animate out before it can be read.
- **Design the whole arc.** Intro (set tone) → body beats (escalate) → climax (biggest move/stat) → resolve (logo/CTA). Vary energy: a quiet beat makes the next loud one hit harder.

## 2. Timing & spacing (the soul)

Timing is *when*; spacing is *how the value is distributed across the move* (that's your easing). Amateur work gets timing uniform and spacing linear — pros vary both.

Move-duration budget (at 25fps):
- **Snappy / UI / kinetic**: 0.25–0.45s — buttons, counters, quick cuts, kinetic type.
- **Standard reveal**: 0.5–0.8s — titles, cards, images entering.
- **Cinematic / hero**: 0.9–1.4s — big logo, slow push-ins, premium reveals.
- **Ambient / idle**: 4–30s — background drift, breathing glow, Ken Burns.

Core timing techniques:
- **Overlap / follow-through**: don't wait for one move to finish before the next starts. Opacity finishes at 0.4s while position keeps easing to 0.8s — the layer is readable early but still settling.
- **Stagger (offset)**: identical elements enter ~0.08–0.15s apart, not together. Cards, list items, words. This single trick separates pro from flat.
- **Anticipation**: a tiny opposite move before the main one (scale dips to 0.95 then springs to 1; a card pulls back 20px before flying in). Sells weight.
- **Overshoot & settle**: ease past the target then return (`outBack`, or a scale 0→1.08→1). Almost everything that "pops" overshoots a little.
- **Hold**: freeze at the resting pose so it can be read before exiting. Use `"ease": "hold"` to make a keyframe a hard step.

## 3. Easing vocabulary (what each feels like)

Never use `linear` except for constant motion (conveyors, continuous rotation, scrolling). Pick ease by the *feeling*:

| feel | ease | use for |
|---|---|---|
| confident, decisive | `outExpo`, `outQuint` | hero entrances, titles snapping into place |
| smooth, natural | `outCubic`, `inOutCubic` | the default for most UI/text moves |
| soft, premium, ambient | `inOutSine` | slow drifts, breathing, luxury pace |
| playful overshoot | `outBack` | pop-ins, buttons, badges, friendly brands |
| springy (sparingly!) | `outElastic` | one hero moment, a logo, a price reveal — not everywhere |
| heavy impact | `outBounce` | a thing "landing"; use once |
| accelerate away (exits) | `inQuad`, `inCubic`, `inExpo` | elements leaving, fly-throughs accelerating off-screen |
| hard step | `hold` | typewriter/per-character keystrokes, frame-accurate cuts |
| custom | `[x1,y1,x2,y2]` | dial a specific curve (e.g. `[0.2,0.9,0.1,1]` for a sharp ease-out) |

Rule: **entrances ease-OUT** (fast→slow, arriving gently), **exits ease-IN** (slow→fast, accelerating away). Pairing the wrong direction is the most common amateur tell.

## 4. Entrances & exits

Every element that enters must also exit (fade, or move off, or get covered) — orphaned elements that just vanish on a cut read as broken. Compose 2–3 channels per entrance for richness:

- **Fade + rise** (the workhorse): `opacity 0→1` (outQuad, 0.4s) + `position [0,40]→[0,0]` (outCubic, 0.6s).
- **Scale-in**: from `0.9` (subtle) or `0` (pop, with `outBack`) → `1`. Anchor at the element's center so it grows in place.
- **Slide + overshoot**: `position [−500,y]→[x,y]` with `outExpo`, optionally past-and-back.
- **Mask reveal**: wipe the element in with an animated `rect`/`ellipse` mask (see Recipes) — feels designed, not just faded.
- **Blur-in (focus pull)**: a `blur` effect animating `amount 14→0` as it fades in; defocus out on exit.

Exits mirror entrances but faster (~0.7×) and with ease-IN, often with a slight scale-up (1→1.1) + fade so it "leaves toward camera".

> ⚠️ **Combining anchor + position (the #1 transform bug).** Scale-in and slide-in pull in opposite directions here: a scale/rotate wants an `anchor` at the element's center, but the workhorse rise uses `position [0,40]→[0,0]` (an *offset*). **You cannot use both forms together.** Once an `anchor` is set, `position` is the **absolute comp point where the anchor lands**, so a `[0,0]` keyframe snaps the layer to the top-left corner. When a hero element both scales *and* moves, anchor it at its center and write every position keyframe as **anchor + offset**, resting *at* the anchor:
> ```json
> "anchor": [960, 540],
> "animate": {
>   "scale":    [ {"t":0,"v":0.9,"ease":"outExpo"}, {"t":0.6,"v":1} ],
>   "position": [ {"t":0,"v":[960,580],"ease":"outCubic"}, {"t":0.7,"v":[960,540]} ]
> }
> ```
> If the element only fades/rises and never scales or rotates, **drop the anchor** and keep `position [0,40]→[0,0]` as a clean offset. Anchor only when you pivot.

## 5. Text in motion

Text is where motion design lives or dies. Beyond fade+rise:

- **Per-character / per-word cascade** (text animators): each glyph/word fades and rises in sequence by animating the range `start`. Use `units: "percentage"` so it adapts to any string length. This is the single highest-impact text technique.
- **Tracking-in**: letters start spread apart (`tracking` offset ~26–60) and converge — the classic title-sequence move. Pair with a fade.
- **Typewriter**: per-character range with `hold`-stepped `start` keyframes (one step per character) for a keystroke feel.
- **Scale-on per word**: each word also scales 1.4→1 as it enters (animator `scale` offset).
- **Kinetic / fly-through**: big word scales from tiny to huge with `inExpo` while rotating slightly on Y for a 3D whip; chain words with white flash frames between.
- Keep body text on screen long enough to read; let headlines breathe with a hold before the next beat.

## 6. Transitions between beats

Don't hard-cut everything. A transition sells continuity and energy:

- **Cross-dissolve**: overlap two beats, outgoing `opacity→0` as incoming `0→1`.
- **Push / slide**: incoming layer slides in as the outgoing slides out the opposite way (sub-comps make this clean).
- **Mask wipe**: reveal the next beat behind a moving mask edge.
- **Flash cut**: a full-frame white `solid` that spikes `opacity 0→0.6→0` over ~0.15s exactly on the cut — hides the seam, adds punch. Great for montages.
- **Scale-through**: outgoing element scales up past the frame and fades while incoming scales from large→1.
- **Light sweep / speed lines**: thin additive-blend bars streaking across during the transition (motion-blurred) for kinetic energy.
- **Match cut**: a shape/position in beat A lines up with one in beat B so the eye carries through.

## 7. Effects with intent

Effects are seasoning. Each should have a reason; stacking three on every layer reads as amateur.

- **Glow** (`glow`): light, energy, emphasis, neon. A subtle brand-color glow (size 14–22, opacity 0.5–0.9) makes type and logos feel lit. Animate `size`/`opacity` to pulse.
- **Drop shadow** (`shadow`): depth and legibility. Essential for text over busy images — or use a **scrim** (a semi-black `solid`/gradient behind text) instead for cleaner contrast.
- **Blur** (`blur`): focus pulls (animate `amount`), depth (background bokeh blurred heavily), motion suggestion. Defocus-in / defocus-out on entrances.
- **Stroke / overlay**: outline and color-wash for graphic style; overlay with a blend mode for tinting.
- **Corner-pin**: fake perspective and 3D — unfold a panel from an edge, lay a screenshot onto an angled surface, animate the pins for a "turn".
- Layer styles (shadow/glow/stroke/overlay) stack into one effect — combine deliberately (e.g. glow + subtle shadow on a hero word).

## 8. Depth, camera & atmosphere

Flat = amateur. Build z-depth even in 2D:

- **Parallax**: background layers move/scale *less* than foreground; a slow background drift (`inOutSine`, 30s) under faster foreground content. Different rates = depth.
- **Ken Burns**: slow continuous `scale 1→1.1` (or 1.1→1) + slight position drift on every full-frame image/video so nothing is dead-still.
- **Atmosphere layers** (additive blend, `#hex` blue/brand, low opacity): a big feathered-ellipse **glow orb** that breathes, drifting diagonal **light beams**, floating **particles** (tiny soft dots rising with individual twinkle curves), heavy-blurred **bokeh**. These sell production value cheaply.
- **Vignette**: an inverted feathered ellipse mask of semi-black over everything — focuses the eye, adds cinema.
- **Camera + 3D**: for true depth, set layers `is_3d: true` and animate a `camera` (position/zoom) — push-ins, dollies. (Camera has no default motion blur.)
- **Letterbox bars**: black bars sliding in top/bottom for instant cinematic framing.

## 9. Rhythm & continuity

- **Cut to the audio.** Place beat changes and big hits on the music's downbeats and the narration's phrase boundaries. Stagger reveals to the rhythm. A stat slam landing on a beat hits 10× harder.
- **Consistent motion language.** Pick an easing family and stagger interval and reuse them — all cards slide with the same `outExpo` + 0.1s stagger. Consistency reads as intentional design.
- **Accent system.** One or two brand colors used consistently for emphasis (underlines, glows, the active number, the CTA) ties the piece together.
- **Never fully static.** Even "still" beats should have idle motion — a slow scale, a breathing glow, drifting particles. Dead-frozen frames feel broken.

## 10. Polish — the 1% that reads as pro

- **Motion blur** is on by default for visual layers — keep it; raise the comp `shutter_angle` to 1–1.3 for heavier streaks on fast moves.
- **Micro-overshoot** on settles (1→1.04→1 over a few frames) on otherwise plain moves.
- **Secondary motion**: a shadow that lags its element, an underline that wipes in just after its title.
- **Light sweep** across logos/glyphs (a feathered white bar swept through via an alpha track-matte of the logo).
- **Scrim behind text** over imagery — always; legibility first.
- **Chromatic offset** (subtle): duplicate a hero word in brand-blue and coral offset ±4px under the white master for an energetic edge. Use once.
- **Settle then exit**: hold the resting pose ~0.5s before exiting, so it's read.

## 11. Anti-patterns (amateur tells)

- `linear` easing on reveals; everything the same duration; no stagger.
- Entrances easing-in or exits easing-out (backwards feel).
- Animating `position` toward `[0,0]` on a layer that has an `anchor` set — with an anchor, `position` is the **absolute** point where the pivot lands, so `[0,0]` drags the layer to the top-left corner. Bake the anchor coords into every position keyframe (anchor + offset), or drop the anchor if you aren't scaling/rotating.
- Elements that pop in and never leave, or vanish instantly on a cut.
- Three+ effects on every layer; glow on everything; harsh full-opacity drop shadows.
- Text that animates out before it can be read; body text flying in per-letter (too slow to read — cascade words instead).
- Dead-static frames; a single focal point fighting three others; centered everything with no hierarchy.
- Overshoot/elastic/bounce on *everything* — they're spice, not the meal.

## 12. Recipes (drop-in keyframe patterns)

> For a much larger, categorised set (42 effects: text, transitions, motion, masks, special FX, extras), see **[recipes.md](recipes.md)**. The patterns below are the essential core.

Hero title — fade + rise + settle (anchored at comp center `[960,540]`; position keyframes are **anchor + offset**, resting *at* the anchor — see the anchor+position warning in §4):
```json
"anchor": [960, 540],
"animate": {
  "opacity":  [ {"t":0,"v":0,"ease":"outQuad"}, {"t":0.5,"v":1} ],
  "position": [ {"t":0,"v":[960,600],"ease":"outExpo"}, {"t":0.7,"v":[960,540]} ],
  "scale":    [ {"t":0.7,"v":1}, {"t":0.8,"v":1.03,"ease":"inOutSine"}, {"t":0.95,"v":1} ]
}
```
(Only fading + rising, no scale/rotation? Drop the `anchor` and use a plain offset `"position":[[0,60]→[0,0]]` instead.)

Word cascade (length-independent) — on a text layer:
```json
"animators": [{ "opacity":0, "position":[0,44,0],
  "ranges":[{ "based_on":"words", "units":"percentage", "shape":"smooth",
    "animate": { "start": [ {"t":0,"v":0,"ease":"outCubic"}, {"t":1,"v":1} ] } }] }]
```

Stat slam with impact + camera shake (numbers/prices):
```json
"animate": {
  "scale":    [ {"t":0,"v":3,"ease":"inExpo"}, {"t":0.22,"v":1}, {"t":1.5,"v":1,"ease":"inQuad"}, {"t":1.8,"v":0.94} ],
  "position": [ {"t":0.22,"v":[960,510],"ease":"hold"}, {"t":0.28,"v":[952,518],"ease":"hold"},
                {"t":0.34,"v":[967,504],"ease":"hold"}, {"t":0.4,"v":[960,510]} ],
  "opacity":  [ {"t":0,"v":0,"ease":"hold"}, {"t":0.04,"v":1}, {"t":1.5,"v":1,"ease":"inQuad"}, {"t":1.8,"v":0} ]
}
```
(anchor the layer at its center; fire a white flash `solid` at `t≈0` of the slam.)

Card slide-in with overshoot (stagger siblings 0.1s apart). Anchor at the card's center `[540,540]`; positions are **absolute landing points** (anchor x ± offset), resting *at* the anchor `[540,540]`:
```json
"anchor": [540, 540],
"animate": { "position": [ {"t":0,"v":[-500,540],"ease":"outExpo"}, {"t":0.8,"v":[540,540]},
  {"t":6.7,"v":[540,540],"ease":"inQuad"}, {"t":7.2,"v":[-600,540]} ] }
```

Mask wipe reveal (bottom→top) — on the layer's mask:
```json
"mask": { "rect": [0,960,1080,0],
  "animate": { "shape": [ {"t":0,"v":{"rect":[0,960,1080,0]},"ease":"outExpo"},
                          {"t":0.6,"v":{"rect":[0,0,1080,1920]}} ] } }
```

Logo light sweep (alpha track-matte) — a feathered white bar swept across an invisible logo duplicate used as the matte source; see the track-matte + mask sections in format.md.

Focus pull (blur in, hold sharp, blur out) — a `blur` effect:
```json
{ "type":"blur", "amount":12,
  "animate": { "amount": [ {"t":0,"v":14,"ease":"outQuad"}, {"t":0.45,"v":0},
                           {"t":1.8,"v":0,"ease":"inQuad"}, {"t":2.3,"v":22} ] } }
```

Flash-cut transition (full-frame white `solid`, `opacity` only):
```json
"animate": { "opacity": [ {"t":2.26,"v":0,"ease":"hold"}, {"t":2.3,"v":0.6,"ease":"outQuad"}, {"t":2.45,"v":0} ] }
```

Ken Burns + breathing glow orb (ambient, never static):
```json
// full-frame image: "animate": { "scale": [ {"t":0,"v":1,"ease":"inOutSine"}, {"t":8,"v":1.1} ] }
// orb (solid, blend "add", feathered-ellipse mask): "animate": { "scale": [ {"t":0,"v":1,"ease":"inOutSine"}, {"t":15,"v":1.3}, {"t":30,"v":1} ] }
```

Compose these, time them to the audio, keep the motion language consistent, and exit everything you enter.
