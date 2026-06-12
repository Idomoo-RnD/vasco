#!/usr/bin/env bash
# IDM CLI installer — downloads the standalone binary for this platform from
# GitHub releases, verifies its checksum, installs to ~/.local/bin, and installs
# the idm-maker agent skill.
#
#   curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash
#
# Options (env vars):
#   INSTALL_DIR   target directory (default ~/.local/bin)
#   IDM_VERSION   tag to install, e.g. v1.0.0 (default: latest)
#   IDM_SKILL     claude | codex | both | skip | auto  (default: ask when on a TTY, else auto)

set -euo pipefail

REPO="Idomoo-RnD/vasco"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${IDM_VERSION:-latest}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

detect_os() {
  case "$(uname -s)" in
    Linux) printf 'linux' ;;
    Darwin) printf 'darwin' ;;
    *) fail "unsupported OS: $(uname -s). On Windows use scripts/install.ps1." ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) printf 'amd64' ;;
    arm64 | aarch64) printf 'arm64' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

checksum_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then printf 'sha256sum'
  elif command -v shasum >/dev/null 2>&1; then printf 'shasum -a 256'
  else fail "missing sha256 tool (need sha256sum or shasum)"
  fi
}

fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
  else fail "need curl or wget"
  fi
}

OS="$(detect_os)"
ARCH="$(detect_arch)"
ASSET="idm_${OS}_${ARCH}"

if [ "$VERSION" = "latest" ]; then
  BASE="https://github.com/$REPO/releases/latest/download"
else
  BASE="https://github.com/$REPO/releases/download/$VERSION"
fi

log "Downloading $ASSET ($VERSION) ..."
fetch "$BASE/$ASSET" "$TMP/$ASSET"
fetch "$BASE/checksums.txt" "$TMP/checksums.txt"

(cd "$TMP" && grep " $ASSET\$" checksums.txt | $(checksum_cmd) -c - >/dev/null) \
  || fail "checksum verification failed"
log "Checksum OK."

mkdir -p "$INSTALL_DIR"
install -m 755 "$TMP/$ASSET" "$INSTALL_DIR/idm"
log "Installed $INSTALL_DIR/idm ($("$INSTALL_DIR/idm" version))"

# --- agent skill -------------------------------------------------------------
# When piped through `curl | bash`, stdin is the script — prompt via /dev/tty.
SKILL_CHOICE="${IDM_SKILL:-}"
if [ -z "$SKILL_CHOICE" ]; then
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    log ""
    log "Install the idm-maker agent skill?"
    log "  1) Claude Code   (~/.claude/skills)"
    log "  2) OpenAI Codex  (~/.codex/skills)"
    log "  3) Both"
    log "  4) Skip"
    printf 'Choice [1]: ' > /dev/tty
    read -r answer < /dev/tty || answer=""
    case "$answer" in
      2) SKILL_CHOICE="codex" ;;
      3) SKILL_CHOICE="both" ;;
      4) SKILL_CHOICE="skip" ;;
      *) SKILL_CHOICE="claude" ;;
    esac
  else
    SKILL_CHOICE="auto"   # non-interactive: Claude Code (+ Codex when ~/.codex exists)
  fi
fi

case "$SKILL_CHOICE" in
  claude) "$INSTALL_DIR/idm" skill install --claude || log "(skill install skipped — rerun with: idm skill install)" ;;
  codex)  "$INSTALL_DIR/idm" skill install --codex  || log "(skill install skipped — rerun with: idm skill install --codex)" ;;
  both)   "$INSTALL_DIR/idm" skill install --claude --codex || log "(skill install skipped — rerun with: idm skill install --claude --codex)" ;;
  skip)   log "Skipped skill install (rerun anytime with: idm skill install)" ;;
  *)      "$INSTALL_DIR/idm" skill install || log "(skill install skipped — rerun with: idm skill install)" ;;
esac

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) log ""; log "NOTE: $INSTALL_DIR is not on your PATH. Add it, e.g.:"
     log "  export PATH=\"\$PATH:$INSTALL_DIR\"" ;;
esac

log ""
log "Next steps:"
log "  idm init scene.json        # starter scene"
log "  idm compile scene.json     # compile locally"
log "  idm auth login             # add Idomoo credentials to render MP4s"
