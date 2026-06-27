# Recipe library — drop-in keyframe patterns

43 ready-to-use motion-design recipes in the **compact scene format**. Each snippet is one (or a few) layers — paste into a scene's `layers`, swap the font/box/colours, and tune the timing. Times are **seconds**; coordinates assume a 1280×720 comp (scale to your size). The craft theory behind these (shots, easing, 3D/camera, rhythm) lives in the main SKILL.md.

**Conventions used below**
- `"./font.ttf"` — any real `.ttf`/`.otf`. `"./image.jpg"` — your media.
- A few FX want tiny helper PNGs you can generate once: **`noise.png`** (grayscale value-noise, for luma dissolves), **`flare.png`** / **`leak.png`** (bright shapes on black, used with `"blend":"add"`). All optional.
- **Anchor rule** (the #1 gotcha): when a recipe sets `anchor`, every `position` keyframe is the absolute point where that anchor lands — the *resting* keyframe equals the anchor. See the anchor+position warning in [format.md](format.md).

Contents: [Text](#1-text) · [Transitions](#2-transitions) · [Motion](#3-motion) · [Masks](#4-masks) · [Special FX](#5-special-fx) · [Extras](#6-extras) · [Data viz](#7-data-viz)

---

## 1. Text

### Tracking-in (letters spread → converge)
```json
{ "type": "text", "text": "DESIGN", "font": "./font.ttf", "size": 130,
  "box": [0,250,1280,180], "align": "center middle", "anchor": [640,340],
  "effects": [{ "type": "glow", "color": "#a855f7", "size": 18, "opacity": 0.9 }],
  "animators": [{ "tracking": 50, "tracking_type": "before_and_after",
    "ranges": [{ "shape": "square", "animate": { "amount": [{"t":0,"v":1,"ease":"outExpo"},{"t":1.0,"v":0}] } }] }],
  "animate": { "opacity": [{"t":0,"v":0},{"t":0.4,"v":1,"ease":"outCubic"}] } }
```

### Rich multi-style headline (per-span colour + word entrance)
Per-span `color`/`size`/`tracking` plus a word-by-word rise-and-fade. **Spans must cover every character including spaces** (extend each span over its trailing space) or the gaps vanish. For bold/italic use a real variant font in the span's `font`; `underline`/`strikethrough`/`highlight` don't render — fake them with a `solid`.
```json
{ "type": "text", "name": "headline", "text": "Rich VASCO Text",
  "font": "./font.ttf", "size": 120, "color": "#ffffff",
  "box": [120,120,1040,150], "align": "left middle", "tracking": 1,
  "styles": [
    { "start": 0,  "length": 5, "color": "#ff5a5f", "font": "./font-bold.ttf" },
    { "start": 5,  "length": 6, "color": "#ffd166", "tracking": 6 },
    { "start": 11, "length": 4, "color": "#4cc9f0" }
  ],
  "animators": [{ "opacity": 0, "position": [0,60,0],
    "ranges": [{ "based_on": "words", "shape": "ramp_up",
      "animate": { "start": [{"t":0,"v":0},{"t":1.6,"v":1,"ease":"outCubic"}],
                   "end":   [{"t":0,"v":0.34},{"t":1.6,"v":1.34}] } }] }] }
```
*(Fake underline: a thin `solid` bar under the box. Fake highlight: a `solid` behind the text layer.)*

### Typewriter with a caret that follows the text
Per-character hard-edged reveal (`shape:"square"`, `start` stepped one notch per char), plus a caret solid whose `x` is stepped to the **cumulative glyph advances** (`x += size × advance/1000`; Arial 'm'≈833, 'i'≈222, space≈278). Use a monospace font for exact tracking.
```json
{ "type": "text", "name": "tw", "text": "idomoo makes video.", "font": "./font.ttf", "size": 72,
  "box": [360,314,920,76], "align": "left middle",
  "animators": [{ "opacity": 0, "ranges": [{ "based_on": "characters", "shape": "square",
    "animate": { "start": [{"t":0,"v":0,"ease":"hold"},{"t":2.4,"v":1,"ease":"hold"}], "end": [{"t":0,"v":1}] } }] }] }
```
```json
{ "type": "solid", "name": "caret", "color": "#e8ecf8", "box": [0,314,6,76],
  "animate": { "position": [{"t":0,"v":[360,0],"ease":"hold"},{"t":2.4,"v":[1040,0],"ease":"hold"}],
               "opacity":  [{"t":0,"v":1,"ease":"hold"},{"t":0.4,"v":0},{"t":0.8,"v":1},{"t":1.2,"v":0},{"t":1.6,"v":1}] } }
```
*(Step `start` and the caret `position` at the same per-char times — one keyframe per character — for the locked caret.)*

### Line-by-line stagger
```json
{ "type": "text", "text": "CREATE\nPERSONALIZE\nDELIVER", "font": "./font.ttf", "size": 92,
  "box": [0,160,1280,400], "align": "center middle", "leading": 1.15,
  "animators": [{ "opacity": 0, "position": [0,46,0],
    "ranges": [{ "based_on": "lines", "shape": "smooth",
      "animate": { "start": [{"t":0,"v":0,"ease":"outCubic"},{"t":1.6,"v":1}] } }] }] }
```

### Per-word bounce-in
Keep `end` pinned at 1 so words are hidden at t=0; `outBack` on `start` gives the bounce.
```json
{ "type": "text", "text": "one video each", "font": "./font.ttf", "size": 96,
  "box": [0,290,1280,150], "align": "center middle",
  "animators": [{ "opacity": 0, "position": [0,70,0],
    "ranges": [{ "based_on": "words", "shape": "smooth",
      "animate": { "start": [{"t":0,"v":0,"ease":"outBack"},{"t":1.7,"v":1}], "end": [{"t":0,"v":1}] } }] }] }
```

### Wavy / travelling lift
```json
{ "type": "text", "text": "WAVE MOTION", "font": "./font.ttf", "size": 110, "color": "#b794ff",
  "box": [0,290,1280,160], "align": "center middle",
  "animators": [{ "position": [0,-34,0],
    "ranges": [{ "based_on": "characters", "shape": "round", "units": "percentage",
      "animate": { "start": [{"t":0,"v":0,"ease":"inOutSine"},{"t":2,"v":1},{"t":4,"v":0}],
                   "end":   [{"t":0,"v":0.2,"ease":"inOutSine"},{"t":2,"v":1.2},{"t":4,"v":0.2}] } }] }] }
```

### RGB-split glitch
Three additive copies in pure R/G/B, jittered on hold steps.
```json
{ "type": "text", "text": "GLITCH", "font": "./font.ttf", "size": 150, "color": "#ff0040",
  "box": [0,250,1280,200], "blend": "add", "anchor": [640,350],
  "animate": { "position": [{"t":0,"v":[646,350],"ease":"hold"},{"t":0.2,"v":[634,350]},{"t":0.5,"v":[648,350]},{"t":0.9,"v":[638,350]}] } }
```
*(Duplicate in `#00ff90` and `#4080ff` with different jitter; one copy can stay still.)*

### Per-letter 3D flip-in
```json
{ "type": "text", "text": "ROTATE", "font": "./font.ttf", "size": 140, "box": [0,250,1280,190],
  "align": "center middle", "anchor": [640,345], "motion_blur": true,
  "animators": [{ "opacity": 0, "rotation": [0,90,0],
    "ranges": [{ "based_on": "characters", "shape": "smooth",
      "animate": { "start": [{"t":0,"v":0,"ease":"outCubic"},{"t":1.6,"v":1}] } }] }] }
```

### Colour sweep across letters
```json
{ "type": "text", "text": "SPECTRUM", "font": "./font.ttf", "size": 120, "color": "#3a4668",
  "box": [0,280,1280,170], "align": "center middle",
  "animators": [{ "color": "#22d3ee",
    "ranges": [{ "based_on": "characters", "shape": "round", "units": "percentage",
      "animate": { "start": [{"t":0,"v":-0.2,"ease":"linear"},{"t":3.6,"v":0.9}],
                   "end":   [{"t":0,"v":0,"ease":"linear"},{"t":3.6,"v":1.1}] } }] }] }
```

### Marker highlight sweep
```json
{ "type": "solid", "name": "mark", "color": "#fde047", "box": [430,320,420,92], "anchor": [430,366], "opacity": 0.9,
  "animate": { "scale": [{"t":0.3,"v":[0,1],"ease":"outExpo"},{"t":1.0,"v":[1,1]}] } }
```
*(Place the dark text layer on top.)*

### Title + underline wipe
```json
{ "type": "solid", "name": "ul", "color": "#a855f7", "box": [410,408,460,6], "anchor": [410,411],
  "animate": { "opacity": [{"t":0.5,"v":0},{"t":0.6,"v":1}],
               "scale":   [{"t":0.6,"v":[0,1],"ease":"outExpo"},{"t":1.3,"v":[1,1]}] } }
```

---

## 2. Transitions

### Scale-through (A blasts past, B scales in)
```json
{ "type": "solid", "name": "A", "color": "#0e7490", "box": [0,0,1280,720], "anchor": [640,360],
  "animate": { "scale": [{"t":0,"v":1},{"t":1.6,"v":1,"ease":"inExpo"},{"t":2.2,"v":6}], "opacity": [{"t":1.6,"v":1},{"t":2.2,"v":0}] } }
```
```json
{ "type": "solid", "name": "B", "color": "#a21caf", "box": [0,0,1280,720], "start": 1.7, "anchor": [640,360],
  "animate": { "scale": [{"t":0,"v":0.2,"ease":"outExpo"},{"t":0.6,"v":1}], "opacity": [{"t":0,"v":0},{"t":0.3,"v":1}] } }
```

### Whip-pan (motion-blur swish)
Set the comp `"shutter_angle": 2` for heavy blur.
```json
{ "type": "solid", "name": "A", "color": "#1d4ed8", "box": [0,0,1280,720], "motion_blur": true,
  "animate": { "position": [{"t":0,"v":[0,0],"ease":"hold"},{"t":1.7,"v":[0,0],"ease":"inCubic"},{"t":2.1,"v":[-1500,0]}] } }
```
```json
{ "type": "solid", "name": "B", "color": "#be123c", "box": [0,0,1280,720], "motion_blur": true,
  "animate": { "position": [{"t":0,"v":[1600,0],"ease":"hold"},{"t":1.7,"v":[1600,0],"ease":"outCubic"},{"t":2.1,"v":[0,0]}] } }
```

### Light-leak bloom over the cut
```json
{ "type": "image", "src": "./leak.png", "box": [0,0,1280,720], "fit": "fill", "blend": "add", "start": 1.4, "anchor": [640,360],
  "animate": { "opacity": [{"t":0,"v":0},{"t":0.5,"v":1},{"t":1.1,"v":0}], "scale": [{"t":0,"v":1.1,"ease":"inOutSine"},{"t":1.1,"v":1.5}] } }
```

### Clock wipe (radial wedge)
A wedge polygon mask whose sweep grows 0°→360° (compute the rim points; both keyframes need the same point count).
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "path": [[640,360],[640,-400]], "closed": true,
    "animate": { "shape": [{"t":0.4,"v":{"path":[[640,360],[640,-400]]},"ease":"inOutSine"},
                           {"t":2.6,"v":{"path":[[640,360],[640,-400],[1400,360],[640,1120],[-120,360],[640,-400]]}}] } }] } }
