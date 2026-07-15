---
name: mdreadr-api
description: Extend mdreadr's Elysia API, session store, Eden Treaty client, and filesystem IO. Use when adding routes, MCP prep, document/recents/notes endpoints, or loopback HTTP behavior.
---

# mdreadr API layer

## Entry points

| File | Role |
|------|------|
| `packages/api/index.ts` | Elysia app, routes, `export type App` |
| `packages/api/session.ts` | In-memory `SessionStore` |
| `packages/api/documents.ts` | Read/write files, zenity dialogs |
| `packages/api/recents.ts` | `~/.config/mdreadr/recents.json` |
| `src/bun/index.ts` | `startServer(0)` before opening window |

## Route map (v1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/session` | Document + content + notes snapshot |
| GET | `/documents/recent` | Recents paths |
| POST | `/documents/open` | Open `.md` by path |
| GET | `/notes` | Session notes |
| POST | `/notes` | Create Note |
| POST | `/notes/:id/replies` | Add Reply |
| PATCH | `/notes/:id/status` | Update status |
| POST | `/notes/save` | Write Notes JSON |
| POST | `/notes/load` | Load Notes JSON into session |
| POST | `/dialogs/pick` | Native open/save path (`zenity`) |

## Adding a route

```ts
.post("/example", async ({ body, set }) => {
  const parsed = ExampleBodySchema.safeParse(body);
  if (!parsed.success) {
    set.status = 400;
    return { error: parsed.error.message, code: "ValidationError" };
  }

  const result = await someService(parsed.data);
  if (isErr(result)) {
    set.status = 500;
    return { error: result.error.message, code: result.error._tag };
  }
  return { data: result.value };
}, { body: ExampleBodySchema });
```

Export stays on `export type App = typeof app` for Treaty typing.

## Eden Treaty (webview)

[`src/webview/app/treaty.ts`](../../src/webview/app/treaty.ts):

```ts
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../packages/api/index.ts";

export const api = treaty<App>(getApiBase());
```

Base URL comes from `?api=` query param set by Electrobun main.

Use [`api-guards.ts`](../../src/webview/app/api-guards.ts) helpers when Treaty response unions are wide.

## Testing routes

```ts
import { app, sessionStore, startServer } from "../../packages/api/index.ts";

const response = await app.handle(
  new Request("http://localhost/notes", { method: "GET" }),
);
```

See `packages/api/api.test.ts`.

## Import rule for Electrobun build

Use **relative imports** inside `packages/api` (e.g. `../domain/index.ts`).  
`@mdreadr/*` aliases break the Electrobun bundle step.

## MCP (future)

Add MCP handlers on the same Elysia process; delegate to domain functions used by REST — no duplicate Note logic.
