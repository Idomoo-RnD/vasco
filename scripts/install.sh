#!/usr/bin/env bash
# IDM CLI installer: npm-installs the CLI from this repo and installs the
# idm-maker agent skill into ~/.claude/skills.
#
#   curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash

set -euo pipefail

REPO="${IDM_CLI_REPO:-https://github.com/Idomoo-RnD/vasco.git}"

log() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js >= 18 is required (https://nodejs.org)"
command -v npm >/dev/null 2>&1 || fail "npm is required (ships with Node.js)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js >= 18 required, found $(node -v)"

log "Installing idm CLI from $REPO ..."
npm install -g "git+$REPO"

log "Installing the idm-maker agent skill into ~/.claude/skills ..."
idm skill install || log "(skill install skipped: $?)"

log ""
log "✅ idm $(idm version) installed."
log "Next steps:"
log "  idm init scene.json        # starter scene"
log "  idm compile scene.json     # compile locally"
log "  idm auth login             # add Idomoo credentials to render MP4s"
