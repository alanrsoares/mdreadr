# mdreadr architecture

## Processes

```
Electrobun main (src/bun/index.ts)
  ├── startServer() → Elysia on 127.0.0.1:<ephemeral-port>
  └── BrowserWindow → webview URL with ?api=http://127.0.0.1:<port>

React webview (src/webview/)
  └── Eden Treaty → same Elysia API (loopback HTTP)
```

Electrobun does **not** own app business logic. The webview does **not** touch the filesystem.

## Packages

| Package | Responsibility | Must not import |
|---------|----------------|---------------|
| `packages/domain` | Zod schemas, pure Note/markdown transforms | `api`, `webview`, `elysia`, `react` |
| `packages/api` | HTTP routes, session store, `Bun.file` / `Bun.$` | `react`, webview code |
| `src/webview` | UI, TanStack Query mutations, Markdown render | direct FS APIs |
| `src/bun` | Window, menus, argv open, API boot | React |

## Session model

- **Session Notes**: in-memory `SessionStore` (`packages/api/session.ts`); exposed via `GET /notes`.
- **Document**: optional open file + content in the same store (`GET /session`).
- **Recents**: persisted at `~/.config/mdreadr/recents.json`.
- **Notes file**: explicit save/load JSON (`POST /notes/save`, `POST /notes/load`); schema in `NotesFileSchema`.

## Import paths

| Context | Import style |
|---------|--------------|
| Electrobun bundle (`src/bun`, `packages/api` for build) | Relative paths (`../domain/index.ts`) |
| Webview, tests, `tsc` | `@mdreadr/domain` alias (see `vite.config.ts`, `tsconfig.json`) |

## Adding a feature (vertical slice)

1. **Schema** — `packages/domain/schemas/index.ts`
2. **Pure logic** — `packages/domain/services/*.ts`
3. **Route** — `packages/api/index.ts` (Zod body, `ResultAsync`, map errors to HTTP)
4. **Treaty client usage** — `src/webview/app/pages/*.tsx` via TanStack Query
5. **Test** — domain unit test + API `app.handle()` test
6. **Check** — `bun run check`
