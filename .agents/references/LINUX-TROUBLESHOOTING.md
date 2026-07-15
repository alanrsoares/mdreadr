# Linux troubleshooting (mdreadr + Electrobun)

Session-derived runbook. Agents: start with [mdreadr-linux skill](../skills/mdreadr-linux/SKILL.md).

## Environment

| Variable | When to set |
|----------|-------------|
| `GDK_BACKEND=x11` | Wayland session + WebKit GL crashes (`GLXBadWindow`, exit 133) |
| `WEBKIT_DISABLE_DMABUF_RENDERER=1` | Fedora/NVIDIA WebKit rendering glitches |
| `LIBGL_ALWAYS_SOFTWARE=1` | Last resort — slow but stable |

These are baked into `bun run start` / `dev` in [`package.json`](../../package.json).

## Error → action

### `ERR_DLOPEN_FAILED` / `libayatana-appindicator3.so.1`

Electrobun native wrapper failed before window opens.

```bash
sudo dnf install libayatana-appindicator-gtk3
```

### `GLXBadWindow (code 170)` + `Child process terminated by signal: 5`

API may start (`mdreadr API listening on …`) then WebKit dies. Common on **Wayland**.

1. Use project scripts (X11 backend already set)
2. Run from a **native terminal**, not Cursor integrated terminal
3. Escalate: `LIBGL_ALWAYS_SOFTWARE=1`

### `InvalidInstaller` running `build/.../bin/launcher`

Wrong artifact — use the Setup tarball installer, not the dev bundle launcher.

### `asar_read_file failed … views/mainview/index.html`

Dev Electrobun bundle without Vite. Ensure:

```bash
bun run dev:hmr   # not bare electrobun dev without :5173
```

Or run `vite build` + stable `bun run build` for bundled views.

### dnf blocked / hung (Cursor AppImage)

Cursor mounts at `/tmp/.mount_cursor*`. Package installs from Cursor terminal can stall.

- Run `sudo dnf install …` outside Cursor
- Or: `sudo systemctl stop packagekit`
- Or: quit Cursor, install, reopen

## Fedora package map

| Ubuntu (Electrobun docs) | Fedora |
|--------------------------|--------|
| `libayatana-appindicator3-dev` | `libayatana-appindicator-gtk3` |
| `libwebkit2gtk-4.1-dev` | `webkit2gtk4.1` (+ devel for building Electrobun itself) |
| `zenity` | `zenity` |

## Build artifacts

| Path | Purpose |
|------|---------|
| `artifacts/stable-linux-x64-mdreadr-Setup.tar.gz` | End-user installer |
| `artifacts/stable-linux-x64-mdreadr.tar.zst` | Update bundle |
| `build/dev-linux-x64/mdreadr-dev/` | Dev bundle (local iteration) |
