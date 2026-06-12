---
name: idm-cli
description: "Author Idomoo IDM videos from compact scene JSON via the `idm` CLI: compile scenes to .idm locally, validate against the VASCO schema, decode binaries, and render MP4s through the Idomoo API. Use when an agent needs to create IDM video templates, animate layers with keyframes, or automate Idomoo video production from the command line."
---

# IDM CLI

CLI for authoring Idomoo IDM videos. A compact scene JSON (keyframe tweens, inline effects/masks, hex colors) compiles locally into a binary `.idm`, schema-validated; `render` uploads it and returns an MP4.

- **Install**: `curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash` (or `npm install -g git+https://github.com/Idomoo-RnD/vasco.git`)
- **Auth**: `idm auth login --account <id> --token <secret>` or env `IDOMOO_ACCOUNT_ID` / `IDOMOO_SECRET_KEY`. Credentials are provisioned per Idomoo account.
- **Authoring guide**: the full scene format lives in the `idm-maker` skill (`idm skill install` puts it in `~/.claude/skills`), or read `skills/idm-maker/` in this repo.

## Key commands

```bash
idm init scene.json                          # starter scene to edit
idm compile scene.json -o out.idm            # scene -> .idm, schema-validated (alias: idm scene.json)
idm validate scene.json --json               # free pre-check, machine-readable
idm inspect out.idm                          # decode .idm back to vasco JSON (alias: idm out.idm)
idm library list --json                      # list Idomoo libraries — ASK THE USER which to use
idm render scene.json --library "<name>" -o out.mp4   # upload + render + download MP4
idm auth status --json                       # verify credentials
idm schema                                   # print the VASCO JSON Schema (no auth needed)
idm update                                   # reinstall latest from the repo
```

## Agent conventions

- `--json` puts a machine-readable result object on stdout; errors are JSON on stderr.
- Exit codes: `0` ok · `1` compile/schema error · `2` missing file/asset · `3` auth · `4` render timeout.
- Non-interactive by default: with credentials in env and `--library` passed, nothing reads a TTY.
- `render` REQUIRES a library choice. Run `idm library list`, ask the user which library to upload to (or a new name — it will be created). Never silently pick one.
- Renders take minutes; run them in the background. The result JSON includes `video_url` and `poster_url`.
- Asset paths in scenes resolve relative to the scene file; text layers require a local `.ttf`/`.otf`.
