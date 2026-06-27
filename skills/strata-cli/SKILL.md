---
name: strata-cli
description: Author cinematic, creative motion-design videos with the `strata` CLI — write a compact scene JSON, compile it to a binary `.idm` locally, generate assets (image, image-to-video, narration, music) via the Idomoo AI API, and render to MP4. VASCO is a full 3D engine: 3D layers, a real camera, depth, masks, effects, per-character text animators. Use when the user asks to make a strata video, make/build/compile an IDM, create a video template as .idm, build a motion-graphics / kinetic-text / title-sequence / explainer / promo / personalized or data-driven video, work with VASCO locally, render an IDM to MP4, generate video assets, or animate layers with tweens/keyframes. Not for the Idomoo cloud briefs/blueprints API.
---

# Strata CLI — cinematic motion design, authored as IDM/VASCO

I make **bold, cinematic, story-driven motion graphics** — not slideshows. VASCO is a real **3D motion-design engine**: 3D layers with depth, a moving **camera**, masks, effects, per-character text animators, and a keyframe tween engine. I use that power. My default is *great*: deliberate shots, alive frames, motion with meaning. This skill is the craft; the references are the syntax (`format.md`) and drop-in patterns (`recipes.md`).

---

# PART 1 — How I make great video (this is the job)

## Story & concept first
- **Find the arc.** Beginning → tension → resolution. Every piece, even 8 seconds, has one. I name the single message the viewer should leave with — if I can't say it in a sentence, it's not ready.
- **Find the tension.** Product vs. the old way, user vs. friction, before vs. after. Tension holds attention.
- **Align before building.** I run the concept past the user first — re-cutting an idea is cheap, re-rendering a finished video is not.
- **One idea per beat.** A beat is ~1.5–4s with a single job (hook → value → proof → CTA). If two things fight for the eye, I stagger them.

## Think in shots (cinematography)
A scene is a sequence of deliberate shots. For each beat I decide the shot:
- **Establishing → push in.** Open wide to set the world, then move in on the action. Show, don't tell — titles only when they beat pictures.
- **Hard cut / rapid intercut** between two things in tension.
- **Follow shot** that tracks a cursor, a graph line, a character, a product as it moves.
- **Reveal** that builds an image or layout piece by piece.
- **Vary the shots** — sameness kills attention. And **keep it in a real context** (a desk, a phone UI, a place); elements floating in the void read as unfinished.

## Compose the frame — layouts, not just fullscreen
My default is **not** "fullscreen image/video with text on top." Every layer has a `box`, so I compose deliberately and vary it across beats:
- **Split & grid layouts:** half/half (media on one side, a text/colour panel on the other), thirds, 2×2 grids, a sidebar + main.
- **Framed media & product slots:** a media placeholder sized and positioned *inside* a designed backdrop — colour panels, shapes, a device/phone frame, a card. Perfect for product shots and personalized photos.
- **Multiple media at once:** two videos side by side, picture-in-picture, or a video occupying a third of the frame with colour shapes/solids filling the rest.
- **Solids & shapes are design elements**, not just backgrounds — colour blocks, bars, cards, and panels structure the layout and frame the media.
- **Multiple shots in one scene:** cut between framings/elements within a single scene using layer `start`/`duration` (and sub-comps) — a scene isn't one static composition.
The strongest videos change their composition beat to beat; I avoid repeating the same fullscreen-media-plus-caption frame.

## 3D & camera — VASCO's superpower (use it)
This is what separates a flat template from a film. VASCO layers can be 3D and there's a real camera:
- **`is_3d: true`** on layers + a **`camera`** layer (`fov`/`field_of_view`, animated `position`/`zoom`/`rotation`) → genuine dollies, push-ins, orbits, rack-focus feel.
- **Parallax with depth:** give layers different **z** (third value in `position`/`anchor`, e.g. `[960,540,-400]`) and move the camera — near and far layers drift at different rates. Instant cinematic depth.
- **Camera moves, not layer moves:** when several elements should travel together, move the **camera** (or a parent comp), not each layer. A slow camera push under a settling title reads premium.
- **3D card flips / space:** rotate 3D layers on X/Y for flips and turns; stage elements in depth so a push-in travels *through* them.
- See the **Camera** and **3D** keys in `format.md`. Reach for depth/camera whenever a beat feels flat.

## Keep every frame alive
- **Something is always moving.** Except a deliberate held beat, the camera, an element, or a transition is in motion — drift, zoom, build. A truly static frame reads as a bug.
- **Images are never still.** Every photo/still gets a slow **Ken-Burns** (scale + position on an anchored layer) or graphics building over it.
- **Let it breathe.** I hold text/images for read time (~0.5s + ~0.3s per word) before moving on, and never animate out before it can be read. Pacing is a feature, not dead air.

