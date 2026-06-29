# Asset generation — image, image-to-video, narration, music

The CLI generates media via the Idomoo AI API (Lucas). Needs auth (`strata auth login`).
Each command saves the file locally (default `./strata_assets/`, or `-o <file>` /
`--out-dir <dir>`) and prints the local path **and** a hosted URL; add `--json` for
machine-readable output. Image/video are **async** (polled to completion); narration is sync.

**The chain:** image → animate it into a video → narration + music for the audio bed →
point the scene's `src`/`audio` at the saved files.

**Local files vs URLs — both work everywhere.** Every endpoint that takes an image accepts
either a hosted URL or a **local file path** (the CLI base64-encodes it into a data-URI; no
upload step). So `--reference ./mascot.png` and `generate video ./hero.png` just work.

---

## `strata generate image "<prompt>" [flags]`
A still PNG (async, ~10–20s).

| flag | meaning |
|---|---|
| `--aspect` | `16:9 4:3 3:4 1:1 9:16 21:9` (default `1:1`). Match the comp (e.g. `9:16` for vertical). |
| `--colors "#hex,#hex"` | brand palette to bias the result |
| `--reference <img\|url>` | **reference image(s)** — repeatable (and comma-splittable); each a local file or URL |
| `-o <file>` / `--out-dir <dir>` | output path / folder (default `./strata_assets/`) |

### Reference images — art style, characters, composition (the important part)
Reference images steer the result toward a **look**, a **character**, a **logo**, or a
**composition**. Use them whenever:
- the user gives an image — a brand character, mascot, logo, product photo, style frame, or a
  previous generation — and wants that look/subject, **or**
- you need a **recurring character or consistent art style across shots**. Generate every shot
  from the **same reference(s)** so they stay on-model — pure text prompts drift shot to shot.

**Drive them by INDEX in the PROMPT.** References are numbered by order: the 1st `--reference`
is **image 0**, the 2nd **image 1**, etc. Cite the index in the prompt text:
- *"using **image 0**'s art style, draw a dog"* — style transfer onto a new subject.
- *"put the character from **image 1** into **image 0**'s scene"* — combine across references.

**Verified behaviour (tested live):**
- A single reference transfers its **character + palette + art style** faithfully (an orange
  one-eyed mascot → the same mascot on a skateboard; the same prompt with no reference produced
  an unrelated stock photo). It reproduces the *subject* strongly — to draw a **new** subject in
  that look, say "using image 0's **style**…", not just "image 0".
- **Multiple references compose** — pass several and they combine (two characters in one frame,
  or "image 0's character in image 1's palette").
- When refs compete, **be explicit per index** so one wins: add *"do not use image 1's colours"*.
  Soft phrasing ("using image 1's style, draw a dog") lets the first/dominant ref take over —
  verified: explicit "use ONLY image 1, not image 0" correctly selected image 1.
- Index maps to the `--reference` **order**: with refs `[cat, robot]`, "image 0" = the cat.
- Local **PNG/JPG/WebP** and hosted URLs both work.

Examples:
```bash
strata generate image "using image 0's art style, draw a dog" --reference ./mascot.png
strata generate image "image 1's character standing in image 0's scene" --reference ./bg.jpg --reference ./hero.png
strata generate image "hero banner, brand palette" --aspect 16:9 --colors "#2563eb,#16a34a"
```

---

## `strata generate video <image> [flags]`  — image-to-video
An MP4 clip animated from a still (async, ~1–3 min). The positional `<image>` is a hosted
URL **or a local file path** (auto-base64).

| flag | meaning |
|---|---|
| `--prompt "<motion>"` | describes the camera/movement (e.g. "slow push-in, gentle parallax") |
| `--duration <sec>` | clip length (default 5) |
| `--ratio <e.g. 9:16>` | output aspect |

Reference the result as a `video` layer; set `loop: true` to hold it for the comp's duration.
Typical flow: `generate image` → feed its printed url (or the saved file) straight into
`generate video`.

```bash
strata generate video ./hero.png --prompt "slow cinematic push-in" --duration 5 --ratio 16:9
strata generate video https://…/image.png --prompt "subtle idle bob"
```

---

## `strata generate narration "<text>" --voice <voice_id>`
TTS voiceover MP3 (sync). Returns the spoken **duration** in seconds — size the scene around it.
- `strata generate voices [--search <text>]` lists `voice_id  name · gender · accent · use-case`.
- `--voice <voice_id>` (required) · `--normalize <mode>` for text normalization.
Reference the MP3 as an `audio` layer. Pair the personalized value with the visual so it lands.

## `strata generate music "<prompt>" [--duration <sec>]`
An instrumental track (default 30s). Reference as an `audio` layer at low `volume` with
`ducking: true` so it sits under narration.

---

## Still vs video — always ask
**Whenever you generate an image, ask the user: animate it into a video (image-to-video) or
keep it as a still?** Never decide silently — generate the image, show/point to it, then ask.
Motion usually wins for hero shots and backgrounds (a still that never moves reads as a
slideshow), but it's the user's call per image.
