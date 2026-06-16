---
name: strata-cli
description: Author Idomoo IDM videos with the `strata` CLI — write a compact scene JSON, compile it to a binary `.idm` locally, generate assets (image, image-to-video, narration, music) via the Idomoo AI API, and render to MP4. Use when the user asks to make/build/compile an IDM, create a video template as .idm, work with VASCO locally, render an IDM to MP4, generate video assets, or animate layers (text, image, video, solid, audio, camera) with tweens/keyframes. Not for the Idomoo cloud briefs/blueprints API.
---

# Strata CLI — author, generate assets, compile & render IDM videos

Drive the `strata` CLI end to end: turn a short "scene" JSON into a full VASCO project, generate any missing media (image / image-to-video / narration / music), compile it to a binary `.idm` entirely locally, and optionally render it to an MP4 on Idomoo.

## Setup — check BEFORE installing anything

The `strata` CLI is a **standalone self-contained binary**. It embeds its own JavaScript runtime — **never install Node.js, npm, or any other runtime for it**.

1. **Check it first**: run `strata version`. If it prints a version, the CLI is ready — skip all setup. Also try `~/.local/bin/strata version` (Linux/macOS) and `%LOCALAPPDATA%\Programs\strata\strata.exe version` (Windows) in case it is installed but not on PATH.
2. **Only if missing**, install the binary:
   - Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash` (in sandboxes/agents set `STRATA_SKILL=skip` to suppress the interactive skill prompt)
   - Windows: `irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex`
   - Or download the platform binary directly from https://github.com/Idomoo-RnD/vasco/releases/latest (`strata_linux_amd64`, `strata_linux_arm64`, `strata_darwin_arm64`, `strata_darwin_amd64`, `strata_windows_amd64.exe`), `chmod +x` it, and run it by path — no further setup.
3. **Test it works** (offline, no assets/credentials needed — exit 0 means the toolchain is good):

   ```bash
   strata version
   echo '{"width":1280,"height":720,"fps":25,"duration":1,"layers":[{"type":"solid","color":"#102040"}]}' > /tmp/t.json
   strata validate /tmp/t.json
   ```

## 🎨 The CLI generates assets — don't make the user supply everything

The `strata` CLI can **create the media an IDM needs** via the Idomoo AI API (needs auth; saves files to a folder, default `./strata_assets/`). Do not assume the user must hand you every image/clip/voiceover:

| command | makes |
|---|---|
| `strata generate image "<prompt>" [--aspect 9:16] [--colors "#a,#b"] [--reference <url>]` | a still PNG (async) |
| `strata generate video <image-url> [--prompt "<motion>"] [--duration 5] [--ratio 9:16]` | an **image-to-video** MP4 clip from a still (async) |
| `strata generate narration "<text>" --voice <voice_id>` | a TTS voiceover MP3 (`strata generate voices` lists voice IDs) |
| `strata generate music "<prompt>" [--duration 30]` | an instrumental soundtrack |

Typical chain: **image → animate it into video → add narration + music**, then point the scene's `src` at the saved local files. Full params/output in the *Generating assets* section of [references/format.md](references/format.md).

## Workflow

1. **ASK ABOUT ASSETS FIRST — this is a required gate, do not skip it.** Before writing any scene, ask the user, for each kind of media the video needs (images, video clips, audio/music): *do they already have a file, or should I generate it with `strata generate`?* Collect file paths for anything they have; plan a `generate` call for anything they don't. Only skip the question when the user already specified every asset or explicitly told you to generate/use placeholders. Text layers REQUIRE a real `.ttf`/`.otf` — a generated/placeholder font is a last resort.
2. Understand what video the user wants (size, duration, layers, motion). **Before designing anything, read [references/design-best-practices.md](references/design-best-practices.md)** — Idomoo's design principles (space, hierarchy/stamp test, F-pattern, rule of thirds, contrast, ≤2 typefaces, colour, and personalization rules like dark scrims over dynamic images and timing the personalized reveal). Let these drive layout, hierarchy, and type choices.
3. Write a scene JSON (compact format below). Use paths relative to the scene file (or absolute paths) for all assets.
4. Compile: `strata compile scene.json -o out.idm` — it validates the compiled VASCO against the official schema before writing and prints a summary. Report the output path.
5. To render an MP4: `strata render scene.json --library "<saved-lib-id>" -o out.mp4`.
   - **Credentials**: ask the user for their **account ID** and **secret key** if `strata auth status` fails. Set them via `strata auth login --account <id> --token <secret>`, or env `IDOMOO_ACCOUNT_ID`/`IDOMOO_SECRET_KEY`.
   - **Library — pick ONE and reuse it (do NOT create a new library per IDM).** Every render in a project/session must upload to the **same** library. Creating a fresh library for each upload scatters renders across many libraries and is bad practice.
     - **First render only — create the library explicitly, up front.** Ask the user **once** which library to use (show existing ones with `strata library list`), then create/resolve it with **`strata library create "<name>"`**. This prints the library **id** and is idempotent — it reuses the id if a library with that name/id already exists, so it never duplicates. **Save that id** for the whole session and persist it for the project (note it in your memory, or write a small `.idm-library` file next to the scenes). Do **not** rely on `render` to mint the library.
     - **Every later render**: pass that **same** `--library <saved-id>` (the **id**, not a name) **without asking again**. `render` matches the id exactly and logs `Reusing library <id>`; if it ever logs `Created NEW library <id>` you passed the wrong value. Only switch libraries when the **user explicitly says so**.
     - Without `--library`, a non-interactive render fails with the library list in the error.
   - A render takes minutes (upload → export → render, polled); run it in the background and report the printed video/poster URLs.
6. To debug, use `--vasco` (dumps compiled VASCO JSON) or `strata inspect out.idm` (decode a binary back).

Commands (a bare `.json` arg implies `compile`, a bare `.idm` implies `inspect`):
`compile <scene.json> [-o out.idm] [--vasco]` · `validate <scene.json> [--print]` · `inspect <file.idm> [--assets <dir>]` · `generate image|video|narration|music|voices ...` · `render <scene.json|.idm> --library <id> [-o out.mp4] [--height] [--quality]` · `library list|create <name>` · `init [scene.json]` · `auth login|status` · `schema` · `update`. Add `--json` for machine-readable output. Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout.

**Agent conventions:** `--json` puts a machine-readable result object on stdout; errors are JSON on stderr. Non-interactive by default — with credentials in env and `--library` passed, nothing reads a TTY. Renders take minutes; run them in the background (the result JSON has `video_url` and `poster_url`).

## Scene format essentials

Times are **seconds** (use `f` instead of `t` in keyframes for exact frames). Colors are hex strings. Coordinates are pixels, origin top-left. Layers render **bottom-first** (first layer = background). Asset paths resolve relative to the scene file.

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

Layer types: `text`, `image`, `video`, `solid`, `audio`, `comp` (sub-composition), `camera`.

**Tween engine:** any `animate` channel is a keyframe list `{"t": sec, "v": value, "ease": name}`; the CLI bakes them to per-frame VASCO arrays. `position`/`scale`/`rotation` (degrees)/`anchor` compose into the transform matrix; `opacity`, `color`, `visible`, and any raw VASCO channel bake directly. Easings: `linear`, `hold`, `in/out/inOut` × `Quad Cubic Quart Quint Sine Expo Circ Back Elastic Bounce`, or cubic-bezier `[x1,y1,x2,y2]`.

**Design best practices** — read [references/design-best-practices.md](references/design-best-practices.md) **before creating any animation**. Idomoo's design principles for clear, attention-holding, on-brand personalized video: space & "less is more", visual hierarchy (stamp test), F-pattern & rule of thirds, contrast/proximity/alignment/consistency, colour, disciplined typography (≤2 typefaces, fallback fonts), plus PV/personalization rules (dark scrim over dynamic images, define bounding box + shrink/break-line, time the personalized reveal, hold the ending) and a pre-ship checklist.

**Full reference** — read [references/format.md](references/format.md) before writing any non-trivial scene. It covers every layer type's keys, effects (blur, shadow/glow/stroke/overlay, corner-pin), masks (rect/ellipse/path + shape morphing), track mattes, sub-comps, rich-text styles, per-character text animators, and the raw-VASCO passthrough escape hatch.

**Motion design** — for anything that should look polished, cinematic, high-end, or "great" (ads, title sequences, brand videos), read [references/motion-design.md](references/motion-design.md). It's a pro-level craft guide grounded in this engine: timing & spacing, the easing vocabulary (which ease for which feel), entrances/exits, kinetic text, beat transitions, effects with intent, depth/camera/atmosphere, rhythm to audio, polish details, anti-patterns, and drop-in keyframe recipes.

**Recipes** — [references/recipes.md](references/recipes.md) has 43 ready-to-paste effect recipes in the compact format, grouped by **text · transitions · motion · masks · special FX · extras** (tracking-in, rich multi-style headline, typewriter-with-following-caret, per-word bounce, glitch, 3D flips, scale-through, whip-pan, light-leak, iris/clock wipes, camera dolly, fly-through, bounce+squash, mattes, glow/DOF/RGB-split/corner-pin/reflection/frosted-glass/colour-grade, rich-text styles, easing comparison). Copy a snippet into your scene's `layers` and tune.

## Rules of thumb

- Text layers **require** `font` (path to a .ttf/.otf). Media/audio layers require `src`. Asset files must exist at compile time. A bundled free font ships with the repo at `examples/assets/DejaVuSans.ttf` (`strata schema` prints the full VASCO schema if you need an exotic property).
- **`anchor` + `position` — the #1 transform bug. Read this before animating position on an anchored layer.** `anchor` is the pivot for scale/rotation (comp coords), and `position` is the absolute comp point where that pivot **lands** — it is *not* an offset once an anchor is set. `position` **defaults to the anchor**, so set *only* `anchor` (the layer's center) and the layer scales/rotates in place. The trap: setting an anchor and then animating `position` to `[0,0]` (offset-style) snaps the pivot to the top-left corner and yanks the whole layer up there. To scale/rotate in place **and** move (rise/slide), write every position keyframe as **anchor + offset**, and make the *resting* keyframe equal the anchor:
  - ❌ `"anchor":[960,540]` with `"position":[[0,40]→[0,0]]` → flies to the top-left.
  - ✅ `"anchor":[960,540]` with `"position":[[960,580]→[960,540]]` → rises 40px into place, centered.
  - Just need a plain pixel nudge with no pivot? **Omit `anchor`** and `position` is a simple offset from the layer's natural spot. (The anchor is baked into the transform as `T(position)·R·S·T(−anchor)` — the engine does not apply `anchor_point` itself.)
- The `ease` on a keyframe shapes the segment leaving it; if absent, the next keyframe's ease is used (so either CSS-style or AE-style placement works).
- Keyframe times are relative to the layer's `start`, not the comp.
- Sub-comps that reference other sub-comps must be declared after the comps they reference inside `comps` (the main scene may reference any of them).
- Anything not listed in the reference passes through verbatim as raw VASCO, so every engine capability is reachable.
- Comp max dimension is 1920 on each axis.
- **Motion blur is ON by default** for every visual layer (the compiler sets `motion_blur: true`) — pass `"motion_blur": false` on a layer to disable it. For visible blur on fast moves, raise the comp's `shutter_angle` (default 0.5; 1–1.3 reads more cinematic).
- **Fonts must cover the text's glyphs.** A character the font lacks renders as a blank/tofu box or breaks the render → a bad IDM. Before the final compile, verify the font has every character used — especially non-ASCII letters, currency (€ £ ₪), curly quotes/dashes (“ ” – —), symbols (™ © • → ✓), and emoji. See the glyph-coverage check in [references/format.md](references/format.md) (Text section); fix by choosing a font that covers the script (e.g. Noto), per-span fonts in `styles`, or ASCII substitutes.
- **Personalized videos**: every layer is an API-replaceable placeholder keyed by its name. If the user says the video is personal/personalized, read the *Personalization* and *Graphs & charts* sections in [references/format.md](references/format.md) — size text boxes and media slots for varying content, and treat graphs as swappable images where the animation reveals whatever data the image carries.
