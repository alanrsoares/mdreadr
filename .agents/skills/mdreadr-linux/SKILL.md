---
name: mdreadr-linux
description: Run and troubleshoot mdreadr on Linux (Fedora, Wayland, Electrobun/WebKit). Use when the app fails to launch, native dialogs break, dnf is blocked, or packaging/installing the Linux build.
---

# mdreadr on Linux (Fedora first)

## System packages (install once)

```bash
sudo dnf install libayatana-appindicator-gtk3 zenity webkit2gtk4.1 gtk3
```

| Package | Why |
|---------|-----|
| `libayatana-appindicator-gtk3` | Electrobun `libNativeWrapper.so` — **required** or `dlopen` fails |
| `zenity` | Native open/save dialogs (`Bun.$` in `packages/api/documents.ts`) |
| `webkit2gtk4.1` / `gtk3` | WebKit GTK shell (usually already present) |

Verify native wrapper deps:

```bash
ldd build/dev-linux-x64/mdreadr-dev/bin/libNativeWrapper.so | rg 'not found'
```

## Run dev

Scripts already set WebKit env for Wayland:

```bash
bun run dev:hmr    # preferred — Vite :5173 + Electrobun
```

`start` / `dev` inject: `GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1`

### Webview URL in dev

[`src/bun/index.ts`](../../src/bun/index.ts) probes `http://localhost:5173`:

- **Vite up** → loads HMR dev server
- **Vite down** → falls back to `views://mainview/…` (often **missing in dev bundle** → blank window)

Wait for `VITE … ready` before expecting UI. With `dev:hmr`, restart Electrobun if it beat Vite to the punch.

## Install production build

```bash
bun run build
mkdir -p /tmp/mdreadr-install
tar -xzf artifacts/stable-linux-x64-mdreadr-Setup.tar.gz -C /tmp/mdreadr-install
/tmp/mdreadr-install/installer
```

Installer extracts to `~/.local/share/` and adds a desktop shortcut.

**Do not** run `build/.../bin/launcher` directly — that is the inner bundle, not the self-extracting installer.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `libayatana-appindicator3.so.1: cannot open shared object` | `sudo dnf install libayatana-appindicator-gtk3` |
| `GLXBadWindow` then exit **133** (signal 5) | Wayland + WebKit GL crash — use `GDK_BACKEND=x11` (in `start` script) or run from system terminal |
| Still crashes on Wayland/NVIDIA | `LIBGL_ALWAYS_SOFTWARE=1 GDK_BACKEND=x11 bun run dev:hmr` |
| `views/mainview/index.html` FileNotFound | Start Vite (`bun run hmr`) or use `dev:hmr` after Vite is ready |
| `dnf install` hangs in Cursor | Cursor AppImage FUSE mount — run `sudo dnf` in **Konsole/GNOME Terminal**, or quit Cursor first |
| dnf "locked" | `sudo systemctl stop packagekit`; check no other `dnf`/`rpm` running |

## Shell conventions (Linux)

- **No `ApplicationMenu`** on Linux — skipped in `src/bun/index.ts`; menus belong in webview HTML
- Electrobun logs *"Application menus are not supported on Linux"* — expected
- Config/recents: `~/.config/mdreadr/recents.json`

See also: [mdreadr-cli](../mdreadr-cli/SKILL.md), [LINUX-TROUBLESHOOTING.md](../../references/LINUX-TROUBLESHOOTING.md)
