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

Picks the right build from the latest GitHub release for your platform (macOS arm64 → `.app` into `/Applications`, Linux x64 → AppImage into `~/.local/bin`). Pin a version with `MDREADR_VERSION=v0.1.0`; see the header of [`install.sh`](install.sh) for all options.

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
