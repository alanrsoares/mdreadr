#!/bin/sh
# mdreadr installer — fetches the right build from GitHub release assets.
#
#   curl -fsSL https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
#   wget -qO-  https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
#
# While the repo is private, authenticate with a token first:
#   GITHUB_TOKEN=$(gh auth token) sh install.sh
#
# Options (env vars):
#   GITHUB_TOKEN / GH_TOKEN  auth for private repos / rate limits
#   MDREADR_VERSION      install a specific tag (e.g. v0.1.0); default: latest release
#   MDREADR_INSTALL_DIR  macOS: .app destination (default /Applications, falls back
#                        to ~/Applications); Linux: bundle dir for the tar.zst path
#                        (default ~/.local/opt/mdreadr)
#   MDREADR_BIN_DIR      Linux: where the launcher/AppImage lands (default ~/.local/bin)
set -eu

REPO="alanrsoares/mdreadr"
APP="mdreadr"
CHANNEL="stable"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- downloader (curl or wget) -----------------------------------------------
if command -v curl >/dev/null 2>&1; then
  HTTP=curl
elif command -v wget >/dev/null 2>&1; then
  HTTP=wget
else
  fail "need curl or wget"
fi

# fetch <url>: print body. fetch_asset <ref> <out>: download a release asset —
# with a token the ref is an API asset URL and needs the octet-stream Accept.
fetch() {
  if [ "$HTTP" = curl ]; then
    if [ -n "$TOKEN" ]; then
      curl -fsSL -H "Authorization: Bearer $TOKEN" "$1"
    else
      curl -fsSL "$1"
    fi
  else
    if [ -n "$TOKEN" ]; then
      wget -qO- --header="Authorization: Bearer $TOKEN" "$1"
    else
      wget -qO- "$1"
    fi
  fi
}

fetch_asset() {
  if [ "$HTTP" = curl ]; then
    if [ -n "$TOKEN" ]; then
      curl -fsSL -H "Authorization: Bearer $TOKEN" -H "Accept: application/octet-stream" -o "$2" "$1"
    else
      curl -fsSL -o "$2" "$1"
    fi
  else
    if [ -n "$TOKEN" ]; then
      wget -qO "$2" --header="Authorization: Bearer $TOKEN" --header="Accept: application/octet-stream" "$1"
    else
      wget -qO "$2" "$1"
    fi
  fi
}

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
  fail "no release found. If the repo is private, pass a token:
       GITHUB_TOKEN=\$(gh auth token) sh install.sh
       Also note: draft releases are invisible — publish one first."

# One "<name>\t<download-ref>" line per asset for this platform.
# With a token: pair each asset's API url with its name (browser URLs 404 on
# private repos). Without: derive the name from the public browser URL.
list_assets() {
  if [ -n "$TOKEN" ]; then
    printf '%s\n' "$RELEASE_JSON" |
      tr ',' '\n' |
      grep -oE '"(url|name)" *: *"[^"]*"' |
      awk -F'"' '
        $2 == "url" && $4 ~ /\/releases\/assets\// { u = $4; next }
        $2 == "name" && u != "" { print $4 "\t" u; u = "" }
      '
  else
    printf '%s\n' "$RELEASE_JSON" |
      grep -oE '"browser_download_url" *: *"http[^"]*"' |
      sed 's/.*"\(http[^"]*\)"/\1/' |
      awk -F/ '{ print $NF "\t" $0 }'
  fi
}

ASSETS=$(list_assets | grep "^${PREFIX}-" || true)
[ -n "$ASSETS" ] || fail "this release has no ${OS}-${ARCH} build.
       CI currently builds macos-arm64 and linux-x64."

# pick_asset <name-suffix>: print the download ref, empty when absent.
pick_asset() {
  printf '%s\n' "$ASSETS" | awk -F'\t' -v suffix="$1" '
    index($1, suffix) == length($1) - length(suffix) + 1 { print $2; exit }
  '
}

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mdreadr-install.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