```

### Iris (circle) reveal
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "ellipse": [640,360,30,30], "feather": [40,40],
    "animate": { "shape": [{"t":0.4,"v":{"ellipse":[640,360,30,30]},"ease":"inOutCubic"},{"t":2.2,"v":{"ellipse":[640,360,820,820]}}] } }] } }
```

### 3D flip transition
```json
{ "type": "solid", "name": "A", "color": "#b45309", "box": [240,130,800,460], "anchor": [640,360], "motion_blur": true,
  "animate": { "rotation": [{"t":0,"v":[0,0,0],"ease":"hold"},{"t":1.6,"v":[0,0,0],"ease":"inSine"},{"t":2.2,"v":[0,-90,0]}], "opacity": [{"t":2.1,"v":1},{"t":2.2,"v":0}] } }
```
```json
{ "type": "solid", "name": "B", "color": "#6d28d9", "box": [240,130,800,460], "anchor": [640,360], "start": 2.1, "motion_blur": true,
  "animate": { "rotation": [{"t":0,"v":[0,90,0],"ease":"outSine"},{"t":0.6,"v":[0,0,0]}] } }
```

### Speed-line streak
```json
{ "type": "image", "src": "./rays.png", "box": [0,0,1280,720], "fit": "fill", "blend": "add", "start": 1.5, "anchor": [640,360], "motion_blur": true,
  "animate": { "opacity": [{"t":0,"v":0},{"t":0.3,"v":0.9},{"t":1.0,"v":0}], "scale": [{"t":0,"v":0.6,"ease":"outExpo"},{"t":1.0,"v":3}] } }
```

