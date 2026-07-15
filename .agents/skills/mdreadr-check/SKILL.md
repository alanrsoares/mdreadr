---
name: mdreadr-check
description: Verify mdreadr changes with bun run check and targeted tests. Use after implementing a feature, before commit, or when user asks to QA or verify work.
---

# mdreadr verification

## Milestone command

```bash
bun run check
```

Equivalent to:

1. `biome ci --error-on-warnings .`
2. `bun run typecheck`
3. `bun test`

**Do not claim done** until this exits 0.

## Narrower runs

| Change touched | Minimum |
|----------------|---------|
| `packages/domain/*` | `bun test packages/domain` + `bun run check` |
| `packages/api/*` | `bun test packages/api` + `bun run check` |
| `src/webview/*` | `bun run lint` + typecheck + `bun run check` |
| `biome.json` / scripts | full `bun run check` |

## Report format

```
qa: mdreadr
  lint:      ✓
  typecheck: ✓
  test:      ✓ N passed
verdict: ready
```

On failure, lead with the first error line.

## Manual smoke (UI-visible changes)

`bun run check` does not prove rendering. For markdown/UI work:

```bash
bun run dev:hmr
```

Then: open a `.md` file, verify TOC, code highlight, note pin + reply, save/load notes JSON.

State explicitly if manual smoke was not run.

## Common failures

| Error | Fix |
|-------|-----|
| Biome format | `bun run lint:fix` |
| `noUnusedImports` | remove dead imports |
| `noExplicitAny` | type the boundary |
| Electrobun `@mdreadr/*` resolve | use relative imports in `packages/api` |
| Treaty type errors | guard API responses in webview |
