---
name: mdreadr-ui
description: Build mdreadr webview UI with Astryx, TanStack Router/Query, MarkdownView, and Notes panel. Use when changing Reader layout, components, styling, or client-side data fetching.
---

# mdreadr UI (webview)

## Layout

[`src/webview/app/pages/ReaderPage.tsx`](../../src/webview/app/pages/ReaderPage.tsx) composes **Astryx shell** + **styled-cva layout** from [`ui/layout.tsx`](../../src/webview/app/ui/layout.tsx):

- **AppShell** — Astryx chrome
- **ReaderLayout / ReaderPanel / ReaderMain** — styled-cva grid
- **TOC** — [`TocSidebar.tsx`](../../src/webview/app/components/TocSidebar.tsx)
- **Content** — [`MarkdownView.tsx`](../../src/webview/app/components/MarkdownView.tsx)
- **Notes** — [`NotesPanel.tsx`](../../src/webview/app/components/NotesPanel.tsx)

For styled-cva recipes and Biome rules, see [mdreadr-styling](../mdreadr-styling/SKILL.md).

## Astryx conventions

Components use **`label` prop** on `Button`, not children:

```tsx
<Button label="Open…" variant="secondary" onClick={handler} />
```

`TextArea` requires `label` (use `isLabelHidden` for compact UI).

Theme: `Theme` + `neutralTheme` from `@astryxdesign/theme-neutral/built` in [`main.tsx`](../../src/webview/main.tsx).

Discover APIs:

```bash
bunx astryx component Button
bunx astryx docs tokens
```

## Data fetching

TanStack Query in `ReaderPage`:

- `api.session.get()`, `api.documents.recent.get()`, `api.notes.get()`
- Mutations for open, create note, reply, status, save/load

Query keys: `["session"]`, `["recents"]`, `["notes"]` — invalidate after mutations.

## MarkdownView

Pipeline: remark-gfm, remark-math, remark-github-blockquote-alert, rehype-katex.

- **Mermaid**: lazy `import("mermaid")`, render into ref (no `dangerouslySetInnerHTML` prop)
- **Code**: `react-syntax-highlighter` for fenced blocks; `mermaid` language → MermaidBlock
- **Anchors**: right-click heading/paragraph/code → `onPinBlock(anchor)` for Notes

Block IDs on headings use `extractHeadings` slug logic.

## Biome / a11y

- Prefer semantic elements (`<section>` for drop target, not `<div role=…>`)
- Satisfy `useExhaustiveDependencies` — avoid unstable hook deps
- Run `bun run lint` after UI edits

## Do not

- Import `Bun.file` or Node fs in webview
- Bypass Treaty for filesystem access
- Add non-Astryx **component libraries** without discussion (styled-cva + Tailwind utilities are approved for layout)
