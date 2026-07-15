---
name: mdreadr-domain
description: Work with mdreadr domain models — Zod schemas, Notes, Anchors, Replies, markdown TOC helpers. Use when adding or changing business rules, validation, or CONTEXT.md terms.
---

# mdreadr domain

Read [`CONTEXT.md`](../../CONTEXT.md) first for vocabulary.

## File map

| Path | Contents |
|------|----------|
| `packages/domain/schemas/index.ts` | All Zod schemas + inferred types |
| `packages/domain/services/notes.ts` | Note/Reply pure functions |
| `packages/domain/services/markdown.ts` | `extractHeadings` for TOC |
| `packages/domain/domain.test.ts` | Unit tests |

## Core types (schema-first)

- `DocumentRef` — `{ path }`
- `BlockAnchor` — `kind` + `blockId` + optional `headingPath`
- `Note` — anchor, `status`, `replies[]`, timestamps
- `Reply` — `author` (`human` \| `agent` \| `system`), `body`, timestamps
- `NotesFile` — `{ schemaVersion: 1, document?, notes[] }`

Add fields by updating Zod first, then services, then API routes, then UI.

## Service recipes

**Create Note with opening Reply**

```ts
createNote({ anchor, body, author });
```

**Add Reply**

```ts
addReply(note, { body, author });
```

**Change status**

```ts
setNoteStatus(note, "resolved");
```

**Parse saved Notes file**

```ts
const parsed = parseNotesFileJson(raw);
if (isErr(parsed)) { /* InvalidNotesFile */ }
```

**TOC headings**

```ts
extractHeadings(markdown); // { id, level, text }[]
```

## Rules

- No filesystem, HTTP, or React in `packages/domain`.
- Use `@onrails/result` (`ok`, `err`, `isErr`) — see [RAILWAY.md](../../references/RAILWAY.md).
- Status and author kinds are Zod enums — match with `@onrails/pattern` at API edge.
- Tests: `bun test packages/domain/domain.test.ts`

## Adding a new Note field

1. Extend Zod schema in `schemas/index.ts`
2. Update `createNote` / serializers if needed
3. Bump `NOTES_SCHEMA_VERSION` in `shared/constants.ts` only for breaking file format changes
4. Update `NotesFileSchema` and migration logic if persisted