### Luma dissolve (textured)
`noise.png` is grayscale; the outgoing layer is matted by it and fades — bright areas linger.
```json
{ "type": "image", "name": "mt", "src": "./noise.png", "box": [0,0,1280,720], "fit": "fill", "visible": false }
```
```json
{ "type": "solid", "name": "A", "color": "#111827", "box": [0,0,1280,720], "matte": { "type": "luma", "source": "mt" },
  "animate": { "opacity": [{"t":0.4,"v":1,"ease":"inOutSine"},{"t":2.6,"v":0}] } }
```

---

## 3. Motion

### Anticipation + overshoot
```json
{ "type": "solid", "color": "#a855f7", "box": [490,210,300,300], "anchor": [640,360],
  "effects": [{ "type": "shadow", "color": "#00000099", "distance": 16, "size": 8 }],
  "animate": { "scale": [{"t":0,"v":0,"ease":"outBack"},{"t":0.5,"v":1},{"t":1.0,"v":1,"ease":"inOutSine"},{"t":1.2,"v":0.88},{"t":1.55,"v":1.12,"ease":"outBack"},{"t":1.9,"v":1}],
               "rotation": [{"t":1.0,"v":0},{"t":1.2,"v":-6},{"t":1.9,"v":0,"ease":"outBack"}] } }
```

