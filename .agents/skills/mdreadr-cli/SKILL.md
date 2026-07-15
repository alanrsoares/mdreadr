---
name: mdreadr-cli
description: Run mdreadr dev, build, and toolchain commands (Electrobun, Vite, Biome, Astryx CLI). Use when starting the app, packaging, linting, or looking up project scripts.
---

# mdreadr CLI & dev workflow

## Milestone gate (always)

```bash
bun run check
```

Runs: `biome ci --error-on-warnings` → `tsc --noEmit` → `bun test`

## Daily development

```bash
bun install
bun run dev:hmr    # Vite :5173 + Electrobun (preferred)
# or
bun run start      # one-shot webview build + electrobun dev
```

Open with a file:

```bash
bun run start -- /path/to/doc.md
```

## Build & package

```bash
bun run build      # vite build → electrobun build --env=stable
```

**Linux installer** (after build):

```bash
tar -xzf artifacts/stable-linux-x64-mdreadr-Setup.tar.gz -C /tmp/mdreadr-install
/tmp/mdreadr-install/installer
```

Do **not** run `build/.../bin/launcher` — that is the inner bundle, not the installer.

See [mdreadr-linux](mdreadr-linux/SKILL.md) for deps and troubleshooting.

## Lint & format

```bash
bun run lint       # check only
bun run lint:fix   # apply safe fixes + format
```

## Tersify (AST refactors)

[`@onrails/codemod`](https://www.npmjs.com/package/@onrails/codemod) `--tersify` applies terse syntax simplifications (implicit returns, guard → optional chain, object shorthands, etc.).

```bash
bun run tersify:dry   # preview changes
bun run tersify       # apply
bun run lint:fix      # required after tersify (Biome formatting)
```

Config: [`biome.json`](../../biome.json) — strict recommended preset, warnings fail in `check`.

## Electrobun

- Config: [`electrobun.config.ts`](../../electrobun.config.ts)
- Main entry: [`src/bun/index.ts`](../../src/bun/index.ts)
- Webview build output copied to `views://mainview/` from `dist/` (stable build)
- **Linux env** (in `start` / `dev` scripts): `GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1`
- Dev HMR: if `http://localhost:5173` responds, window loads Vite; else `views://` (often fails in **dev** bundle — keep Vite running)
- **ApplicationMenu**: skipped on Linux in `src/bun/index.ts`
- Dev bundle path: `build/dev-linux-x64/mdreadr-dev/`

## Vite (webview only)

- Config: [`vite.config.ts`](../../vite.config.ts)
- Root: `src/webview/`
- Aliases: `@mdreadr/domain`, `@mdreadr/api`, `@mdreadr/shared/constants`

Do not use Vite for the Elysia server.

## Astryx CLI

Requires `@astryxdesign/cli` (devDependency).

```bash
bunx astryx --help
bunx astryx component Button
bunx astryx docs theme
bunx astryx init              # if re-scaffolding theme setup
```

Theme CSS is imported in [`src/webview/main.tsx`](../../src/webview/main.tsx):

- `@astryxdesign/core/reset.css`
- `@astryxdesign/core/astryx.css`
- `@astryxdesign/theme-neutral/theme.css`

## Platform notes

- **Linux first** — see [mdreadr-linux](mdreadr-linux/SKILL.md) for Fedora deps, Wayland fixes, install
- File dialogs need `zenity` on PATH
- Config dir: `~/.config/mdreadr/` (recents list)

## Bun conventions

Use `bun`, `bun run`, `bun test`, `bunx` — not npm/npx. See [`CLAUDE.md`](../../CLAUDE.md).
