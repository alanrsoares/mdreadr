# Architecture

mdreadr is a desktop markdown reader/editor: an Electrobun host process, a Bun/Elysia
API server (also serving an embedded MCP server), and a React webview. This doc maps
how those pieces fit together and how a document flows from disk to screen and back.

## System overview

```d2
main: "src/bun\n(Electrobun host)" {
  shape: rectangle
}

api: "packages/api\n(Elysia server)" {
  shape: rectangle
  routes: "HTTP routes\ndocuments · session · notes\nsuggestions · recents · auth"
  mcp: "MCP server\n(/mcp)" {
    tools: "document-tools · note-tools\nsuggestion-tools · activity-tools"
  }
  session: "documentSession +\nsessionStore\n(in-process state)"

  routes -> session
  mcp.tools -> session
}

domain: "packages/domain\nschemas + services\n(zod, framework-free)" {
  shape: rectangle
}

webview: "src/webview/app\n(React + TanStack Router/Query)" {
  shape: rectangle
}

agent: "External MCP client\n(Claude, etc.)" {
  shape: person
}

main -> api: "startServer()\nspawns in-process"
main -> webview: "BrowserWindow\nloads UI, injects\n__MDREADR_API__ + token"
webview -> api.routes: "Eden Treaty\nloopback HTTP"
agent -> api.mcp: "MCP protocol\nbearer token"
api.session -> webview: "executeJavascript()\ndispatch 'mdreadr:open-document'\n(only main→webview push)"

api.routes -> domain
api.mcp -> domain
webview -> domain: "@mdreadr/domain\n(vite alias)"
```

**Notes on the diagram:**

- There is no custom native IPC bridge between `src/bun` and the webview. The main
  process starts the API server, opens a `BrowserWindow` pointed at it, and injects
  `window.__MDREADR_API__` / `window.__MDREADR_WEBVIEW_TOKEN__` via `preload`. From
  there the webview talks to the API purely over loopback HTTP (Eden Treaty), just
  like any other client.
- The MCP server is **not a separate process** — it's the same Elysia app, mounted at
  `/mcp`, sharing the same `documentSession` / `sessionStore` singletons as the HTTP
  routes. Its tools are authorized with a separate bearer token from the webview's.
- The one main→webview push is `documentSession.onChange` calling
  `executeJavascript(...)` to dispatch a DOM event when a document changes on disk
  (e.g. an agent calls `open_document` via MCP) — the webview reacts by refetching
  `/session`.
- `packages/domain` is a leaf: both `packages/api` and `src/webview` depend on it, it
  depends on neither.

## Opening and editing a document

```d2
shape: sequence_diagram

disk: "Filesystem"
session: "documentSession\n(packages/api)"
webview: "webview\n(ReaderApi / TanStack Query)"
editor: "DocumentEditor\n(CodeMirror)"
agent: "MCP client"

webview -> session: "POST /documents/open"
session -> disk: "read file"
disk -> session: content
session -> webview: "{ path, content }"
webview -> editor: "render in\nMarkdownView / editor"

editor -> session: "POST /documents/save\n(draft content)"
session -> disk: "write file"
session -> session: "reconcile accepted\nSuggestions against\nnew block anchors"

agent -> session: "open_document (MCP tool)"
session -> disk: "read file"
session -> webview: "executeJavascript:\ndispatch 'mdreadr:open-document'"
webview -> session: "GET /session\n(refetch)"
```

## Webview composition

```d2
shape: sequence_diagram

Router: "router.tsx"
Page: "ReaderPage"
Tab: "ReaderTab"
Layout: "ui/layout.tsx\n(ReaderLayout, ReaderPanel,\nReaderMain, ReaderSheet, ...)"
View: "DocumentView\n(preview) / DocumentEditor (edit)"
MdView: "MarkdownView"
Pipeline: "markdown/pipeline.tsx\n(react-markdown + remark-gfm\n+ remark-math + rehype-katex)"
Fences: "special fences:\nmermaid.tsx · d2.tsx\nmath.tsx · badges.tsx · align-block.tsx"

Router -> Page: mounts single route
Page -> Layout: "composes grid/panels"
Page -> Tab: "one per open document"
Tab -> View: "DocumentViewModeSwitch\npicks preview vs edit"
View -> MdView: "preview mode"
MdView -> Pipeline: "renders markdown"
Pipeline -> Fences: "code fence language\nmatches a special renderer"
```

Fenced code blocks whose language matches an entry in `SPECIAL_FENCES`
(`pipeline.tsx`) skip the default `CodeBlock` renderer and mount a dedicated
component instead — this is how ` ```mermaid ` and ` ```d2 ` blocks become live
diagrams. Both diagram renderers share zoom/pan/fullscreen chrome via
`diagram-viewer.tsx`'s `DiagramViewer`, and only differ in how they compile source
text into an SVG string (`mermaid.render()` vs `D2.compile()` + `D2.render()`).

## Package map

| Path | Responsibility | Consumed by |
|---|---|---|
| `src/bun/` | Electrobun host process — window/menu lifecycle, argv/URL-open handling, CLI install | — (entry point) |
| `packages/api/` | Elysia HTTP server, session/document state, auth | `src/bun` (starts it), `src/webview` (calls it) |
| `packages/api/mcp/` | MCP server mounted on the same Elysia app | External MCP clients (agents) |
| `packages/domain/` | Zod schemas + pure services (anchors, markdown blocks, notes, suggestions) | `packages/api`, `src/webview` |
| `src/webview/app/` | React + TanStack Router/Query renderer, markdown pipeline, CodeMirror editor | — (leaf, runs in the `BrowserWindow`) |
| `shared/` | Cross-cutting constants (e.g. `APP_NAME`) | all of the above |

## Build & tooling

- **Bundling**: Vite (`vite.config.ts`) builds the webview to `dist/`; dev server on
  `:5173`. Path aliases wire up `@mdreadr/domain`, `@mdreadr/api`, `@mdreadr/shared/constants`.
- **Packaging**: `electrobun build --env=stable` produces the native app bundle
  (`build/`, `artifacts/`).
- **Lint/format**: Biome (`biome.json`, custom Grit plugins in `biome/plugins/`).
- **Tests**: `bun test` (Bun's built-in runner), colocated `*.test.ts` files.
  `bun run check` = Biome + `tsc --noEmit` + `bun test`.