## Motion principles (the fundamentals)
- **Disney basics:** anticipation (wind up before the move), **ease in/out** (nothing starts/stops instantly), follow-through & overlap (parts trail and settle), squash & stretch, exaggeration (push past literal for life), staging (compose so the eye lands where I want).
- **Timing is *when*; spacing is *how* the value distributes across the move (the easing).** Amateurs leave timing uniform and motion linear; I vary both.
- **Easing vocabulary** (which feel for which job):
  - `outCubic` / `outQuart` — confident UI/text settle (decelerate in).
  - `outBack` — playful overshoot for entrances (use sparingly).
  - `outExpo` — fast, premium snap that glides to rest.
  - `inOutSine` / `inOutCubic` — smooth drifts, Ken-Burns, camera.
  - `outElastic` / `outBounce` — toy-like; only when the brand is energetic.
  - `linear` only for continuous loops/conveyors; `hold` to freeze between keys.
  - Or a cubic-bezier `[x1,y1,x2,y2]` for a custom curve.

## Kinetic typography
- **Per-character / per-word animators** make text feel alive — words rise & fade in, letters track in, cascades. Use `animators` with `ranges` (`based_on: words|characters|lines`, `shape: ramp_up|…`); prefer **percentage** range units so any string length cascades correctly. (Syntax in `format.md` Text; copy from `recipes.md`.)
- **Type with intent:** big where it matters, generous tracking for labels, tight for impact. Animate the meaning (a number counts up; a key word punches in).

## Transitions between beats
- **Match-cut / continuity:** carry a shape, colour, or motion vector across the cut so beats feel connected.
- **Whip-pan, light-leak, iris/clock wipe, scale-through** — use a transition with intent, not as decoration. (Recipes available.)
- Cutting on a **camera move** or an audio beat hides the seam and feels designed.

## Depth, light & atmosphere
- Layer **glow / shadow / blur / overlays** for depth and mood; a subtle vignette (feathered ellipse mask) focuses the eye. Grade with a colour overlay for a coherent look.
- **Motion blur is on by default** — it's a big part of what reads as rendered-not-stuttery. Keep it on for moving layers; raise comp `shutter_angle` (1–1.3) for fast moves.

## Rhythm & continuity
- **Cut/hit to the audio.** If there's narration or music, land key moves on beats and size each scene to the **narration's returned duration** (TTS reports it). Transitions ~0.3–0.5s between clips.
- **Vary energy:** a quiet beat makes the next loud one hit harder. Design the whole arc: intro (tone) → body (escalate) → climax (biggest move/stat) → resolve (logo/CTA).

## Polish & anti-patterns
- **Polish:** nothing moves linearly; entrances overshoot or settle, never pop; text has read time; elements have weight (ease + follow-through); one clear focal point per frame.
- **Amateur tells I avoid:** everything fades in the same way at the same time; centered static text on a static frame; linear motion; clutter with no hierarchy; looping a clip to fill time (a visible loop reads cheap — cut to a different shot or `playback_mode: "hold"`); decorative motion with no meaning.

## Craft check (before I call it done)
After render I look at the poster (or extract a frame) — compile success ≠ good frame — and ask:
- Is the **message** unmistakable? Does **every shot** earn its place?
- Is there a moment of **stillness** *and* a moment of **energy**?
- Does the **pacing** let the key beats land? Would the **first three seconds** make someone keep watching?
- Is something always moving; do images move; is there depth/camera where the frame felt flat?

---

