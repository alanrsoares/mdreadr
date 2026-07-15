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

Open a Document on launch: `bun run start -- /path/to/file.md`

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
