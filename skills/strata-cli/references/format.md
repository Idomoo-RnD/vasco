# Compact scene format — full reference

Compiled by `strata compile <scene.json>` into VASCO, schema-validated, then encoded to `.idm`.

Contents: [Scene](#scene) · [Layers](#layers-common) · [Text](#text) · [Image/Video](#image--video-media) · [Solid](#solid) · [Audio](#audio) · [Comp layers](#sub-compositions) · [Camera](#camera) · [Tweens](#tween-engine-animate) · [Effects](#effects) · [Masks](#masks) · [Track mattes](#track-mattes) · [Generating assets](#generating-assets-idomoo-ai-api) · [Personalization](#personalization--design-for-replaceable-elements) · [Graphs](#graphs--charts--dynamic-images) · [Passthrough](#raw-vasco-passthrough)

## Scene

```json
{
  "width": 1280, "height": 720,      // max 1920 each
  "fps": 25,                          // 1..120, default 25
  "duration": 4,                      // seconds → num_of_frames (or set "num_of_frames")
  "name": "main",
  "layers": [ ... ],                  // bottom-first: first layer is the background
  "comps": { "card": { /* same shape as scene */ } }   // optional sub-compositions
}
```

Passthrough at comp level: `shutter_angle`, `shutter_phase`, `transition`.

## Layers (common)

| key | meaning |
|---|---|
| `type` | `text` `image` `video` `solid` `audio` `comp` `camera` (`media` also accepted, type sniffed from extension) |
| `name` | layer name (needed for matte references) |
| `start` / `duration` | seconds → `first_frame` / `num_of_frames` (frame-exact keys also accepted). Default: starts at 0, runs to comp end |
| `box` | `[x, y, w, h]` → bounds. Default: full comp. (visual layers only) |
| `position` | `[x,y]` or `[x,y,z]` — where the anchor lands (comp coords); defaults to `anchor`, so it's a plain offset when no anchor is set |
| `scale` | number (uniform) or `[sx,sy]` / `[sx,sy,sz]` |
| `rotation` | degrees (Z) or `[xDeg,yDeg,zDeg]` |
| `anchor` | `[x,y]` or `[x,y,z]` — scale/rotation pivot, in comp coords (typically the layer's visual center). Baked into the matrix: `T(position)·R·S·T(−anchor)` |
| `opacity` | 0..1 |
| `blend` | blend mode: `normal add subtract multiply divide screen darken lighten difference exclusion overlay hardmix colordodge colorburn lineardodge linearburn linearlight vividlight pinlight hardlight softlight luminosity hue saturation color` |
| `fit` | `"fit"` / `"fill"` or `{x, y, scale, scale_type}` — content alignment in box (media/solid/comp) |
| `motion_blur` | **defaults to `true`** on every visual layer — set `"motion_blur": false` to opt out. Smooths animated motion; no cost on static layers |
| `animate` | tween channels, see below |
| `effects` | inline effect list, see below |
| `mask` | inline mask, see below |
| `matte` | track matte, see below |

Position/scale/rotation compose to the VASCO 4×4 `transform` as `T(position)·R·S·T(−anchor)`. Scaling/rotation pivot on `anchor`.

> ⚠️ **`anchor` + `position` — the #1 transform bug.** Once you set an `anchor`, `position` is the **absolute comp coordinate where that anchor lands — not an offset.** It defaults to the anchor, so an anchored layer with no `position` rests exactly in place. If you set an anchor and then animate `position` toward `[0,0]` (offset-style), you drag the pivot to the top-left corner and the whole layer flies up there.
>
> To scale/rotate around the center **and** move it (rise, slide, drift), express every position keyframe as **anchor + offset**, with the *resting* keyframe equal to the anchor:
> ```json
> // grow in place at comp center [960,540] while rising 40px into position
> { "type": "text", "text": "Hello", "font": "./f.ttf", "box": [0,440,1920,200],
>   "align": "center middle", "anchor": [960, 540],
>   "animate": {
>     "scale":    [ {"t":0,"v":0.9,"ease":"outExpo"}, {"t":0.6,"v":1} ],
>     "position": [ {"t":0,"v":[960,580],"ease":"outCubic"}, {"t":0.7,"v":[960,540]} ]
>   } }
> ```
> - ❌ `"anchor":[960,540]` + `"position":[[0,40]→[0,0]]` → snaps to top-left.
> - ✅ `"anchor":[960,540]` + `"position":[[960,580]→[960,540]]` → rises into place, centered.
> - **No pivot needed?** Omit `anchor` entirely and `position` becomes a plain offset from the layer's natural spot (e.g. `[0,40]→[0,0]` for a simple fade-rise). Only reach for an anchor when you also scale or rotate.

## Text

```json
{ "type": "text", "text": "Hello", "font": "./arial.ttf", "size": 96,
  "color": "#ffffff", "box": [0,0,1280,200], "align": "center middle",
  "tracking": 0, "leading": 1.2, "breakline": false, "shrink": true, "min_size": 0,
  "rtl": false, "ellipsis": "…" }
```

- `font` (required): path to .ttf/.otf — deduped into the asset table.
- ⚠️ **The font MUST contain a glyph for every character in `text` (and every `styles` span).** The IDM only embeds the glyphs the font actually has — a character the font is missing renders as a blank/tofu box or breaks the render, producing a bad IDM. **Verify glyph coverage before the final compile**, especially for anything beyond plain A–Z/0–9: accented/non-Latin letters (é ñ ü 你好 العربية), currency (€ £ ₪ ₹), punctuation people paste in (curly quotes “ ” ‘ ’, en/em dashes – —, ellipsis …), symbols (™ © ® • → ✓ ★), and emoji. Many basic fonts (Arial, and even the bundled DejaVuSans for non-Latin scripts) lack these. Options, best first: (1) pick/generate a font that covers the script — e.g. a Noto family for the target language; (2) for a styled span, point that span's `font` at a font that has the glyph; (3) substitute an ASCII equivalent the font has (`->` for →, straight `"` for “”, `...` for …). When in doubt, run the glyph check below.
- **Check coverage** with a quick Node snippet against the .ttf/.otf cmap before compiling:
  ```bash
  node -e 'const fs=require("fs");const b=fs.readFileSync(process.argv[1]);const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);const nt=dv.getUint16(4);let off=0;for(let i=0;i<nt;i++){const o=12+i*16;if(b.toString("latin1",o,o+4)==="cmap"){off=dv.getUint32(o+8);break}}const cov=new Set();const ns=dv.getUint16(off+2);for(let i=0;i<ns;i++){const so=off+dv.getUint32(off+4+i*8+4);const fmt=dv.getUint16(so);if(fmt===4){const segX2=dv.getUint16(so+6),sc=segX2/2;const endO=so+14,startO=endO+segX2+2,deltaO=startO+segX2,rangeO=deltaO+segX2;for(let s=0;s<sc;s++){const end=dv.getUint16(endO+s*2),st=dv.getUint16(startO+s*2),d=dv.getUint16(deltaO+s*2),ro=dv.getUint16(rangeO+s*2);for(let c=st;c<=end&&c!==0xffff;c++){let g;if(ro===0)g=(c+d)&0xffff;else{const gi=dv.getUint16(rangeO+s*2+ro+(c-st)*2);g=gi===0?0:(gi+d)&0xffff}if(g)cov.add(c)}}}else if(fmt===12){const ng=dv.getUint32(so+12);for(let gi=0;gi<ng;gi++){const go=so+16+gi*12,sc=dv.getUint32(go),ec=dv.getUint32(go+4);for(let c=sc;c<=ec;c++)cov.add(c)}}}const text=process.argv[2]||"";const miss=[...new Set([...text])].filter(ch=>!cov.has(ch.codePointAt(0))&&ch.codePointAt(0)>32);console.log(miss.length?"MISSING glyphs: "+miss.map(c=>c+" (U+"+c.codePointAt(0).toString(16).toUpperCase()+")").join(", "):"all glyphs present")' ./font.ttf "Your exact text — €, “smart”, →"
  ```
  Empty/`all glyphs present` → safe to compile. Any `MISSING` → fix the font or the text first.
- `align`: words from `left center right` + `top middle baseline bottom`, e.g. `"center middle"`, or `{"h": "center", "v": "top"}`.
- **Rich spans (typography)** — `"styles"` is a list of per-character-range overrides, each `{ "start": <char index>, "length": <chars>, ... }`. **Confirmed to render:** `color` (hex), `size`, `tracking`, `leading`, `shift`, and a per-span `font` (`font` optional — defaults to the layer font). Example:
  ```json
  "text": "Rich VASCO Text",
  "styles": [
    { "start": 0,  "length": 5, "color": "#ff5a5f", "font": "./Bold.ttf" },
    { "start": 5,  "length": 6, "color": "#ffd166", "tracking": 6 },
    { "start": 11, "length": 4, "color": "#4cc9f0" }
  ]
  ```
  - ⚠️ **Spans MUST cover every character contiguously — including the spaces.** The renderer drops any character not covered by a span, so a gap (e.g. a space left out between two spans) **disappears** and words jam together ("Rich VASCO" → "RichVASCO"). Always extend each span to include its trailing space, or chain spans edge-to-edge so `start[n] = start[n-1] + length[n-1]` with no holes.
  - **Bold / italic:** point the span's `font` at a real **bold/italic font file** (e.g. `./Inter-Bold.ttf`). The boolean `bold`/`italic` flags do **not** synthesize a weight/slant in the renderer — they are no-ops without a variant font.
  - **`underline` / `strikethrough` / `highlight` do NOT render** in the current engine — don't rely on them. For an underline, draw a thin `solid` bar under the text; for highlight, place a `solid` (or a rounded image) behind the text layer.
- **Per-character animators** (After-Effects-style): `"animators": [...]` — raw VASCO `IdmTextAnimator` objects, but `color` accepts hex and any object may carry `animate`. Example, words fading in one by one:

```json
"animators": [{
  "opacity": 0, "position": [0, 40, 0],
  "ranges": [{ "based_on": "words", "shape": "ramp_up",
    "animate": { "start": [{"t":0,"v":0},{"t":2,"v":1,"ease":"outQuad"}],
                 "end":   [{"t":0,"v":0.25},{"t":2,"v":1.25}] } }]
}]
```

Animator offsets (`opacity`, `position`, `scale`, `rotation`, `color`, `tracking`, `skew`, …) apply to the characters selected by `ranges`; animate the range `start`/`end`/`offset` to sweep the selection. Range options: `based_on` (`characters` `characters_excluding_spaces` `words` `lines`), `mode`, `shape` (`square ramp_up ramp_down triangle round smooth`), `units`, `randomize_order`.

## Image / Video (media)

```json
{ "type": "image", "src": "./photo.jpg", "box": [0,0,1280,720], "fit": "fill" }
{ "type": "video", "src": "./clip.mp4", "loop": true, "offset_frame": 0 }
```

`loop: true|false` → `playback_mode` loop/cut (or pass `playback_mode`: `cut loop hold`). Extensions sniffed: png/jpg/jpeg/webp/bmp/gif/tif → image; mp4/mov/avi/webm/mkv/m4v → video.

## Solid

```json
{ "type": "solid", "color": "#10204a", "box": [0,500,1280,140], "opacity": 0.6 }
```

## Audio

```json
{ "type": "audio", "src": "./music.mp3", "volume": -6, "ducking": true, "start": 0, "duration": 10 }
```

`volume` in dB; `ducking` → `sidechain_compression` (auto-lower under voice).

## Sub-compositions

Define under scene `comps`, instantiate with a comp layer; reuse freely:

```json
"layers": [ { "type": "comp", "comp": "card", "box": [340,160,600,400],
              "animate": { "rotation": [{"t":0,"v":-8},{"t":3,"v":8,"ease":"inOutSine"}] } } ],
"comps":  { "card": { "width": 600, "height": 400, "duration": 3, "layers": [ ... ] } }
```

If a sub-comp contains a comp layer referencing another sub-comp, declare the referenced one **earlier** in `comps`.

## Camera

```json
{ "type": "camera", "fov": 70, "position": [640,360,-800],
  "animate": { "position": [ {"t":0,"v":[640,360,-800]}, {"t":3,"v":[640,360,-600],"ease":"inOutQuad"} ] } }
```

Only affects layers with `"is_3d": true` (passthrough key). `zoom` is an animatable channel.

## Tween engine (`animate`)

Each channel is a keyframe array; the CLI bakes per-frame values at comp fps over the layer's duration.

```json
"animate": { "<channel>": [ { "t": 0.5, "v": <value>, "ease": "outCubic" }, ... ] }
```

- `t` = seconds (or `f` = frames), **relative to the layer's start**.
- `ease` shapes the segment *leaving* that keyframe; if omitted, the next keyframe's ease applies; else linear. `hold` freezes until the next keyframe.
- Easings: `linear`, `hold`, `in|out|inOut` + `Quad Cubic Quart Quint Sine Expo Circ Back Elastic Bounce` (any of `outCubic` / `ease-out-cubic` / `easeOutCubic` spellings), or cubic-bezier `[x1,y1,x2,y2]`.
- Before the first / after the last keyframe the value clamps.

Channels on layers:

| channel | value | notes |
|---|---|---|
| `position` `scale` `rotation` `anchor` | as the static keys | baked together into one matrix animation; unanimated ones take their static value |
| `opacity` | 0..1 | |
| `color` | hex or `[r,g,b]` | solids / text tint |
| `visible` | bool | holds between keys |
| `zoom` | number | camera |
| *anything else* | raw VASCO value | passed to that channel name verbatim |

`animate` also works inside effects, mask shapes, and text animators/ranges (channels listed in those sections). Vectors, colors, and even mask shapes interpolate; booleans/strings hold.

## Effects

```json
"effects": [
  { "type": "blur", "amount": 8, "dimensions": "both", "repeat_edge": false,
    "animate": { "amount": [ {"t":0,"v":0}, {"t":1,"v":8} ] } },
  { "type": "shadow",  "color": "#000000cc", "opacity": 0.75, "angle": 120, "distance": 40, "spread": 0, "size": 5 },
  { "type": "glow",    "color": "#ffff00", "opacity": 0.75, "spread": 0, "size": 5, "range": 0.5 },
  { "type": "stroke",  "color": "#331a00", "size": 3, "position": "outside" },
  { "type": "overlay", "color": "#ff000080", "blend": "overlay", "opacity": 1 },
  { "type": "corner_pin",
    "from": [[0,0],[1280,0],[0,720],[1280,720]],
    "to":   [[100,50],[1180,90],[80,700],[1200,680]],
    "crop": 0,
    "animate": { "to.upper_left": [ {"t":0,"v":[100,50]}, {"t":2,"v":[0,0]} ] } }
]
```

- `shadow`/`glow`/`stroke`/`overlay` merge into one layer-styles effect per layer. Animatable channels inside them: their own keys (`color`, `opacity`, `distance`, `size`, …) — the CLI prefixes the VASCO path (`drop_shadow.color` etc.).
- Corner-pin pins order: `[upper_left, upper_right, lower_left, lower_right]` (or `{ul, ur, ll, lr}`).
- Raw VASCO effects pass through when given a `name` instead of `type` (e.g. `{"name": "blur", "blurriness": 5, "dimensions": "both", "repeat_edge_pixels": false}`), still with `animate` support.

## Masks

```json
"mask": { "rect": [0, 500, 1280, 140], "feather": 12 }                  // single shape
"mask": { "shapes": [                                                    // multi-shape
  { "ellipse": [640, 360, 200, 120], "feather": [10, 10], "inverted": false,
    "opacity": 1, "expansion": 0, "blend": "add",
    "animate": { "shape": [ {"t":0,"v":{"ellipse":[640,360,60,60]}},
                            {"t":2,"v":{"ellipse":[640,360,200,120]},"ease":"inOutCubic"} ] } },
  { "path": [[100,100],[400,100],[250,350]], "closed": true },
  { "shape": [ {"type":"move_to","values":[0,0]}, {"type":"cubic_to","values":[10,0,20,10,20,20]} ] }
] }
```

Shapes: `rect [x,y,w,h]` · `ellipse [cx,cy,rx,ry]` · `path [[x,y],...]` (`closed` defaults true) · `shape` = raw VASCO commands (`move_to`/`line_to` 2 values, `quadratic_to` 4, `cubic_to` 6). Mask blend modes: `none add subtract intersect lighten darken difference`. Shape keyframes interpolate (morph) when both ends have the same structure.

## Track mattes

The matte source must be a layer (usually `"visible": false`) in the same comp; reference it by name:

```json
{ "type": "text", "name": "matte-text", "text": "MATTE", "visible": false, ... },
{ "type": "image", "src": "./photo.jpg", "matte": { "type": "alpha", "source": "matte-text" } }
```

Types: `alpha alpha_inverted luma luma_inverted`.

## Colors

Hex anywhere a color is expected: `#rgb`, `#rrggbb`, `#rrggbbaa`. Layer/text-style colors are RGB (alpha dropped); effect and animator colors keep alpha. Raw `[r,g,b(,a)]` arrays (0..1 floats) also accepted.

## Generating assets (Idomoo AI API)

The CLI can generate the media an IDM needs, via `strata generate <kind>`. Every command needs Idomoo auth (`strata auth login` or `IDOMOO_ACCOUNT_ID`/`IDOMOO_SECRET_KEY`) and **saves the file to a folder** — `./strata_assets/` by default, `--out-dir <dir>` to change it, or `-o <file>` for an exact path. The saved local path is what you put in the scene's `src`; the command also prints the remote `url`. Add `--json` for `{ ok, type, path, url, ... }`.

Workflow: generate an **image** → optionally **animate** it into a video clip (animate takes the image's *url*, printed by the image command) → generate **narration** and **music** for the audio track. Then reference the saved files from the scene.

| command | params | output |
|---|---|---|
| `strata generate voices [--search <text>] [--json]` | `--search` filters by name/gender/accent/use-case | prints `voice_id  name · gender · accent` rows — pick a `voice_id` for narration |
| `strata generate image "<prompt>"` | `--aspect` one of `16:9 4:3 3:4 1:1 9:16 21:9` (default `1:1`) · `--colors "#hex,#hex"` brand palette · `--reference <url>` reference image | a PNG (async, ~10–20s). Prints local path + remote url. Use `--aspect` matching the comp (e.g. `9:16`) |
| `strata generate video <image-url>` | positional = an image **url** (use the url printed by `generate image`) · `--prompt "<motion>"` describes the camera/movement · `--duration <sec>` (default 5) · `--ratio <e.g. 9:16>` | an MP4 image-to-video clip (async, ~1–3 min). Reference it as a `video` layer (`loop: true` to hold the comp) |
| `strata generate narration "<text>" --voice <voice_id>` | `--voice` required (from `generate voices`) · `--normalize <mode>` | an MP3 (sync) + spoken `duration` in seconds — size the layer/scene around it. Reference as an `audio` layer |
| `strata generate music "<prompt>" [--duration <sec>]` | `--duration` seconds (default 30) | an instrumental track. Reference as an `audio` layer at low `volume` with `ducking: true` so it sits under narration |

Notes: image and video are **asynchronous** (the CLI submits, polls, then downloads — just wait). Narration is synchronous. Generated asset URLs are temporary, so rely on the **downloaded local file**. Match `--aspect`/`--ratio` to the comp dimensions, and for personalized graphs generate the image at its canonical/full state (see *Graphs & charts* below).

## Personalization — design for replaceable elements

Idomoo is a **personalized video platform**: every layer is a placeholder (VASCO `placeholder` defaults to true) whose content can be replaced per-viewer at generate time via the API, keyed by **layer name**. Replacement swaps only the content — text value or media asset — while the layer's box, timing, animations, effects, and masks play back exactly as authored. When the user says the video is personal/personalized, author for content that WILL change:

- **Name layers meaningfully** (`first_name`, `hero_photo`, `monthly_amount`) — names are the replacement keys.
- **Text**: assume values longer and shorter than your sample. Give text boxes generous width, keep `shrink: true` (the default) with a sensible `min_size`, choose alignment deliberately (a left-aligned box grows rightward; centered grows both ways), and never split one personal value across multiple hand-positioned layers.
- **Media**: assume any aspect ratio may arrive. Use `fit: "fill"` for full-bleed slots (crops to cover) or `fit: "fit"` over a designed backdrop (letterboxes). Anchor at the box center so zooms/Ken Burns work on any replacement.
- **Animations are content-agnostic**: per-character text animators adapt to any string automatically — prefer `percentage` range units over `index` when the text varies. A 6-character and a 14-character name both cascade correctly.
- Sample values in the scene should be realistic *long* examples, so the layout is proven against the hard case.

## Graphs & charts — dynamic images

Graphs are **images, not drawn primitives**. The data-dynamism comes from swapping the image asset at generate time while the authored animation stays identical:

- Author the graph image at its **canonical/full state** — a bar chart at 100%, a progress ring fully closed, a line chart with the complete curve.
- **Animate the reveal, not the data**: a mask wipe in the direction the graph grows (left→right rect morph for horizontal bars, bottom→top for columns, an expanding ellipse for rings), or a scale/opacity entrance. When the API replaces the asset with a 50%-filled variant of the same graph, the same wipe plays and the viewer simply sees a 50% graph.
- Never try to encode the data in the animation (e.g. stopping a wipe at 62%) — the image carries the data; the animation only presents it.
- Name the graph layer for replacement (e.g. `savings_graph`) and keep the layer box's aspect ratio equal to the graph image's, so every swapped variant lands pixel-identical.

## Raw VASCO passthrough

Any layer/comp key not consumed by the sugar above is copied verbatim into the compiled VASCO — e.g. `is_3d`, `motion_blur`, `placeholder`, `offset_frame`, `track_matte`, `playback_mode`, `duration_referrer`, `baseline`, `field_of_view`, `shutter_angle`. The compiled doc is validated against the official schema (`C:\idomoo\strata_cli\strata_vasco\vasco.schema.json`), so typos are caught before encoding. Use `validate --print` or `compile --vasco` to see the generated VASCO.