### Float / bob idle loop
```json
{ "type": "text", "text": "idomoo", "font": "./font.ttf", "size": 130, "box": [0,270,1280,180],
  "align": "center middle", "anchor": [640,360],
  "animate": { "position": [{"t":0,"v":[640,348],"ease":"inOutSine"},{"t":1,"v":[640,372]},{"t":2,"v":[640,348]},{"t":3,"v":[640,372]},{"t":4,"v":[640,348]}],
               "rotation": [{"t":0,"v":[0,0,-2],"ease":"inOutSine"},{"t":2,"v":[0,0,2]},{"t":4,"v":[0,0,-2]}] } }
```

### 3D camera push-in
`is_3d` layers need an `anchor` at their box centre so they stay centred; the camera dollies in z.
```json
{ "type": "camera", "fov": 60, "position": [640,360,-650],
  "animate": { "position": [{"t":0,"v":[640,360,-650],"ease":"inOutSine"},{"t":4,"v":[640,360,-300]}] } }
```
```json
{ "type": "text", "text": "idomoo", "font": "./font.ttf", "size": 120, "box": [0,250,1280,220],
  "align": "center middle", "is_3d": true, "anchor": [640,360], "position": [640,360,0] }
```

### Fly-through warp (scale-from-depth)
```json
{ "type": "text", "text": "FUTURE", "font": "./font.ttf", "size": 150, "box": [0,250,1280,220],
  "align": "center middle", "anchor": [640,360], "motion_blur": true,
  "effects": [{ "type": "glow", "color": "#a855f7", "size": 20, "opacity": 0.9 },
    { "type": "blur", "amount": 0, "animate": { "amount": [{"t":0,"v":28,"ease":"outQuad"},{"t":0.5,"v":0},{"t":2.6,"v":0,"ease":"inQuad"},{"t":3.2,"v":36}] } }],
  "animate": { "scale": [{"t":0,"v":0.05,"ease":"outExpo"},{"t":0.6,"v":1},{"t":2.6,"v":1,"ease":"inExpo"},{"t":3.2,"v":6}],
               "opacity": [{"t":0,"v":0},{"t":0.25,"v":1},{"t":2.7,"v":1},{"t":3.2,"v":0}],
               "rotation": [{"t":0,"v":[0,-40,0],"ease":"outCubic"},{"t":0.6,"v":[0,0,0]}] } }
```

