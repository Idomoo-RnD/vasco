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

"$INSTALL_DIR/idm" skill install || log "(skill install skipped — rerun later with: idm skill install)"

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
