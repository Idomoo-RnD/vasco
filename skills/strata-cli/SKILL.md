---
name: strata-cli
description: Author Idomoo IDM videos with the `strata` CLI — write a compact scene JSON, compile it to a binary `.idm` locally, generate assets (image, image-to-video, narration, music) via the Idomoo AI API, and render to MP4. Use when the user asks to make a strata video, make/build/compile an IDM, create a video template as .idm, build a motion-graphics / kinetic-text / title-sequence / explainer / personalized or data-driven video, work with VASCO locally, render an IDM to MP4, generate video assets, or animate layers (text, image, video, solid, audio, camera) with tweens/keyframes. Not for the Idomoo cloud briefs/blueprints API.
---

# Strata CLI — author, generate assets, compile & render IDM videos

I drive the `strata` CLI end to end: I turn a short "scene" JSON into a full VASCO project, generate any missing media (image / image-to-video / narration / music), compile it to a binary `.idm` entirely locally, and render it to an MP4 on Idomoo.

## Animation & design principles I follow

Good output is a story told with motion, not a slideshow. I settle the story before I touch the scene JSON, then I author to these (the full concept layer is in [references/video-design.md](references/video-design.md); execution craft in [references/motion-design.md](references/motion-design.md); layout in [references/design-best-practices.md](references/design-best-practices.md)):

- **Story first.** I work out the arc, the key tension, and the single message each beat must land — and I run the concept past the user *before* I build. A beat is ~1.5–4s with one job (hook → value → proof → CTA).
- **Disney fundamentals.** Anticipation, ease in/out, follow-through & overlap, squash & stretch, exaggeration. I never move anything linearly unless I mean to.
- **Establishing shot, then push in.** I open wide to set the scene, then hard-cut or zoom to the action. I show rather than tell — titles/captions only when they earn their place.
- **Keep it in a real context.** Elements live in a setting — a background, a device/UI frame, a product shot — not floating in the void.
- **Decide the shot.** A slow push-in, rapid cuts between two elements in tension, a move that follows a cursor or a graph line — I pick a deliberate camera/edit for every beat.
- **Always keep something in motion.** Except for a deliberate held beat, something is panning, zooming, drifting, or building. A truly static frame reads as a bug, so I give images a slow Ken-Burns (scale + position) and build graphics over them. (Motion graphics, not PowerPoint.)
- **Let it breathe.** I hold text and images for read time (≈0.5s + ~0.3s per word) before moving on, and I never animate something out before it can be read.
- **Camera & cursor moves.** I use a `camera` layer (or Ken-Burns scale+position on a layer) for pushes/pans; for a product walkthrough I animate a cursor image layer along keyframed positions with eased, damped motion (Screen-Studio style). I compute target pixel positions from the layout — there are no live refs in the IDM engine.

## Setup — I check BEFORE installing anything

The `strata` CLI is a **standalone self-contained binary** that embeds its own JavaScript runtime — I **never install Node.js, npm, or any other runtime for it**.