### Bounce drop + squash
Anchor at the ball's **bottom** so the squash flattens onto the floor exactly at contact.
```json
{ "type": "solid", "color": "#22d3ee", "box": [580,0,120,120], "anchor": [640,120],
  "mask": { "ellipse": [640,60,60,60] },
  "animate": { "position": [{"t":0,"v":[640,120],"ease":"inQuad"},{"t":0.6,"v":[640,556]},{"t":1.0,"v":[640,320],"ease":"outQuad"},{"t":1.45,"v":[640,556],"ease":"inQuad"},{"t":1.7,"v":[640,470],"ease":"outQuad"},{"t":1.95,"v":[640,556],"ease":"inQuad"}],
               "scale": [{"t":0.55,"v":[1,1]},{"t":0.62,"v":[1.3,0.65]},{"t":0.72,"v":[0.85,1.18],"ease":"outBack"},{"t":0.9,"v":[1,1]}] } }
```

---

## 4. Masks

### Feathered iris reveal
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "ellipse": [640,360,40,40], "feather": [120,120],
    "animate": { "shape": [{"t":0.3,"v":{"ellipse":[640,360,40,40]},"ease":"outCubic"},{"t":2.2,"v":{"ellipse":[640,360,760,520]}}] } }] } }
```

### Shape morph (blob ↔ star)
Both keyframes must have the **same point count** to interpolate.
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "path": [[640,60],[852,248],[640,360],[852,472],[640,660],[428,472],[640,360],[428,248]], "closed": true,
    "animate": { "shape": [{"t":0,"v":{"path":[[640,60],[852,248],[640,360],[852,472],[640,660],[428,472],[640,360],[428,248]]},"ease":"inOutSine"},
                           {"t":1.3,"v":{"path":[[640,20],[746,254],[746,360],[746,466],[640,510],[534,466],[534,360],[534,254]]}}] } }] } }
```

### Moving spotlight
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "ellipse": [360,300,170,170], "feather": [90,90],
    "animate": { "shape": [{"t":0,"v":{"ellipse":[360,300,170,170]},"ease":"inOutSine"},{"t":2,"v":{"ellipse":[920,430,170,170]}},{"t":4,"v":{"ellipse":[360,300,170,170]}}] } }] } }
```

### Photo through text (alpha matte)
```json
{ "type": "text", "name": "mt", "text": "IDOMOO", "font": "./font.ttf", "size": 230, "color": "#ffffff",
  "box": [0,250,1280,240], "align": "center middle", "visible": false }
```
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill", "matte": { "type": "alpha", "source": "mt" } }
```

### Knockout text (hole in a panel)
```json
{ "type": "text", "name": "mt", "text": "OPEN", "font": "./font.ttf", "size": 260, "color": "#ffffff",
  "box": [0,240,1280,260], "align": "center middle", "visible": false }
```
```json
{ "type": "solid", "color": "#0b0e1a", "box": [0,0,1280,720], "opacity": 0.92, "matte": { "type": "alpha_inverted", "source": "mt" } }
```

### Barn-door reveal
```json
{ "type": "solid", "name": "L", "color": "#0b0e1a", "box": [0,0,640,720],
  "animate": { "position": [{"t":0.3,"v":[0,0],"ease":"inOutCubic"},{"t":1.6,"v":[-660,0]}] } }
```
```json
{ "type": "solid", "name": "R", "color": "#0b0e1a", "box": [640,0,640,720],
  "animate": { "position": [{"t":0.3,"v":[0,0],"ease":"inOutCubic"},{"t":1.6,"v":[660,0]}] } }
```

