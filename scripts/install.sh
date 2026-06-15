#!/usr/bin/env bash
# Strata CLI installer — downloads the standalone binary for this platform from
# GitHub releases, verifies its checksum, installs to ~/.local/bin, and installs
# the strata-cli agent skill.
#
#   curl -fsSL https://raw.githubusercontent.com/Idomoo-RnD/vasco/main/scripts/install.sh | bash
#
# Options (env vars):
#   INSTALL_DIR   target directory (default ~/.local/bin)
#   STRATA_VERSION   tag to install, e.g. v1.0.0 (default: latest)
#   STRATA_SKILL     claude | codex | both | skip | auto  (default: ask when on a TTY, else auto)

set -euo pipefail

REPO="Idomoo-RnD/vasco"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${STRATA_VERSION:-latest}"
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
ASSET="strata_${OS}_${ARCH}"

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
install -m 755 "$TMP/$ASSET" "$INSTALL_DIR/strata"
log "Installed $INSTALL_DIR/strata ($("$INSTALL_DIR/strata" version))"

# --- agent skill -------------------------------------------------------------
# When piped through `curl | bash`, stdin is the script — prompt via /dev/tty.
SKILL_CHOICE="${STRATA_SKILL:-}"
if [ -z "$SKILL_CHOICE" ]; then
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    log ""
    log "Install the strata-cli agent skill? (multiple allowed, e.g. 1,3)"
    log "  1) Claude Code    (~/.claude/skills)"
    log "  2) OpenAI Codex   (~/.codex/skills)"
    log "  3) Cursor         (~/.cursor/skills + project .cursor/skills)"
    log "  4) Antigravity    (IDE ~/.agents/skills + CLI ~/.gemini/antigravity-cli/skills)"
    log "  5) Claude Cowork  (packages strata-cli-skill.zip to upload in the app)"
    log "  6) All of the above"
    log "  7) Skip"
    printf 'Choice [1]: ' > /dev/tty
    read -r SKILL_CHOICE < /dev/tty || SKILL_CHOICE=""
    [ -n "$SKILL_CHOICE" ] || SKILL_CHOICE="1"
  else
    SKILL_CHOICE="auto"   # non-interactive: Claude Code (+ others when their dirs exist)
  fi
fi

FLAGS=""
case ",$SKILL_CHOICE," in *,7,*|*skip*) FLAGS="skip" ;; esac
if [ "$FLAGS" != "skip" ]; then
  case ",$SKILL_CHOICE," in *,1,*|*claude*)      FLAGS="$FLAGS --claude" ;; esac
  case ",$SKILL_CHOICE," in *,2,*|*codex*)       FLAGS="$FLAGS --codex"  ;; esac
  case ",$SKILL_CHOICE," in *,3,*|*cursor*)      FLAGS="$FLAGS --cursor" ;; esac
  case ",$SKILL_CHOICE," in *,4,*|*antigravity*) FLAGS="$FLAGS --antigravity" ;; esac
  case ",$SKILL_CHOICE," in *,5,*|*cowork*)      FLAGS="$FLAGS --cowork" ;; esac
  case ",$SKILL_CHOICE," in *,6,*|*all*)         FLAGS=" --claude --codex --cursor --antigravity --cowork" ;; esac
  case ",$SKILL_CHOICE," in *both*)              FLAGS=" --claude --codex" ;; esac
fi

if [ "$FLAGS" = "skip" ]; then
  log "Skipped skill install (rerun anytime with: strata skill install)"
elif [ -n "$FLAGS" ]; then
  # shellcheck disable=SC2086
  "$INSTALL_DIR/strata" skill install $FLAGS || log "(skill install skipped — rerun with: strata skill install$FLAGS)"
else
  "$INSTALL_DIR/strata" skill install || log "(skill install skipped — rerun with: strata skill install)"
fi

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) log ""; log "NOTE: $INSTALL_DIR is not on your PATH. Add it, e.g.:"
     log "  export PATH=\"\$PATH:$INSTALL_DIR\"" ;;
esac

log ""
log "Next steps:"
log "  strata init scene.json        # starter scene"
log "  strata compile scene.json     # compile locally"
log "  strata auth login             # add Idomoo credentials to render MP4s"