# PART 2 — Design & layout (so it reads clean and on-brand)
- **Visual hierarchy / stamp test:** glance at the frame — what did I see first? If it isn't the most important thing, I fix size/contrast/colour/placement. Product + CTA win the first glance.
- **Composition:** F-pattern (top-left draws the eye) and rule of thirds — key elements on the thirds, not dead center. Give content **space**; "less is more" reads premium; "don't shout."
- **Proximity / alignment / consistency:** group related things, align cleanly, commit to a small style set and repeat it.
- **Typography:** **≤2 typefaces** — vary weight/size/colour for emphasis, not new fonts. Define fallback fonts; the font must cover every glyph used.
- **Colour:** set emotional tone, apply brand colours consistently. The same scene reads completely differently by colour treatment.
- **Safe areas:** keep text within ~90% title-safe; reserve a lower band for captions; don't collide layers or overflow the frame; avoid the player chrome.
- **Over dynamic images:** drop a **transparent dark scrim** under text so it stays legible whatever image arrives.
- **Personalization (Idomoo's core):** every layer is an API-replaceable placeholder keyed by its **name**. Size text boxes for longer/shorter values (keep `shrink`, sensible `min_size`, deliberate alignment); use `fit:"fill"` for full-bleed media slots; per-character animators adapt to any string. Time the personalized reveal **early but not at t=0** (videos start muted). Treat graphs as swappable images whose animation reveals whatever data the image carries. (Details in `format.md`.)

---

# PART 3 — Operating the CLI

## Setup — I check BEFORE installing anything
The `strata` CLI is a **standalone self-contained binary** (embeds its own runtime — I never install Node/npm for it).
1. **Check first:** `strata version`. If it prints, skip setup. Also try `~/.local/bin/strata` (Unix) and `%LOCALAPPDATA%\Programs\strata\strata.exe` (Windows).
2. **Only if missing:** Linux/macOS `curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash` (set `STRATA_SKILL=skip` in agents); Windows `irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex`; or grab a binary from the releases page and run by path.

## I generate assets — I don't make the user supply everything
The CLI creates media via the Idomoo AI API (needs auth; saves to `./strata_assets/`):

| command | makes |
|---|---|
| `strata generate image "<prompt>" [--aspect 9:16] [--colors "#a,#b"] [--reference <url>]` | a still PNG (async) |
| `strata generate video <image-url> [--prompt "<motion>"] [--duration 5] [--ratio 9:16]` | an **image-to-video** clip from a still (async) |
| `strata generate narration "<text>" --voice <voice_id>` | TTS voiceover MP3 (`strata generate voices` lists ids) |
| `strata generate music "<prompt>" [--duration 30]` | an instrumental track |

Chain: **image → animate into video → narration + music**, then point `src` at the saved files.

**Whenever I generate an image, I ask the user: animate it into a video (image-to-video) or keep it as a still?** I never decide silently — I generate the image, show/point to it, and ask before moving on. Motion usually wins for hero shots and backgrounds (a still that never moves reads as a slideshow), but it's the user's call per image.

## Workflow
1. **Sort out assets first.** For each visual element I ask: (a) do they have a file or should I `generate` it, and (b) **still image or moving video** — motion reads as motion-graphics, so I favour video/animated stills for hero moments. I ask about **narration**/music too. Text layers need a real `.ttf`/`.otf`.
2. **Present a STORYBOARD and get sign-off — before any scene JSON.** I apply the craft (Part 1) and design (Part 2) to plan the piece, then show the user a storyboard they can read and approve. I do **not** start authoring until they confirm; I revise the storyboard with them first (cheap to re-cut, expensive to re-render). Format:
   - **Title** + one-line **Style** (palette, motion feel, type).
   - A **beat table** — `Time | Visual / Motion | Voiceover | Sound` — one row per beat (~2–4s), covering the full duration.
   - **End frame** (logo/CTA text) and **Motion notes** (transition timing ~300–500ms; transform-based — scale/position/opacity/masks; the intended feel).

   ```
   Title: "Find It Faster"
   Style: Clean, bright, minimal UI motion. White bg, brand-colour accents, smooth morphs, soft kinetic type.
   | Time | Visual / Motion | Voiceover | Sound |
   |------|-----------------|-----------|-------|
   | 0:00–0:03 | Search bar slides in, soft scale-up; cursor blinks | "Every big answer…" | soft digital pulse |
   | 0:03–0:06 | "how do I start?" types into the bar | "…starts with a simple question." | keyboard taps |
   | … | … | … | … |
   | 0:28–0:30 | Logo appears; "Search it. Find it." fades in | "…start with Search." | final soft chime |
   End frame: Google Search — "Search it. Find it."
   Motion notes: fast confident 300–500ms transitions, transform-only, light bounce on bar + cards.
   ```
3. **Write the scene JSON** to the approved storyboard (compact format — `format.md` is the spec). I **reuse blocks** (`strata add <block>` — see [blocks.md](blocks.md)) and follow a [blueprint](blueprints.md) for the video type instead of building from scratch; **unique name on every layer**; iterate the timeline.
4. **Validate, then compile:** `strata validate scene.json` (free, offline — names any bad key/layer and warns about the known exporter traps) → `strata compile scene.json -o out.idm`.
5. **Render:** `strata render scene.json --library "<id>" -o out.mp4`.
   - **Library — pick ONE and reuse it.** First time: ask once, `strata library create "<name>"` → save the printed **id** (persist it, e.g. a `.idm-library` file). Every later render passes that same `--library <id>`; it logs `Reusing library <id>` (if it logs `Created NEW library` I passed the wrong value). Switch only when the user says so.
   - Renders take minutes — I run them in the **background** and report the `video_url`/`poster_url`.
6. **Verify** — I run `strata snapshot scene.json --library <id>` for a fast poster-only frame (cheaper than a full MP4) and look at it, then run the **Definition of Done** before I call it shipped:
   - Message clear in the first 3 seconds? Every shot earns its place? Stillness *and* energy?
   - Text legible **muted** (captions/scrim where needed) and inside the safe area?
   - **Every layer name unique** (the compiler warns/fixes, but I author them unique)?
   - Holds on the CTA; nothing loops cheaply; motion blur on moving layers?
   - **Would I ship this with my name on it?** If not, I fix it before delivering.
   Debug with `--vasco` or `strata inspect out.idm`.

Commands: `compile` · `validate` · `inspect` · `generate image|video|narration|music|voices` · `add <block>` · `render --library <id>` · `snapshot --library <id>` (poster-only, fast QA) · `library list|create` · `init` · `auth login|status` · `schema` · `update` · `uninstall`. Add `--json` for machine-readable output (errors on stderr; nothing reads a TTY non-interactively). Exit codes: 0 ok · 1 compile/schema · 2 missing file · 3 auth · 4 render timeout.

## Technical must-knows (the traps)
- **`anchor` + `position` — the #1 bug.** Once an `anchor` is set, `position` is the **absolute comp point where that pivot lands**, not an offset (it defaults to the anchor). To scale/rotate in place AND move, write every position keyframe as **anchor + offset** with the resting keyframe equal to the anchor. ❌ `anchor:[960,540]` + `position:[[0,40]→[0,0]]` flies to the corner. ✅ `position:[[960,580]→[960,540]]` rises into place. No pivot needed? Omit `anchor` and `position` is a plain offset.
- **Verify before render:** `strata validate` schema-checks offline and **names the offending key** — the strict VASCO schema rejects any key it doesn't define (no inventing `z`/`x`/`y`/`width`/`comment`/`radius`/`src`-on-text). Fix until clean.
- **Styled spans + non-ASCII — handled.** The exporter indexes span ranges by byte, so multi-byte chars (`×`, `€`, CJK, emoji) used to crash it; the compiler now auto-converts span offsets to UTF-8 bytes, so styled non-ASCII text just works. Nothing for me to do.
- **Layer names must be UNIQUE across the whole scene.** The exporter keys layers (especially text placeholders) by name **globally**, so the same name in two sub-comps — e.g. a card sub-comp reused with the text layer named `label` in each — **collides and crashes the render** (error 3000). This was the #1 cause of "compiles but won't render". The compiler now **auto-uniquifies** duplicate names (`label`→`label_2`, …) and prints what it renamed — but I still give every layer a distinct, meaningful name up front (`img_label`, `map_label`, `cta`) so personalization keys stay predictable.
- **Misc:** comp max dimension 1920/axis; keep **motion blur** on for moving layers; **fonts must cover every glyph** (else tofu/broken render — verify non-ASCII/currency/quotes/symbols/emoji); keyframe times are relative to the layer's `start`; sub-comps referencing other sub-comps are declared earlier in `comps`.

---

# References
- **[references/format.md](references/format.md)** — the full technical spec: every layer key, 3D & camera params, effects (blur/shadow/glow/stroke/overlay/corner-pin), masks (rect/ellipse/path + morphing), track mattes, sub-comps, rich-text styles, per-character animators, asset generation, and the glyph-coverage check. **I open this for any syntax question.**
- **[references/recipes.md](references/recipes.md)** — paste-ready, engine-correct patterns (kinetic text, transitions, motion, masks, special FX, 3D, camera, and **data-viz**: count-up, bar chart, progress ring, stat bar, line draw, parallax). **I start from a recipe instead of re-deriving.**
- **[references/blocks.md](references/blocks.md)** — reusable sub-comp **blocks** (lower-third, stat-card, end-card, logo-sting, device-frame, search-bar, quote-card). I reuse a block via `strata add <block> scene.json` instead of building from scratch.
- **[references/blueprints.md](references/blueprints.md)** — whole-video **recipes by type** (product launch, explainer, social promo, data story, logo reveal, website/app showcase, overlay-existing-footage) — structure, pacing, and which blocks to use. I pick one to feed the storyboard.
- **[references/personalization.md](references/personalization.md)** — one template → **many personalized videos** (placeholder naming, data-driven batch). Idomoo's superpower; I read it for any personal/data-driven video.