### Soft gradient wipe
A wide-feather rect mask sweeping across.
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "mask": { "shapes": [{ "rect": [-300,0,300,720], "feather": [220,0],
    "animate": { "shape": [{"t":0.3,"v":{"rect":[-300,0,300,720]},"ease":"inOutSine"},{"t":2.4,"v":{"rect":[1280,0,300,720]}}] } }] } }
```

---

## 5. Special FX

### Neon glow pulse + flicker
```json
{ "type": "text", "text": "NEON", "font": "./font.ttf", "size": 160, "color": "#f0abfc", "box": [0,250,1280,220], "align": "center middle",
  "effects": [{ "type": "glow", "color": "#d946ef", "size": 20, "opacity": 0.9,
    "animate": { "size": [{"t":0,"v":10,"ease":"inOutSine"},{"t":1,"v":34},{"t":2,"v":10},{"t":3,"v":34},{"t":4,"v":10}],
                 "opacity": [{"t":0,"v":0.6,"ease":"inOutSine"},{"t":1,"v":1},{"t":2,"v":0.6}] } }],
  "animate": { "opacity": [{"t":0,"v":1,"ease":"hold"},{"t":1.5,"v":1},{"t":1.55,"v":0.4},{"t":1.62,"v":1}] } }
```

### Depth-of-field focus pull
Background pre-blurred; the subject pulls into focus.
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill", "effects": [{ "type": "blur", "amount": 22 }] }
```
```json
{ "type": "text", "text": "in focus", "font": "./font.ttf", "size": 110, "box": [0,300,1280,150], "align": "center middle",
  "effects": [{ "type": "blur", "amount": 0, "animate": { "amount": [{"t":0,"v":18,"ease":"outQuad"},{"t":0.9,"v":0}] } }],
  "animate": { "opacity": [{"t":0,"v":0},{"t":0.5,"v":1}] } }
```

### Chromatic aberration (RGB split breathing)
Three additive copies (`#ff003c` / `#00ff8c` / `#3b7bff`), the outer two drifting ±x.
```json
{ "type": "text", "text": "CHROMA", "font": "./font.ttf", "size": 140, "color": "#ff003c", "box": [0,250,1280,200],
  "align": "center middle", "blend": "add", "anchor": [640,350],
  "animate": { "position": [{"t":0,"v":[640,350],"ease":"inOutSine"},{"t":1,"v":[628,350]},{"t":2,"v":[640,350]}] } }
```

### Ambient light leaks
```json
{ "type": "image", "src": "./leak.png", "box": [0,0,1280,720], "fit": "fill", "blend": "add", "anchor": [640,360],
  "animate": { "opacity": [{"t":0,"v":0.4,"ease":"inOutSine"},{"t":2,"v":0.9},{"t":4,"v":0.4}],
               "position": [{"t":0,"v":[600,360],"ease":"inOutSine"},{"t":4,"v":[720,360]}],
               "scale": [{"t":0,"v":1,"ease":"inOutSine"},{"t":4,"v":1.2}] } }
```

### Lens flare sweep
```json
{ "type": "image", "src": "./flare.png", "box": [0,0,1280,720], "fit": "fill", "blend": "add", "anchor": [640,360],
  "animate": { "position": [{"t":0,"v":[180,360],"ease":"inOutSine"},{"t":4,"v":[1100,360]}],
               "opacity": [{"t":0,"v":0},{"t":1,"v":1},{"t":3,"v":1},{"t":4,"v":0}] } }
```

### Corner-pin perspective turn
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "effects": [{ "type": "corner_pin",
    "from": [[0,0],[1280,0],[0,720],[1280,720]],
    "to":   [[120,90],[1160,60],[180,660],[1100,690]],
    "animate": { "to.upper_left": [{"t":0,"v":[120,90],"ease":"inOutSine"},{"t":4,"v":[320,150]}],
                 "to.lower_left": [{"t":0,"v":[180,660],"ease":"inOutSine"},{"t":4,"v":[360,600]}] } }] }
