#!/bin/sh
# mdreadr installer — fetches the right build from GitHub release assets.
#
#   curl -fsSL https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
#   wget -qO-  https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
#
# Options (env vars):
#   MDREADR_VERSION      install a specific tag (e.g. v0.1.0); default: latest release
#   MDREADR_INSTALL_DIR  macOS: .app destination (default /Applications, falls back
#                        to ~/Applications); Linux: bundle dir for the tarball path
#                        (default ~/.local/opt/mdreadr)
#   MDREADR_BIN_DIR      Linux: where the launcher/AppImage lands (default ~/.local/bin)
set -eu

REPO="alanrsoares/mdreadr"
APP="mdreadr"
CHANNEL="stable"

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- downloader (curl or wget) -----------------------------------------------
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1"; }
  fetch_to() { curl -fsSL -o "$2" "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO- "$1"; }
  fetch_to() { wget -qO "$2" "$1"; }
else
  fail "need curl or wget"
fi

# --- platform detection ------------------------------------------------------
case "$(uname -s)" in
  Darwin) OS="macos" ;;
  Linux) OS="linux" ;;
  *) fail "unsupported OS: $(uname -s) (mdreadr ships macOS and Linux builds)" ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) ARCH="x64" ;;
  arm64 | aarch64) ARCH="arm64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

PREFIX="${CHANNEL}-${OS}-${ARCH}"

# --- release lookup ----------------------------------------------------------
# MDREADR_API_URL overrides the release endpoint (testing/mirrors).
if [ -n "${MDREADR_API_URL:-}" ]; then
  API_URL="$MDREADR_API_URL"
elif [ -n "${MDREADR_VERSION:-}" ]; then
  API_URL="https://api.github.com/repos/${REPO}/releases/tags/${MDREADR_VERSION}"
else
  API_URL="https://api.github.com/repos/${REPO}/releases/latest"
fi

say "» looking up release (${MDREADR_VERSION:-latest})…"
RELEASE_JSON=$(fetch "$API_URL") ||
  fail "no published release found. Note: CI creates draft releases — publish one on
       https://github.com/${REPO}/releases first (drafts are invisible to this installer)."

# Asset URLs for this platform, one per line. No jq dependency: match the
# browser_download_url lines and strip the JSON around them.
assets_for_platform() {
  printf '%s\n' "$RELEASE_JSON" |
    grep -o "\"browser_download_url\"[^\"]*\"[^\"]*\"" |
    sed 's/.*"\(http[^"]*\)"/\1/' |
    grep "/${PREFIX}-" || true
}

ASSETS=$(assets_for_platform)
[ -n "$ASSETS" ] || fail "this release has no ${OS}-${ARCH} build.
       CI currently builds macos-arm64 and linux-x64."

pick_asset() { printf '%s\n' "$ASSETS" | grep "$1\$" | head -n 1 || true; }

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mdreadr-install.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

