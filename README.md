# mdreadr

A desktop markdown Reader for reviewing Documents with agent-human feedback Notes.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
```

or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/alanrsoares/mdreadr/main/install.sh | sh
```

Picks the right build from the latest GitHub release for your platform (macOS → `.app` into `/Applications`, Linux x64 → electrobun's self-extracting installer with a desktop entry). Pin a version with `MDREADR_VERSION=v0.1.0`; see the header of [`install.sh`](install.sh) for all options.

### macOS: the builds are unsigned

mdreadr is not codesigned or notarized (no Apple Developer account behind it). The installer handles the fallout for you — it clears the `com.apple.quarantine` attribute and applies a local ad-hoc signature so the app launches.

If you instead download the `.dmg` by hand from the releases page, Gatekeeper will block it. Undo that yourself:

```bash
xattr -dr com.apple.quarantine /Applications/mdreadr.app
codesign --force --deep --sign - /Applications/mdreadr.app
```

### Updates

mdreadr checks for updates on launch and notifies you when one is available; **mdreadr → Check for Updates…** downloads and installs on demand. Updates are pulled from this repo's latest GitHub release, so no re-run of the installer is needed.

### Linux: runtime dependencies

The bundle links against the system WebKitGTK stack and shells out to `zenity` for open/save dialogs:

```bash
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0 zenity   # Debian/Ubuntu
sudo dnf install gtk3 webkit2gtk4.1 zenity               # Fedora
sudo pacman -S gtk3 webkit2gtk-4.1 zenity                # Arch
```

The installer warns when these look missing but does not install them.

## Stack

- Electrobun + Bun main process
- React + Astryx webview
- Elysia API + Eden Treaty client
- Zod-first domain with Onrails (`@onrails/result`, `@onrails/pattern`, `@onrails/maybe`)

## Develop

```bash
bun install
bun run dev:hmr
```

Or without HMR:

```bash
bun run start
```

Open a document on launch:

```bash
bun run start -- /path/to/file.md
```

## Test & typecheck

```bash
bun check
```

Runs Biome (strict recommended, warnings as errors), TypeScript, and tests.

```bash
bun test
bun run typecheck
bun run lint
bun run lint:fix
```

## Build (Linux + macOS)

```bash
bun run build
```

Native open/save dialogs use `zenity` on Linux (install it via your package manager) and `osascript` on macOS (built in).

## License

[MIT](LICENSE)