```

### Mirror reflection
A flipped (`scale:[1,-1]`), faded, blurred copy with a feathered mask fading it out.
```json
{ "type": "text", "text": "REFLECT", "font": "./font.ttf", "size": 120, "color": "#22d3ee", "box": [0,230,1280,150],
  "align": "center middle", "anchor": [640,380], "scale": [1,-1], "opacity": 0.28,
  "effects": [{ "type": "blur", "amount": 3 }],
  "mask": { "rect": [0,384,1280,150], "feather": [0,110] } }
```

### Frosted-glass panel
A blurred copy of the bg, masked to the panel, under a translucent white solid.
```json
{ "type": "image", "src": "./image.jpg", "box": [0,0,1280,720], "fit": "fill",
  "effects": [{ "type": "blur", "amount": 18 }], "mask": { "rect": [290,230,700,260], "feather": [2,2] } }
```
```json
{ "type": "solid", "color": "#ffffff", "box": [290,230,700,260], "opacity": 0.18 }
```

### Colour grade (teal–orange duotone)
```json
{ "type": "solid", "color": "#0a2a3a", "box": [0,0,1280,720], "blend": "screen",
  "animate": { "opacity": [{"t":0.5,"v":0,"ease":"inOutSine"},{"t":2,"v":0.5}] } }
```
```json
{ "type": "solid", "color": "#ff8a3d", "box": [0,0,1280,720], "blend": "overlay",
  "animate": { "opacity": [{"t":0.5,"v":0,"ease":"inOutSine"},{"t":2,"v":0.35}] } }
```

### Long flat shadow
Stack offset duplicates of the word in a dark colour behind the master (here generated in a loop — 20–30 copies stepping `+5,+5`).
```json
{ "type": "text", "text": "SHADOW", "font": "./font.ttf", "size": 150, "color": "#0a0f20", "box": [5,255,1280,200], "align": "center middle", "opacity": 0.9 }
```
*(Repeat with box offset `[i*5, 250+i*5, …]` for i = N…1, then the bright master at `[0,250,…]`.)*

---

## 6. Extras

### Rich text — many styles in one block
Style ranges (`start`/`length`) carry `bold`/`italic`/`underline`/`color`/`size`/`highlight`/per-span `font`.
```json
{ "type": "text", "text": "Bold, italic, colour & SIZE — one block, many styles.",
  "font": "./font.ttf", "size": 58, "color": "#cfd6e6", "box": [120,250,1040,280], "align": "center middle", "leading": 1.3, "shrink": true,
  "styles": [
    { "start": 0,  "length": 4, "bold": true, "color": "#ffffff" },
    { "start": 6,  "length": 6, "italic": true, "color": "#c4b5fd" },
    { "start": 14, "length": 6, "color": "#22d3ee", "underline": true },
    { "start": 23, "length": 4, "size": 92, "bold": true, "color": "#fde047" },
    { "start": 30, "length": 10, "highlight": "#a855f733" }
  ],
  "animate": { "opacity": [{"t":0,"v":0},{"t":0.6,"v":1,"ease":"outCubic"}] } }
```

### Easing comparison — one ease per row
Build one row per ease so you can feel the difference side-by-side.
```json
{ "type": "solid", "color": "#a855f7", "box": [360,126,30,30], "mask": { "ellipse": [375,141,15,15] },
  "animate": { "position": [{"t":0.6,"v":[0,0],"ease":"outBounce"},{"t":2.6,"v":[820,0]}] } }
```
*(Duplicate per ease — `linear`, `inOutSine`, `outCubic`, `outQuint`, `outExpo`, `outBack`, `outElastic`, `outBounce` — stacking the rows down the frame with a label each.)*

## 7. Data viz

Rule: **author at the full/canonical state and animate the reveal** — a mask wipe in the growth direction. The number/shape carries the data; the animation only presents it (so it works when the API swaps in a different value).

### Count-up number
Bake an animated text value by stepping `text` per frame is not supported directly — instead reveal a final number with a fast scale/track-in and a mask wipe, or animate a bar/ring alongside it. For a true rolling count, render the number as an image sequence upstream; for most videos the entrance below reads as "counting".
```json
{ "type": "text", "name": "kpi_value", "text": "98%", "font": "./font-bold.ttf", "size": 120, "color": "#fff",
  "box": [40,110,340,130], "align": "left middle", "anchor": [210,175],
  "animate": { "scale": [{"t":0,"v":0.6,"ease":"outBack"},{"t":0.5,"v":1}], "opacity": [{"t":0,"v":0},{"t":0.25,"v":1}] } }
