```text
▄▄ ▄▄▄▄   ▄▄▄  ▄▄   ▄▄  ▄▄▄   ▄▄▄    ▄▄ ▄▄  ▄▄▄   ▄▄▄▄  ▄▄▄▄  ▄▄▄
██ ██▀██ ██▀██ ██▀▄▀██ ██▀██ ██▀██   ██▄██ ██▀██ ███▄▄ ██▀▀▀ ██▀██
██ ████▀ ▀███▀ ██   ██ ▀███▀ ▀███▀    ▀█▀  ██▀██ ▄▄██▀ ▀████ ▀███▀
```

# IDM CLI

**Author Idomoo IDM videos from the command line.** A compact scene JSON — keyframe tweens, effects, masks, hex colors — compiles locally into a binary `.idm`, then renders to MP4 through the Idomoo API.

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

```bash
idm compile scene.json -o out.idm     # local, instant, schema-validated
idm render scene.json --library "My Library" -o out.mp4
```

## Built for

- **Coding agents** — Claude Code, Codex, and others (see [Agent skills](#agent-skills))
- **CI/CD pipelines** — templated video generation from data
- **Anyone authoring IDM** without After Effects

## Agent-first by design

- `--json` gives machine-readable results on stdout; errors are structured on stderr.
- Stable exit codes: `0` ok · `1` compile/schema · `2` missing file · `3` auth · `4` render timeout.
- Non-interactive by default: with env credentials and `--library` set, nothing reads a TTY.
- Self-describing: `idm schema` prints the full VASCO JSON Schema without auth or network.

## Install

**Single standalone binary — no runtime required.** macOS and Linux (amd64 + arm64):

```bash
curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.ps1 | iex
```

Both download the platform binary from [releases](https://github.com/Idomoo-RnD/vasco/releases), verify its checksum, install it (`~/.local/bin/idm` on Unix, `%LOCALAPPDATA%\Programs\idm\idm.exe` on Windows), then **ask where to install the agent skill** — Claude Code, OpenAI Codex, both, or skip. Non-interactive runs (CI) default to Claude Code (+ Codex when `~/.codex` exists); override with `IDM_SKILL=claude|codex|both|skip`.

From source instead (Node ≥ 18): `git clone` this repo, `npm install`, then `node bin/idm.mjs` — or `node scripts/build-sea.mjs` to produce your own binary.

## Updates

```bash
idm update               # self-update to the latest release
```

## Authenticate

Rendering needs an Idomoo **account id** and **secret key** (compiling is local and needs nothing).

**1. Environment variables** — agents, CI; ephemeral:

```bash
export IDOMOO_ACCOUNT_ID=1234
export IDOMOO_SECRET_KEY=your-secret
```

**2. `auth login`** — persists to `~/.idm/credentials`:

```bash
idm auth login --account 1234 --token your-secret    # non-interactive
idm auth login                                        # interactive prompts
```

Verify with `idm auth status`.

## Quick start

```bash
idm init scene.json            # starter scene (point "font" at a real .ttf)
idm compile scene.json         # -> scene.idm, schema-validated, prints a summary
idm library list               # pick (or invent) a library to upload into
idm render scene.json --library "Demos" -o scene.mp4
```

Shorthand: a bare `.json` argument means `compile`, a bare `.idm` means `inspect`:

```bash
idm scene.json
idm scene.idm                  # decode back to vasco JSON
```

## Commands

| command | what it does |
|---|---|
| `idm compile <scene.json> [-o out.idm] [--vasco]` | scene → `.idm`, schema-validated (`--vasco` dumps the compiled VASCO JSON) |
| `idm validate <scene.json> [--print]` | compile + schema-check only, no file written |
| `idm inspect <file.idm> [--assets <dir>]` | decode an `.idm` back to VASCO JSON, optionally extract embedded assets |
| `idm render <scene.json\|.idm> --library <name-or-id> [-o out.mp4] [--height] [--quality]` | upload, render, download the MP4 (interactive runs ask which library) |
| `idm library list` | list your Idomoo libraries |
| `idm init [scene.json]` | write a starter scene |
| `idm auth login \| status` | manage credentials |
| `idm schema` | print the VASCO JSON Schema |
| `idm skill install` | install the `idm-maker` agent skill into `~/.claude/skills` |
| `idm update` | reinstall the latest from this repo |

Global flag `--json` on `compile` / `validate` / `render` / `auth` / `library` emits machine-readable output.

## Scene format

The 30-second version: layers render bottom-first; times are seconds; colors are hex; asset paths resolve relative to the scene file. Any `animate` channel is a keyframe list `{"t": sec, "v": value, "ease": "outCubic"}` baked by the tween engine into per-frame VASCO arrays. `position`/`scale`/`rotation`/`anchor` compose into the transform matrix. Effects (blur, shadow, glow, stroke, overlay, corner-pin), masks (rect/ellipse/path, animatable/morphable), track mattes, sub-comps, rich-text styles, and per-character text animators are all inline sugar — and anything else passes through as raw VASCO, so the full engine surface is reachable.

**Full reference:** [skills/idm-maker/references/format.md](skills/idm-maker/references/format.md). Working examples in [examples/](examples/) (`idm compile examples/demo.json`).

## Agent skills

Two skills ship in this repo:

- **[SKILL.md](SKILL.md)** (repo root) — teaches an agent to drive this CLI.
- **[skills/idm-maker/](skills/idm-maker/)** — the full authoring skill: scene format, tween engine, effects, masks, render workflow.

### Claude Code

```bash
idm skill install            # -> ~/.claude/skills/idm-maker
```

(The install scripts already run this for you.) Then just ask Claude Code to *"make an idm of …"* — the skill triggers, writes the scene JSON, and drives `idm`. Manual alternative: copy `skills/idm-maker/` into `~/.claude/skills/`.

### OpenAI Codex

Codex reads the same SKILL.md format from `~/.codex/skills`:

```bash
idm skill install --codex    # -> ~/.codex/skills/idm-maker
```

(`idm skill install` with no flags installs for Claude Code, and for Codex too when a `~/.codex` directory exists.) Manual alternative: copy `skills/idm-maker/` into `~/.codex/skills/`.

### Other agents

Point the agent at [SKILL.md](SKILL.md) (CLI usage) and [skills/idm-maker/SKILL.md](skills/idm-maker/SKILL.md) (authoring guide) — they are plain markdown with no tooling assumptions.

## License

ISC © Idomoo. The bundled DejaVu font in `examples/assets/` ships under its own license (see `FONT-LICENSE.txt`).