1. **I check first**: I run `strata version`. If it prints a version, the CLI is ready and I skip all setup. I also try `~/.local/bin/strata version` (Linux/macOS) and `%LOCALAPPDATA%\Programs\strata\strata.exe version` (Windows) in case it is installed but not on PATH.
2. **Only if it's missing** do I install the binary:
   - Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash` (in sandboxes/agents I set `STRATA_SKILL=skip` to suppress the interactive skill prompt)
   - Windows: `irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex`
   - Or I download the platform binary directly from https://github.com/Idomoo-RnD/vasco/releases/latest (`strata_linux_amd64`, `strata_linux_arm64`, `strata_darwin_arm64`, `strata_darwin_amd64`, `strata_windows_amd64.exe`), `chmod +x` it, and run it by path.
3. **I confirm it works** (offline, no assets/credentials — exit 0 means the toolchain is good):

   ```bash
   strata version
   echo '{"width":1280,"height":720,"fps":25,"duration":1,"layers":[{"type":"solid","color":"#102040"}]}' > /tmp/t.json
   strata validate /tmp/t.json
   ```

## 🎨 I generate assets — I don't make the user supply everything

The `strata` CLI creates the media an IDM needs via the Idomoo AI API (needs auth; saves files to a folder, default `./strata_assets/`). I don't assume the user must hand me every image/clip/voiceover:

| command | makes |
|---|---|
| `strata generate image "<prompt>" [--aspect 9:16] [--colors "#a,#b"] [--reference <url>]` | a still PNG (async) |
| `strata generate video <image-url> [--prompt "<motion>"] [--duration 5] [--ratio 9:16]` | an **image-to-video** MP4 clip from a still (async) |
| `strata generate narration "<text>" --voice <voice_id>` | a TTS voiceover MP3 (`strata generate voices` lists voice IDs) |
| `strata generate music "<prompt>" [--duration 30]` | an instrumental soundtrack |

Typical chain: **image → animate it into video → add narration + music**, then I point the scene's `src` at the saved local files. Full params/output are in the *Generating assets* section of [references/format.md](references/format.md).

## I read the references first — they're what make the output good

The four `references/` files are short, and reading them before I author is the difference between a polished video and a broken or generic one. Each prevents a specific, common failure, so I skim all four up front and keep the relevant one open while I work:

| reference | what it gives me | what skipping it tends to cause |
|---|---|---|
| [references/video-design.md](references/video-design.md) | the concept layer — story, shots, pacing, animation craft | a tool-driven slideshow with no arc, message, or shot logic |
| [references/design-best-practices.md](references/design-best-practices.md) | layout, visual hierarchy, colour, typography, personalization rules | cluttered, off-brand frames that bury the message |
| [references/format.md](references/format.md) | every layer key plus the gotchas | invalid schema, collapsed rich-text spans, layers jumping to the corner (anchor/position), tofu glyphs |
| [references/motion-design.md](references/motion-design.md) | timing, easing vocabulary, entrances/exits, rhythm | flat, "default-template" motion |
| [references/recipes.md](references/recipes.md) | 43 paste-ready, engine-correct patterns | re-deriving (and mis-deriving) patterns that already exist |

To keep myself honest: when I present the scene or plan, I note which design principle and which format rule shaped my main choices.

## Workflow

1. **I sort out assets before authoring** — building a scene around media I haven't resolved leads to rework. For each visual element I ask the user two things: (a) do they have a file or should I generate it with `strata generate`, and (b) should it be a **still image or a moving video clip** — motion reads as motion-graphics rather than slides, so I favour video (or at least an animated still) for hero moments. I also ask whether to add **narration** (and music). I collect file paths for what they have and plan `generate` calls for the rest. I skip the questions only when the user already specified everything or told me to generate/use placeholders. Text layers need a real `.ttf`/`.otf` — a generated/placeholder font is a last resort.
2. **I lock the story and design.** I work out what the video must say (size, duration, beats, motion) and apply the principles above plus the references (hierarchy/stamp test, F-pattern, contrast, ≤2 typefaces, colour, dark scrims over dynamic images, timing the personalized reveal). I run the concept past the user before building anything heavy.
3. **I write the scene JSON** (compact format below), using paths relative to the scene file (or absolute paths) for all assets. I make reusable sub-comps for repeated elements and tweak the timeline iteratively.
4. **I compile**: `strata compile scene.json -o out.idm` — it validates the compiled VASCO against the schema before writing and prints a summary. I report the output path.
5. **I render an MP4**: `strata render scene.json --library "<saved-lib-id>" -o out.mp4`.
   - **Credentials**: I ask the user for their **account ID** and **secret key** if `strata auth status` fails, then set them via `strata auth login --account <id> --token <secret>` or env `IDOMOO_ACCOUNT_ID`/`IDOMOO_SECRET_KEY`.
   - **Library — I pick ONE and reuse it (I do not create a new library per IDM).** Every render in a project/session uploads to the **same** library; a fresh library per upload scatters renders and is bad practice.
     - **First render only:** I ask the user **once** which library to use (showing existing ones with `strata library list`), then create/resolve it with `strata library create "<name>"`. That prints the library **id** and is idempotent (it reuses the id if one with that name/id already exists). I **save that id** for the session and persist it for the project (a small `.idm-library` file next to the scenes).
     - **Every later render:** I pass that same `--library <saved-id>` (the **id**, not a name) without asking again. `render` logs `Reusing library <id>`; if it ever logs `Created NEW library <id>` I passed the wrong value. I only switch libraries when the user explicitly says so.
     - Without `--library`, a non-interactive render fails with the library list in the error.
   - A render takes minutes (upload → export → render, polled), so I run it in the background and report the printed video/poster URLs.
6. **I verify the result.** After render I look at the poster (or extract a frame) — compile success doesn't prove the frame is right. I run the craft check from [references/video-design.md](references/video-design.md): is the message unmistakable, does every shot earn its place, is there both stillness and energy, does the pacing let beats land, would the first three seconds keep someone watching? I debug with `--vasco` (dumps compiled VASCO JSON) or `strata inspect out.idm` (decodes a binary back).

Commands (a bare `.json` arg implies `compile`, a bare `.idm` implies `inspect`):
`compile <scene.json> [-o out.idm] [--vasco]` · `validate <scene.json> [--print]` · `inspect <file.idm> [--assets <dir>]` · `generate image|video|narration|music|voices ...` · `render <scene.json|.idm> --library <id> [-o out.mp4] [--height] [--quality]` · `library list|create <name>` · `init [scene.json]` · `auth login|status` · `schema` · `update` · `uninstall`. I add `--json` for machine-readable output. Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout.

**Agent conventions:** `--json` puts a machine-readable result object on stdout; errors are JSON on stderr. The CLI is non-interactive by default — with credentials in env and `--library` passed, nothing reads a TTY. Renders take minutes, so I run them in the background (the result JSON has `video_url` and `poster_url`).

## Scene format essentials

Times are **seconds** (I use `f` instead of `t` in keyframes for exact frames). Colors are hex strings. Coordinates are pixels, origin top-left. Layers render **bottom-first** (first layer = background). Asset paths resolve relative to the scene file.

```json
{
  "width": 1280, "height": 720, "fps": 25, "duration": 4,
  "layers": [
    { "type": "image", "name": "bg", "src": "./bg.jpg",
      "anchor": [640, 360],
      "animate": { "scale": [ {"t": 0, "v": 1}, {"t": 4, "v": 1.15, "ease": "inOutSine"} ] } },
    { "type": "text", "name": "title", "text": "Hello!",
      "font": "./font.ttf", "size": 110, "color": "#ffe14d",
      "box": [100, 120, 1080, 220], "align": "center middle",
      "effects": [ { "type": "shadow", "color": "#000000cc", "distance": 12 } ],
      "animate": {
        "opacity":  [ {"t": 0, "v": 0}, {"t": 0.8, "v": 1, "ease": "outCubic"} ],
        "position": [ {"t": 0, "v": [0, 80], "ease": "outBack"}, {"t": 1, "v": [0, 0]} ]
      } }
  ]
}
```

The block above is a teaser, not the spec — I author from [references/format.md](references/format.md), which has the full keys and the failure-causing gotchas (anchor↔position, glyph coverage, rich-text spans must cover spaces).

Layer types: `text`, `image`, `video`, `solid`, `audio`, `comp` (sub-composition), `camera`.

**Tween engine:** any `animate` channel is a keyframe list `{"t": sec, "v": value, "ease": name}`; the CLI bakes them to per-frame VASCO arrays. `position`/`scale`/`rotation` (degrees)/`anchor` compose into the transform matrix; `opacity`, `color`, `visible`, and any raw VASCO channel bake directly. Easings: `linear`, `hold`, `in/out/inOut` × `Quad Cubic Quart Quint Sine Expo Circ Back Elastic Bounce`, or cubic-bezier `[x1,y1,x2,y2]`.

The reference set, and when I open each:
- **[references/video-design.md](references/video-design.md)** — first, before anything: the concept layer — story arc, message, shot composition, pacing, animation craft, and a final craft check. Tool-independent thinking that decides *what* the video is.
- **[references/design-best-practices.md](references/design-best-practices.md)** — before any layout: space & "less is more", hierarchy (stamp test), F-pattern & rule of thirds, contrast/proximity/alignment/consistency, colour, ≤2 typefaces + fallback fonts, plus PV/personalization rules (dark scrim over dynamic images, bounding box + shrink/break-line, time the personalized reveal, hold the ending) and a pre-ship checklist.
- **[references/format.md](references/format.md)** — the authoritative spec for every scene: each layer's keys, effects (blur, shadow/glow/stroke/overlay, corner-pin), masks (rect/ellipse/path + morphing), track mattes, sub-comps, rich-text styles, per-character text animators, and the raw-VASCO passthrough rules.
- **[references/motion-design.md](references/motion-design.md)** — for any video with motion (all of them): timing & spacing, the easing vocabulary, entrances/exits, kinetic text, beat transitions, effects with intent, depth/camera/atmosphere, rhythm to audio, polish, anti-patterns.
- **[references/recipes.md](references/recipes.md)** — 43 paste-ready patterns (text · transitions · motion · masks · special FX · extras): tracking-in, rich multi-style headline, typewriter caret, per-word bounce, glitch, 3D flips, whip-pan, light-leak, iris/clock wipes, camera dolly, fly-through, mattes, glow/DOF/RGB-split/corner-pin/reflection/colour-grade, and more.

## Rules of thumb

- Text layers **require** `font` (path to a .ttf/.otf). Media/audio layers require `src`. Assets must exist at compile time. A bundled free font ships at `examples/assets/DejaVuSans.ttf` (`strata schema` prints the full VASCO schema for exotic properties).
- **`anchor` + `position` — the #1 transform bug. I read this before animating position on an anchored layer.** `anchor` is the pivot for scale/rotation (comp coords); `position` is the absolute comp point where that pivot **lands** — *not* an offset once an anchor is set. `position` **defaults to the anchor**, so I set *only* `anchor` (the layer's center) and the layer scales/rotates in place. The trap: setting an anchor and then animating `position` to `[0,0]` (offset-style) snaps the pivot to the top-left and yanks the layer up there. To scale/rotate in place **and** move, I write every position keyframe as **anchor + offset**, with the *resting* keyframe equal to the anchor:
  - ❌ `"anchor":[960,540]` with `"position":[[0,40]→[0,0]]` → flies to the top-left.
  - ✅ `"anchor":[960,540]` with `"position":[[960,580]→[960,540]]` → rises 40px into place, centered.
  - For a plain pixel nudge with no pivot I **omit `anchor`** and `position` is a simple offset from the layer's natural spot. (The anchor is baked as `T(position)·R·S·T(−anchor)` — the engine does not apply `anchor_point` itself.)
- The `ease` on a keyframe shapes the segment leaving it; if absent, the next keyframe's ease is used (CSS- or AE-style placement both work).
- Keyframe times are relative to the layer's `start`, not the comp.
- Sub-comps that reference other sub-comps must be declared after the comps they reference inside `comps` (the main scene may reference any of them).
- **Unknown keys are NOT ignored — they break the compile.** Any key that isn't documented sugar is passed straight into VASCO, and the schema is strict (`additionalProperties: false`). So an invented or mistyped key — `z`, `zIndex`, `x`, `y`, `width`/`height` on a layer, `comment`, `id`, `label`, `radius`, `src` on a non-media layer — fails the compile with "unknown key …". I use only documented sugar or a property genuinely part of raw VASCO for that object; the passthrough is an escape hatch for *real* VASCO properties, not a free-form bag.
- **I verify before I render.** `strata validate scene.json` (free, offline, no auth) schema-checks the compiled VASCO and names any offending key/layer. I fix until it's clean, then compile/render — I never burn a render on a structural error.
- **Styled spans + non-ASCII can fail the cloud render.** If a `styles` span boundary falls on a multi-byte character (`×`, `€`, accents, CJK, emoji), the exporter can error (3000) even though validate/compile pass. `validate`/`compile` print a ⚠ when they detect it; I use one span over the whole string, an ASCII substitute, or keep multi-byte chars out of split spans.
- Comp max dimension is 1920 on each axis.
- **Motion blur is ON by default** for every visual layer (`motion_blur: true`). I keep it on for anything that moves and pass `"motion_blur": false` only deliberately. For visible blur on fast moves I raise the comp's `shutter_angle` (default 0.5; 1–1.3 reads cinematic).
- **Fonts must cover the text's glyphs.** A missing glyph renders as a tofu box or breaks the render. Before the final compile I verify the font has every character — especially non-ASCII letters, currency (€ £ ₪), curly quotes/dashes (“ ” – —), symbols (™ © • → ✓), emoji. See the glyph-coverage check in [references/format.md](references/format.md); I fix by choosing a covering font (e.g. Noto), per-span fonts in `styles`, or ASCII substitutes.
- **Personalized videos**: every layer is an API-replaceable placeholder keyed by its name. If the video is personal/personalized, I read the *Personalization* and *Graphs & charts* sections in [references/format.md](references/format.md) — I size text boxes and media slots for varying content and treat graphs as swappable images whose animation reveals whatever data the image carries.
