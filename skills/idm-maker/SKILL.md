---
name: idm-maker
description: Author Idomoo IDM video files locally from a compact scene JSON, compiled with the `idm` CLI, optionally rendered to MP4 via the Idomoo API. Use when the user asks to make/build/compile an IDM, create a video template as .idm, work with VASCO locally, render an IDM to MP4, or animate layers (text, image, video, solid, audio, camera) with tweens/keyframes. Not for the Idomoo cloud briefs/blueprints API.
---

# IDM Maker — compact scenes compiled to .idm locally

Turn a short "scene" JSON into a full VASCO project, compile it to a binary `.idm` entirely locally, and optionally render it to an MP4 on Idomoo.

## Setup — check BEFORE installing anything

The `idm` CLI is a **standalone self-contained binary**. It embeds its own JavaScript runtime — **never install Node.js, npm, or any other runtime for it**.

1. **Check it first**: run `idm version`. If it prints a version, the CLI is ready — skip all setup. Also try `~/.local/bin/idm version` (Linux/macOS) and `%LOCALAPPDATA%\Programs\idm\idm.exe version` (Windows) in case it is installed but not on PATH.
2. **Only if missing**, install the binary:
   - Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash` (in sandboxes/agents set `IDM_SKILL=skip` to suppress the interactive skill prompt)
   - Windows: `irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex`
   - Or download the platform binary directly from https://github.com/Idomoo-RnD/vasco/releases/latest (`idm_linux_amd64`, `idm_linux_arm64`, `idm_darwin_arm64`, `idm_darwin_amd64`, `idm_windows_amd64.exe`), `chmod +x` it, and run it by path — no further setup.
3. **Test it works** (offline, no assets/credentials needed — exit 0 means the toolchain is good):

   ```bash
   idm version
   echo '{"width":1280,"height":720,"fps":25,"duration":1,"layers":[{"type":"solid","color":"#102040"}]}' > /tmp/t.json
   idm validate /tmp/t.json
   ```

## Workflow

1. **Ask the user about assets first**: do they have images, video clips, audio/music, fonts, or brand colors to use, **or should the CLI generate them?** Get file paths for anything they already have. For anything missing, the CLI can generate real assets via the Idomoo AI API — `idm generate image|video|narration|music` (needs auth; saves files to a folder). Read the *Generating assets* section in [references/format.md](references/format.md) for each tool's params and output. Use a generated/placeholder font only as a last resort — text layers REQUIRE a real `.ttf`/`.otf`. Skip the question only when the user already specified assets or explicitly asked you to generate or use placeholders.
2. Understand what video the user wants (size, duration, layers, motion).
3. Write a scene JSON (compact format below). Use paths relative to the scene file (or absolute paths) for all assets.
4. Compile: `idm compile scene.json -o out.idm` — it validates the compiled VASCO against the official schema before writing and prints a summary. Report the output path.
5. To render an MP4: `idm render scene.json --library "<name>" -o out.mp4`.
   - **Credentials**: ask the user for their **account ID** and **secret key** if `idm auth status` fails. Set them via `idm auth login --account <id> --token <secret>`, or env `IDOMOO_ACCOUNT_ID`/`IDOMOO_SECRET_KEY`.
   - **Library**: the upload destination is the user's choice — never pick one for them. Run `idm library list --json`, show the user the existing libraries, and ask which to upload to (or a name for a new one — passing a new name creates it). Then pass it as `--library "<name-or-id>"`. Without the flag, a non-interactive render fails with the library list in the error.
   - A render takes minutes (upload → export → render, polled); run it in the background and report the printed video/poster URLs.
6. To debug, use `--vasco` (dumps compiled VASCO JSON) or `idm inspect out.idm` (decode a binary back).

Commands (a bare `.json` arg implies `compile`, a bare `.idm` implies `inspect`):
`compile <scene.json> [-o out.idm] [--vasco]` · `validate <scene.json> [--print]` · `inspect <file.idm> [--assets <dir>]` · `render <scene.json|.idm> [-o out.mp4] [--height] [--quality]` · `init [scene.json]` · `auth login|status` · `schema` · `update`. Add `--json` for machine-readable output. Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout.

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

**Full reference** — read [references/format.md](references/format.md) before writing any non-trivial scene. It covers every layer type's keys, effects (blur, shadow/glow/stroke/overlay, corner-pin), masks (rect/ellipse/path + shape morphing), track mattes, sub-comps, rich-text styles, per-character text animators, and the raw-VASCO passthrough escape hatch.

**Motion design** — for anything that should look polished, cinematic, high-end, or "great" (ads, title sequences, brand videos), read [references/motion-design.md](references/motion-design.md). It's a pro-level craft guide grounded in this engine: timing & spacing, the easing vocabulary (which ease for which feel), entrances/exits, kinetic text, beat transitions, effects with intent, depth/camera/atmosphere, rhythm to audio, polish details, anti-patterns, and drop-in keyframe recipes.

## Rules of thumb

- Text layers **require** `font` (path to a .ttf/.otf). Media/audio layers require `src`. Asset files must exist at compile time. A bundled free font ships with the repo at `examples/assets/DejaVuSans.ttf` (`idm schema` prints the full VASCO schema if you need an exotic property).
- `anchor` is the pivot for scale/rotation, in comp coordinates; `position` is where that pivot lands and **defaults to the anchor** — so to scale/rotate a layer in place around its center, set only `anchor` to the layer's center point. Without an anchor, `position` is a plain offset from the layer's natural spot. (The anchor is baked into the transform matrix — the engine does not apply `anchor_point` itself.)
- The `ease` on a keyframe shapes the segment leaving it; if absent, the next keyframe's ease is used (so either CSS-style or AE-style placement works).
- Keyframe times are relative to the layer's `start`, not the comp.
- Sub-comps that reference other sub-comps must be declared after the comps they reference inside `comps` (the main scene may reference any of them).
- Anything not listed in the reference passes through verbatim as raw VASCO, so every engine capability is reachable.
- Comp max dimension is 1920 on each axis.
- **Motion blur is ON by default** for every visual layer (the compiler sets `motion_blur: true`) — pass `"motion_blur": false` on a layer to disable it. For visible blur on fast moves, raise the comp's `shutter_angle` (default 0.5; 1–1.3 reads more cinematic).
- **Fonts must cover the text's glyphs.** A character the font lacks renders as a blank/tofu box or breaks the render → a bad IDM. Before the final compile, verify the font has every character used — especially non-ASCII letters, currency (€ £ ₪), curly quotes/dashes (“ ” – —), symbols (™ © • → ✓), and emoji. See the glyph-coverage check in [references/format.md](references/format.md) (Text section); fix by choosing a font that covers the script (e.g. Noto), per-span fonts in `styles`, or ASCII substitutes.
- **Personalized videos**: every layer is an API-replaceable placeholder keyed by its name. If the user says the video is personal/personalized, read the *Personalization* and *Graphs & charts* sections in [references/format.md](references/format.md) — size text boxes and media slots for varying content, and treat graphs as swappable images where the animation reveals whatever data the image carries.
