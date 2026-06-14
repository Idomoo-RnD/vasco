```text
▄▄ ▄▄▄▄   ▄▄▄  ▄▄   ▄▄  ▄▄▄   ▄▄▄    ▄▄ ▄▄  ▄▄▄   ▄▄▄▄  ▄▄▄▄  ▄▄▄
██ ██▀██ ██▀██ ██▀▄▀██ ██▀██ ██▀██   ██▄██ ██▀██ ███▄▄ ██▀▀▀ ██▀██
██ ████▀ ▀███▀ ██   ██ ▀███▀ ▀███▀    ▀█▀  ██▀██ ▄▄██▀ ▀████ ▀███▀
```

# IDM CLI

**Author Idomoo IDM videos from the command line.** A compact scene JSON — keyframe tweens, effects, masks, hex colors — compiles locally into a binary `.idm`, then renders to MP4 through the Idomoo API.

## 1. Install the CLI

**Single standalone binary — no runtime required** (never install Node.js for it). macOS and Linux (amd64 + arm64):

```bash
curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex
```

The installer downloads the platform binary from [releases](https://github.com/Idomoo-RnD/vasco/releases), verifies its checksum, installs it (`~/.local/bin/idm` on Unix, `%LOCALAPPDATA%\Programs\idm\idm.exe` on Windows), and asks which agent skills to install (next section). Verify with:

```bash
idm version
```

Update anytime with `idm update` (self-replaces from the latest release). Prefer manual? Download a binary straight from the [releases page](https://github.com/Idomoo-RnD/vasco/releases/latest) and run it by path. Building from source needs Node ≥ 18: clone, `npm install`, `node bin/idm.mjs` (or `node scripts/build-sea.mjs` for your own binary).

## 2. Install the agent skills

The installer already offers this menu (Claude Code / Codex / Cursor / Cowork / All / Skip — non-interactive runs use `IDM_SKILL=...`). To (re)install later:

| agent | command | lands in |
|---|---|---|
| **Claude Code** | `idm skill install` | `~/.claude/skills/idm-maker` |
| **OpenAI Codex** | `idm skill install --codex` | `~/.codex/skills/idm-maker` |
| **Cursor** | `idm skill install --cursor` | `~/.cursor/skills/idm-maker` + project `.cursor/skills` |
| **Claude Cowork / claude.ai** | `idm skill install --cowork` | writes `idm-maker-skill.zip` — upload it in the app: **Customize → + → Skills** |

Flags combine (`--claude --cursor --cowork`). For Cursor team projects, commit `.cursor/skills/idm-maker/` to the repo. Other agents: point them at [SKILL.md](SKILL.md) (CLI usage) and [skills/idm-maker/SKILL.md](skills/idm-maker/SKILL.md) (authoring guide) — plain markdown, no tooling assumptions.

Once installed, just ask your agent to *"make an idm of …"* — the skill triggers, writes the scene JSON, and drives `idm`.

## 3. Authenticate (only needed for rendering)

Compiling is fully local and needs no account. Rendering MP4s needs your Idomoo **account id** and **secret key**:

```bash
idm auth login --account 1234 --token your-secret    # persists to ~/.idm/credentials
idm auth status                                       # verify
```

Or keep it ephemeral for agents/CI:

```bash
export IDOMOO_ACCOUNT_ID=1234
export IDOMOO_SECRET_KEY=your-secret
```

## 4. Quick start

```bash
idm init scene.json            # starter scene (point "font" at a real .ttf)
idm compile scene.json         # -> scene.idm, schema-validated, prints a summary
idm library list               # pick (or invent) a library to upload into
idm render scene.json --library "Demos" -o scene.mp4
```

A taste of the scene format:

```json
{
  "width": 1280, "height": 720, "fps": 25, "duration": 4,
  "layers": [
    { "type": "solid", "name": "bg", "color": "#10204a" },
    { "type": "text", "name": "title", "text": "Hello, IDM!",
      "font": "./DejaVuSans.ttf", "size": 96, "color": "#ffffff",
      "box": [100, 260, 1080, 200], "align": "center middle",
      "animate": {
        "opacity":  [ {"t": 0, "v": 0}, {"t": 0.8, "v": 1, "ease": "outCubic"} ],
        "position": [ {"t": 0, "v": [0, 60], "ease": "outBack"}, {"t": 0.8, "v": [0, 0]} ]
      } }
  ]
}
```

Shorthand: a bare `.json` argument means `compile`, a bare `.idm` means `inspect`:

```bash
idm scene.json
idm scene.idm                  # decode back to vasco JSON
```

## 5. Generate assets (optional)

Need media for a scene? The CLI generates it via the Idomoo AI API and **saves the file to a folder** (`./idm_assets/` by default, `--out-dir <dir>`, or `-o <file>`). Uses the same credentials as `render`.

```bash
idm generate voices --search female                          # pick a voice_id
idm generate image "sunset over a community garden" --aspect 9:16
idm generate video <image-url> --prompt "gentle push in" --duration 5
idm generate narration "Thank you for your support." --voice <voice_id>
idm generate music "warm acoustic folk instrumental" --duration 30
```

Typical chain: generate an **image**, feed the printed image URL to **video** (image-to-video), and add **narration** + **music** for the audio track — then point the scene's `src` at the saved files. Image and video are asynchronous (the CLI submits, polls, and downloads); narration is synchronous. Add `--json` for machine-readable `{ path, url, ... }`.

## Commands

| command | what it does |
|---|---|
| `idm compile <scene.json> [-o out.idm] [--vasco]` | scene → `.idm`, schema-validated (`--vasco` dumps the compiled VASCO JSON) |
| `idm validate <scene.json> [--print]` | compile + schema-check only, no file written |
| `idm inspect <file.idm> [--assets <dir>]` | decode an `.idm` back to VASCO JSON, optionally extract embedded assets |
| `idm render <scene.json\|.idm> --library <name-or-id> [-o out.mp4] [--height] [--quality]` | upload, render, download the MP4 (interactive runs ask which library) |
| `idm library list` | list your Idomoo libraries |
| `idm generate image\|video\|narration\|music\|voices …` | generate IDM assets via the Idomoo AI API, saved to a folder |
| `idm init [scene.json]` | write a starter scene |
| `idm auth login \| status` | manage credentials |
| `idm schema` | print the VASCO JSON Schema |
| `idm skill install [--claude] [--codex] [--cursor] [--cowork]` | install the agent skill |
| `idm update` | self-update to the latest release |

Global flag `--json` on `compile` / `validate` / `render` / `auth` / `library` emits machine-readable output.

## Scene format

The 30-second version: layers render bottom-first; times are seconds; colors are hex; asset paths resolve relative to the scene file. Any `animate` channel is a keyframe list `{"t": sec, "v": value, "ease": "outCubic"}` baked by the tween engine into per-frame VASCO arrays. `position`/`scale`/`rotation`/`anchor` compose into the transform matrix. Effects (blur, shadow, glow, stroke, overlay, corner-pin), masks (rect/ellipse/path, animatable/morphable), track mattes, sub-comps, rich-text styles, and per-character text animators are all inline sugar — and anything else passes through as raw VASCO, so the full engine surface is reachable.

**Full reference:** [skills/idm-maker/references/format.md](skills/idm-maker/references/format.md). Working examples in [examples/](examples/) (`idm compile examples/demo.json`).

## Built for

- **Coding agents** — Claude Code, Codex, Cursor, Cowork (see the skills above)
- **CI/CD pipelines** — templated video generation from data
- **Anyone authoring IDM** without After Effects

Agent-first by design: `--json` gives machine-readable results on stdout with structured errors on stderr; stable exit codes (`0` ok · `1` compile/schema · `2` missing file · `3` auth · `4` render timeout); non-interactive by default (with env credentials and `--library` set, nothing reads a TTY); self-describing via `idm schema`, which needs no auth or network.

## License

ISC © Idomoo. The bundled DejaVu font in `examples/assets/` ships under its own license (see `FONT-LICENSE.txt`).