# --- macOS: prefer the DMG (hdiutil is always available; zstd is not) --------
install_macos() {
  DEST="${MDREADR_INSTALL_DIR:-/Applications}"
  if [ ! -w "$DEST" ]; then
    DEST="$HOME/Applications"
    mkdir -p "$DEST"
  fi

  DMG_URL=$(pick_asset ".dmg")
  if [ -n "$DMG_URL" ]; then
    say "» downloading $(basename "$DMG_URL")…"
    fetch_to "$DMG_URL" "$TMP_DIR/$APP.dmg"
    MOUNT_DIR="$TMP_DIR/mnt"
    mkdir -p "$MOUNT_DIR"
    say "» mounting DMG…"
    hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT_DIR" "$TMP_DIR/$APP.dmg"
    # Expand TMP paths now, not at trap time.
    # shellcheck disable=SC2064
    trap "hdiutil detach -quiet '$MOUNT_DIR' 2>/dev/null || true; rm -rf '$TMP_DIR'" EXIT INT TERM
    APP_BUNDLE=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -n 1)
    [ -n "$APP_BUNDLE" ] || fail "no .app inside the DMG"
    say "» installing $(basename "$APP_BUNDLE") into ${DEST}…"
    rm -rf "${DEST:?}/$(basename "$APP_BUNDLE")"
    cp -R "$APP_BUNDLE" "$DEST/"
    hdiutil detach -quiet "$MOUNT_DIR"
    trap 'rm -rf "$TMP_DIR"' EXIT INT TERM
    say "✓ installed: $DEST/$(basename "$APP_BUNDLE")"
    return
  fi

  TAR_URL=$(pick_asset ".app.tar.zst")
  [ -n "$TAR_URL" ] || fail "release has neither a .dmg nor an .app.tar.zst for ${PREFIX}"
  command -v zstd >/dev/null 2>&1 || fail "the .app.tar.zst fallback needs zstd (brew install zstd)"
  say "» downloading $(basename "$TAR_URL")…"
  fetch_to "$TAR_URL" "$TMP_DIR/$APP.app.tar.zst"
  zstd -d -q "$TMP_DIR/$APP.app.tar.zst" -o "$TMP_DIR/$APP.app.tar"
  tar -xf "$TMP_DIR/$APP.app.tar" -C "$TMP_DIR"
  APP_BUNDLE=$(find "$TMP_DIR" -maxdepth 2 -name "*.app" | head -n 1)
  [ -n "$APP_BUNDLE" ] || fail "no .app inside the tarball"
  say "» installing $(basename "$APP_BUNDLE") into ${DEST}…"
  rm -rf "${DEST:?}/$(basename "$APP_BUNDLE")"
  cp -R "$APP_BUNDLE" "$DEST/"
  say "✓ installed: $DEST/$(basename "$APP_BUNDLE")"
}

# --- Linux: prefer the AppImage (single self-contained executable) -----------
install_linux() {
  BIN_DIR="${MDREADR_BIN_DIR:-$HOME/.local/bin}"
  mkdir -p "$BIN_DIR"

  APPIMAGE_URL=$(pick_asset ".AppImage")
  if [ -n "$APPIMAGE_URL" ]; then
    say "» downloading $(basename "$APPIMAGE_URL")…"
    fetch_to "$APPIMAGE_URL" "$BIN_DIR/$APP"
    chmod +x "$BIN_DIR/$APP"
    say "✓ installed: $BIN_DIR/$APP"
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *) say "note: $BIN_DIR is not on your PATH" ;;
    esac
    return
  fi

  TAR_URL=$(pick_asset ".tar.zst")
  [ -n "$TAR_URL" ] || fail "release has neither an .AppImage nor a .tar.zst for ${PREFIX}"
  command -v zstd >/dev/null 2>&1 || fail "the .tar.zst fallback needs zstd (apt install zstd)"
  OPT_DIR="${MDREADR_INSTALL_DIR:-$HOME/.local/opt/$APP}"
  say "» downloading $(basename "$TAR_URL")…"
  fetch_to "$TAR_URL" "$TMP_DIR/$APP.tar.zst"
  zstd -d -q "$TMP_DIR/$APP.tar.zst" -o "$TMP_DIR/$APP.tar"
  rm -rf "$OPT_DIR"
  mkdir -p "$OPT_DIR"
  tar -xf "$TMP_DIR/$APP.tar" -C "$OPT_DIR"
  LAUNCHER=$(find "$OPT_DIR" -type f -name "$APP" -perm -u+x | head -n 1)
  [ -n "$LAUNCHER" ] || fail "could not find the $APP launcher inside the bundle at $OPT_DIR"
  ln -sf "$LAUNCHER" "$BIN_DIR/$APP"
  say "✓ installed: $OPT_DIR (launcher: $BIN_DIR/$APP)"
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) say "note: $BIN_DIR is not on your PATH" ;;
  esac
}

say "» platform: ${OS}-${ARCH}"
if [ "$OS" = "macos" ]; then
  install_macos
else
  install_linux
fi
