---
name: mdreadr-styling
description: Author mdreadr layout and custom UI with @styled-cva/react, Tailwind utilities, and Biome styled-cva plugins. Use when adding styled components, migrating inline styles, or configuring tw/cva lint rules.
---

# mdreadr styling (styled-cva + Tailwind)

## Split of responsibilities

| Layer | Tool | Examples |
|-------|------|----------|
| App chrome | **Astryx** | `Button`, `TextArea`, `AppShell`, `SideNav` |
| Reader layout / panels | **`@styled-cva/react`** | `ReaderLayout`, `NoteCard`, `TocLink` |
| Markdown prose | **Global CSS** | `.markdown-body` child selectors in `index.css` |

Do not replace Astryx primitives with styled-cva. Use styled-cva for layout shells and reader-specific UI.

## File map

| Path | Role |
|------|------|
| `src/webview/app/ui/layout.tsx` | Named `tw` components (export and reuse) |
| `src/webview/app/tw.css` | Tailwind theme + utilities layers (no preflight) |
| `src/webview/app/index.css` | Markdown / global resets only |
| `vite.config.ts` | `@tailwindcss/vite` plugin |
| `biome.json` | `@styled-cva/biome-plugin` + `useSortedClasses` |

Import order in `main.tsx`: Astryx CSS → `tw.css` → `index.css`.

## Authoring patterns

```tsx
import tw from "@styled-cva/react";

// Short layout — tagged template
export const ButtonRow = tw.div`flex flex-wrap gap-2`;

// Variants — intrinsic CVA shorthand (not tw.div.cva — deprecated)
export const NoteCard = tw.div(
  "mb-3 rounded-[var(--radius-container)] border border-[var(--color-border)] p-3",
  {
    variants: {
      $status: {
        open: "",
        resolved: "opacity-75",
        wontfix: "opacity-75",
      },
    },
  },
);

// Long base-only components — call form, no template literal
export const EmptyState = tw.div(
  "grid h-full place-items-center p-6 text-center text-[var(--color-text-secondary)]",
);

// Usage
<NoteCard $status={note.status}>…</NoteCard>
```

Reference Astryx tokens with arbitrary values: `text-[var(--color-text-secondary)]`, `rounded-[var(--radius-inner)]`.

## Biome toolchain

Configured in [`biome.json`](../../biome.json):

1. **`@styled-cva/biome-plugin`** (GritQL) — diagnostics on `tw.tag\`…\``:
   - `normalize-tw-classes` — no double/extra whitespace in tagged templates
   - `multiline-long-tw` — single-line `tw` strings over 80 chars → use `tw.div("…")` call form

2. **`useSortedClasses`** — sorts classes inside `tw`, `tw.*`, `cva`, `cn` (Tailwind order)

Run after UI edits:

```bash
bun run lint:fix    # safe fixes
bunx biome check --write --unsafe .   # class sorting (unsafe)
bun run check
```

**Long class strings:** prefer `tw.div("…")` or `tw.div("base", { variants })` over a long single-line `` tw.div`…` `` — the Grit plugin does not length-check call-form CVA strings.

**Multi-line `` tw.div`…` ``:** exempt from length rule, but `useSortedClasses` may collapse them — keep lines short or use call form.

## Prettier plugin (optional)

`@styled-cva/prettier-plugin` auto-wraps long `tw` templates. This repo uses **Biome for format**, so the plugin is not installed. Biome Grit rules are diagnostics-only; fixes are manual or via `useSortedClasses --unsafe`.

## Adding a new styled component

1. Add export to `src/webview/app/ui/layout.tsx` (or feature-local file if large)
2. Use `$variant` naming for CVA props
3. Run `bunx biome check --write --unsafe src/webview/`
4. Wire into page/component; avoid new inline `style={{…}}` unless dynamic (e.g. TOC indent)

## Do not

- Add Tailwind preflight (conflicts with Astryx reset)
- Put layout classes in `index.css` — use `layout.tsx`
- Rename `tw` import (Biome Grit rules match `tw` only)
