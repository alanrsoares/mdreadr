# AGENTS.md

> Unified context and instructions for AI agents working in **mdreadr**.  
> **This file overrides** global `alanstack` defaults where they conflict.

## 1. Project overview

**mdreadr** is a desktop markdown **Reader** with anchored **Notes** for human–agent review loops.

- **Product**: Read-only Documents; Notes are session Threads with Replies and status.
- **Domain language**: [`CONTEXT.md`](CONTEXT.md) — use those terms; do not invent synonyms.
- **Architecture**: Electrobun shell → React webview ↔ Elysia API (loopback) → domain + filesystem.
- **Runtime**: Bun only (no Node.js for execution).

Deep dives live under [`.agents/`](.agents/README.md).

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electrobun |
| Main | Bun (`src/bun/index.ts`) — window, starts Elysia |
| API | Elysia on `127.0.0.1` + Eden Treaty client |
| Domain | Zod-first schemas + `@onrails/result` / `@onrails/pattern` / `@onrails/maybe` |
| UI | React 19, Astryx (chrome), `@styled-cva/react` + Tailwind utilities (layout), TanStack Router + Query |
| Markdown | react-markdown, remark-gfm/math, rehype-katex, mermaid, GitHub alerts |
| Webview build | Vite |
| Lint / format | Biome (strict recommended; warnings fail CI) |
| Tests | `bun:test` |

Use `Bun.file`, `Bun.$` for IO. Do not add Express, Vite for the API, or TanStack Start. Bun loads `.env` automatically — no dotenv.

## 3. Repository layout

```
packages/domain/          # Zod schemas + pure domain (no React, Elysia, FS)
packages/api/             # Elysia app, session store, document/recents IO
src/bun/index.ts          # Electrobun entry — starts API, opens window
src/webview/              # React UI (Treaty client, pages, components)
shared/constants.ts       # App name, config paths, schema version
electrobun.config.ts      # Bundles dist/ → views://mainview
vite.config.ts            # Webview build; TS path aliases for @mdreadr/*
CONTEXT.md                # Domain glossary (not implementation)
```

**Boundary rules**

- Webview never reads the filesystem — all IO via Eden Treaty.
- `packages/domain` has no side effects; no imports from `api` or `webview`.
- Electrobun main bundles with **relative imports** (not `@mdreadr/*` aliases).
- Webview and tests may use `@mdreadr/domain` via Vite/tsconfig paths.

## 4. Operational commands

Use `bun` for everything.

| Command | Purpose |
|---------|---------|
| `bun run check` | **Milestone gate** — Biome CI + typecheck + tests |
| `bun run lint` | Biome check |
| `bun run lint:fix` | Biome check --write |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit tests |
| `bun run tersify:dry` | Preview `@onrails/codemod --tersify` |
| `bun run tersify` | Apply tersify refactors (then `lint:fix`) |
| `bun run dev:hmr` | Vite HMR + Electrobun |
| `bun run start` | Build webview + Electrobun dev |
| `bun run build` | Vite build + Electrobun Linux package |
| `bun run theme:build` | Compile `mdreadrTheme.ts` → static CSS/JS |
| `bun run astryx -- …` | Astryx CLI (`nvm use` first — see `.nvmrc`) |

Open a Document on launch: `bun run start -- /path/to/file.md`

**Astryx + AI**: Agent docs live in the `<!-- ASTRYX:START -->` block below. CLI via `bun run astryx` ([Working with AI](https://astryx.atmeta.com/docs/working-with-ai)). MCP: [`.cursor/mcp.json`](.cursor/mcp.json). After `@astryxdesign/*` bumps: `bun run astryx init --features agents --agent codex` and `bun run astryx upgrade --apply`.

**Linux**: `libayatana-appindicator-gtk3`, `zenity`; WebKit Wayland workarounds in `start` scripts. See [mdreadr-linux](.agents/skills/mdreadr-linux/SKILL.md).

See skill: [`.agents/skills/mdreadr-cli/SKILL.md`](.agents/skills/mdreadr-cli/SKILL.md)

## 5. Agent skills (read when relevant)

| Skill | Use when |
|-------|----------|
| [mdreadr-cli](.agents/skills/mdreadr-cli/SKILL.md) | Running dev/build, Electrobun, Vite, Astryx CLI |
| [mdreadr-domain](.agents/skills/mdreadr-domain/SKILL.md) | Notes, schemas, Onrails domain recipes |
| [mdreadr-api](.agents/skills/mdreadr-api/SKILL.md) | Elysia routes, Treaty, session, file IO |
| [mdreadr-ui](.agents/skills/mdreadr-ui/SKILL.md) | Astryx components, Reader layout, MarkdownView |
| [mdreadr-styling](.agents/skills/mdreadr-styling/SKILL.md) | `@styled-cva/react`, Tailwind utilities, Biome plugins |
| [mdreadr-linux](.agents/skills/mdreadr-linux/SKILL.md) | Fedora deps, Wayland/WebKit, install, launch failures |
| [mdreadr-check](.agents/skills/mdreadr-check/SKILL.md) | Verification before commit/PR |

References: [`.agents/references/RAILWAY.md`](.agents/references/RAILWAY.md), [`.agents/references/ARCHITECTURE.md`](.agents/references/ARCHITECTURE.md)

## 6. Coding standards

- **Errors**: `Result` / `ResultAsync` at IO and API boundaries; narrow with `isErr` / `isOk` (functions, not methods).
- **Unions**: `@onrails/pattern` `match` for owned tags (`NoteStatus`, `AuthorKind`, `DocumentError`).
- **Validation**: Zod at every external boundary (HTTP body, JSON files, env). Infer types with `z.infer`.
- **Type safety**: Strict TS; no `any`; no `@ts-ignore` without inline reason.
- **Throws**: Only inside `ResultAsync.fromPromise` wrappers at boundaries — not in domain logic.
- **Scope**: Minimal diffs; match neighboring code and Biome formatting (2 spaces, double quotes).
- **Security**: Never commit secrets; loopback-only API in v1.

Run `bun run check` after every milestone before claiming done.

## 7. Testing

- Runner: `bun:test` only.
- `packages/domain/domain.test.ts` — pure domain + markdown helpers.
- `packages/api/api.test.ts` — Elysia routes via `app.handle()`.
- Colocate new specs as `*.test.ts` beside the module under test.

## 8. Git & commits

- Conventional commits with scope: `feat(ui): …`, `fix(api): …`, `chore(repo): …`
- Subject ≤ 50 chars, imperative mood.
- No AI attribution or co-author trailers.
- Do not commit unless explicitly asked.

**Scopes**: `api`, `domain`, `ui`, `shell`, `repo`

<!-- ASTRYX:START -->
Astryx v0.1.5 · 149 components
CLI: run every command as `bun run astryx -- <cmd>` (shown below as `astryx ...`). Requires Node ≥22 — `nvm use` (`.nvmrc`).

SETUP (mdreadr — see main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";
  import "./app/theme/mdreadr.css";
  Theme + mdreadrTheme from ./app/theme/mdreadr.js (run `bun run theme:build` after editing mdreadrTheme.ts)

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   149 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

### mdreadr + Astryx exceptions

- **Reader layout** uses `@styled-cva/react` for panels/prose shells — not raw `<div>` for new UI, but existing `tw.*` layout in [`layout.tsx`](src/webview/app/ui/layout.tsx) is intentional. See [mdreadr-styling](.agents/skills/mdreadr-styling/SKILL.md).
- **Markdown** uses `@astryxdesign/core/Markdown`, not generic markdown libraries.
