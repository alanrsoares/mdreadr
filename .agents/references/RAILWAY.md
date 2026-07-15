# Onrails patterns in mdreadr

This repo uses **`@onrails/result`**, **`@onrails/pattern`**, and **`@onrails/maybe`** — not `neverthrow` or `ts-pattern`.

## Result / ResultAsync

```ts
import { err, ok, isErr, isOk, ResultAsync } from "@onrails/result";

// Sync
const found = findNote(notes, id);
if (isErr(found)) return domainError(found.error);

// Async boundary
return ResultAsync.fromPromise(
  Bun.file(path).text(),
  (error): DocumentError => ({
    _tag: "DocumentReadFailed",
    path,
    message: error instanceof Error ? error.message : String(error),
  }),
);
```

Rules:

- Return `ResultAsync<T, E>` from async IO — not `Promise<Result<T, E>>`.
- Narrow with **`isErr(x)` / `isOk(x)`** — these are functions, not `.isErr()` methods.
- Keep throws inside `fromPromise` mappers only.

## Pattern matching

```ts
import { match } from "@onrails/pattern";

set.status = match(error._tag)
  .with("DocumentNotFound", () => 404)
  .with("DocumentReadFailed", () => 500)
  .exhaustive();
```

Use for owned tagged unions: `NoteStatus`, `AuthorKind`, `BlockAnchorKind`, `DocumentError`, `NotesDomainError`.

## Maybe

Reserved for expected absence if introduced later. Current v1 uses plain optional fields on Zod schemas (`document?: DocumentRef`).

## Layer placement

| Layer | Tool |
|-------|------|
| `packages/domain` | `ok` / `err`, pure functions |
| `packages/api` | `ResultAsync`, `isErr`, HTTP mapping |
| `src/webview` | Treaty errors; throw in Query `queryFn` on API error |

Do not leak raw `Result` types across the HTTP boundary — map to `{ error, code }` or success DTOs.