```

### Bar chart (mask wipe L→R)
The bar solid is full width; a rect mask animates its width from 0 to full so it "grows".
```json
{ "type": "solid", "name": "bar_a", "color": "#4cc9f0", "box": [120,300,700,48],
  "mask": { "rect": [120,300,0,48], "animate": { "shape": [ {"t":0,"v":{"rect":[120,300,0,48]}}, {"t":1,"v":{"rect":[120,300,560,48]},"ease":"outCubic"} ] } } }
```
*(560/700 = 80%. Stagger several bars with offset `start`; label each with a text layer.)*

### Progress ring (expanding wedge)
A coloured disc revealed by a growing ellipse mask reads as a ring filling.
```json
{ "type": "solid", "name": "ring_fill", "color": "#ffd166", "box": [540,200,200,200],
  "mask": { "shapes": [ {"ellipse":[640,300,100,100]}, {"ellipse":[640,300,70,70],"blend":"subtract"} ] },
  "animate": { "rotation": [{"t":0,"v":-90,"ease":"outCubic"},{"t":1.2,"v":270}] } }
```
*(Pair with a centred `kpi_value` text; rotate a masked wedge for an exact percentage, or scale a wipe.)*

### Stat bar / percentage fill
A track solid + a fill solid whose width is masked open.
```json
{ "type": "solid", "name": "track", "color": "#1c2030", "box": [120,420,700,18] },
{ "type": "solid", "name": "fill",  "color": "#34a853", "box": [120,420,700,18],
  "mask": { "rect": [120,420,0,18], "animate": { "shape": [ {"t":0,"v":{"rect":[120,420,0,18]}}, {"t":0.9,"v":{"rect":[120,420,476,18]},"ease":"outQuint"} ] } } }
```

### Line-chart draw (path mask sweep)
Draw a line by sweeping a rectangular mask across a pre-drawn line image/solid path.
```json
{ "type": "image", "name": "line_plot", "src": "./line.png", "box": [120,140,1040,440], "fit": "fit",
  "mask": { "rect": [120,140,0,440], "animate": { "shape": [ {"t":0,"v":{"rect":[120,140,0,440]}}, {"t":1.6,"v":{"rect":[120,140,1040,440]},"ease":"inOutSine"} ] } } }
```

### Parallax depth (3D)
Give layers different z and drift the camera for instant depth.
```json
{ "type": "camera", "name": "cam", "animate": { "position": [ {"t":0,"v":[640,360,-1200],"ease":"inOutSine"}, {"t":4,"v":[700,360,-1000]} ] } },
{ "type": "image", "name": "bg_far",  "src": "./bg.jpg",  "box": [-200,-120,1680,960], "is_3d": true, "position": [0,0,-400] },
{ "type": "image", "name": "mid_card", "src": "./card.png","box": [340,180,600,360], "is_3d": true, "position": [0,0,-120] },
{ "type": "text",  "name": "fg_title", "text": "Depth", "font": "./font-bold.ttf", "size": 120, "color": "#fff", "box": [0,300,1280,160], "align": "center middle", "is_3d": true, "position": [0,0,0] }
```
*(Near layers (z≈0) drift more than far ones (z negative) as the camera moves — true cinematic parallax. **`position` x,y are still a delta from the box — put depth in z and keep x,y `0`; the box positions the layer.** Oversize a far bg (negative z shrinks it by perspective, so a 1280-wide bg at z−400 won't fill the frame). See SKILL.md "3D & camera".)*

---

Compose these, time them to the audio, keep one easing family per piece, and exit everything you enter.