# --- macOS: prefer the DMG (hdiutil is always available; zstd is not) --------
install_macos() {
  DEST="${MDREADR_INSTALL_DIR:-/Applications}"
  if [ ! -w "$DEST" ]; then
    DEST="$HOME/Applications"
    mkdir -p "$DEST"
  fi

  DMG_REF=$(pick_asset ".dmg")
  if [ -n "$DMG_REF" ]; then
    say "» downloading ${APP}.dmg…"
    fetch_asset "$DMG_REF" "$TMP_DIR/$APP.dmg"
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

  TAR_REF=$(pick_asset ".app.tar.zst")
  [ -n "$TAR_REF" ] || fail "release has neither a .dmg nor an .app.tar.zst for ${PREFIX}"
  command -v zstd >/dev/null 2>&1 || fail "the .app.tar.zst fallback needs zstd (brew install zstd)"
  say "» downloading ${APP}.app.tar.zst…"
  fetch_asset "$TAR_REF" "$TMP_DIR/$APP.app.tar.zst"
  zstd -d -q "$TMP_DIR/$APP.app.tar.zst" -o "$TMP_DIR/$APP.app.tar"
  tar -xf "$TMP_DIR/$APP.app.tar" -C "$TMP_DIR"
  APP_BUNDLE=$(find "$TMP_DIR" -maxdepth 2 -name "*.app" | head -n 1)
  [ -n "$APP_BUNDLE" ] || fail "no .app inside the tarball"
  say "» installing $(basename "$APP_BUNDLE") into ${DEST}…"
  rm -rf "${DEST:?}/$(basename "$APP_BUNDLE")"
  cp -R "$APP_BUNDLE" "$DEST/"
  say "✓ installed: $DEST/$(basename "$APP_BUNDLE")"
}

# --- Linux ---------------------------------------------------------------------
# Preference order:
#   1. -Setup.tar.gz — electrobun's self-extracting installer (extracts to
#      ~/.local/share and creates a desktop entry with the app icon)
#   2. .AppImage — single-file executable straight into MDREADR_BIN_DIR
#   3. .tar.zst — raw bundle; extract and symlink the launcher
install_linux() {
  BIN_DIR="${MDREADR_BIN_DIR:-$HOME/.local/bin}"

  path_hint() {
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *) say "note: $BIN_DIR is not on your PATH" ;;
    esac
  }

  SETUP_REF=$(pick_asset "-Setup.tar.gz")
  if [ -n "$SETUP_REF" ]; then
    say "» downloading ${APP} installer…"
    fetch_asset "$SETUP_REF" "$TMP_DIR/setup.tar.gz"
    tar -xzf "$TMP_DIR/setup.tar.gz" -C "$TMP_DIR"
    [ -f "$TMP_DIR/installer" ] || fail "Setup archive has no 'installer' binary"
    chmod +x "$TMP_DIR/installer"
    say "» running the ${APP} installer (extracts to ~/.local/share, adds a desktop entry)…"
    (cd "$TMP_DIR" && ./installer)
    say "✓ installed via the ${APP} installer"
    return
  fi

  APPIMAGE_REF=$(pick_asset ".AppImage")
  if [ -n "$APPIMAGE_REF" ]; then
    mkdir -p "$BIN_DIR"
    say "» downloading AppImage…"
    fetch_asset "$APPIMAGE_REF" "$BIN_DIR/$APP"
    chmod +x "$BIN_DIR/$APP"
    say "✓ installed: $BIN_DIR/$APP"
    path_hint
    return
  fi

  TAR_REF=$(pick_asset ".tar.zst")
  [ -n "$TAR_REF" ] || fail "release has no -Setup.tar.gz, .AppImage, or .tar.zst for ${PREFIX}"
  command -v zstd >/dev/null 2>&1 || fail "the .tar.zst fallback needs zstd (apt install zstd)"
  OPT_DIR="${MDREADR_INSTALL_DIR:-$HOME/.local/opt/$APP}"
  mkdir -p "$BIN_DIR"
  say "» downloading ${APP}.tar.zst…"
  fetch_asset "$TAR_REF" "$TMP_DIR/$APP.tar.zst"
  zstd -d -q "$TMP_DIR/$APP.tar.zst" -o "$TMP_DIR/$APP.tar"
  rm -rf "$OPT_DIR"
  mkdir -p "$OPT_DIR"
  tar -xf "$TMP_DIR/$APP.tar" -C "$OPT_DIR"
  LAUNCHER=$(find "$OPT_DIR" -type f -name "$APP" -perm -u+x | head -n 1)
  [ -n "$LAUNCHER" ] || fail "could not find the $APP launcher inside the bundle at $OPT_DIR"
  ln -sf "$LAUNCHER" "$BIN_DIR/$APP"
  say "✓ installed: $OPT_DIR (launcher: $BIN_DIR/$APP)"
  path_hint
}

say "» platform: ${OS}-${ARCH}"
if [ "$OS" = "macos" ]; then
  install_macos
else
  install_linux
fi
