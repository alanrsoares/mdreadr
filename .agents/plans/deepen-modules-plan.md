# Implementation plan — deepen modules (architecture review 2026-07-17)

Single PR on branch `refactor/deepen-modules` (already created off `main`). Six workstreams, executed **in order** — later ones build on earlier ones. One commit per workstream (two for WS-1). Run `bun run check` (Biome CI + `tsc --noEmit` + `bun test`) after **every** workstream; do not proceed while red.

## Ground rules

- Bun only. `bun:test` for tests. No new dependencies. No React Testing Library — anything that needs a DOM stays untested; design so logic is testable without one.
- Errors: `Result`/`ResultAsync` from `@onrails/result` at IO boundaries; `isErr`/`isOk` functions. No throws in domain logic.
- Strict TS, no `any`, Biome formatting (2 spaces, double quotes). Warnings fail CI.
- Conventional commits, scope required (`api`, `domain`, `ui`, `shell`, `repo`), subject ≤ 50 chars, imperative, no AI attribution.
- Domain vocabulary (CONTEXT.md): Document, Note, Reply, Anchor, Session Notes, Notes file. Use these in names/comments.
- Do **not** rename routes, change HTTP shapes, or alter rendered DOM contracts (`data-block-id`, heading `id`) — the webview and saved Notes files depend on them.
- Update stale file references in `.agents/skills/*/SKILL.md` (grep for old filenames after each deletion/rename).

---

## WS-1 — Delete pass-throughs

**Goal:** remove modules/exports that fail the deletion test. Zero behaviour change.

### Commit A — `refactor(api): drop dead recents and documents exports`

`packages/api/recents.ts`
- Delete `isRecentsError`, `recentsErr`, `readRecentsSafe` (bottom of file). None are imported anywhere (verified by grep).
- Remove now-unused `errAsync` import.

`packages/api/documents.ts`
- Delete `toDocumentRef` (never imported).
- Remove now-unused `DocumentRef` type import if it becomes unused.
- Collapse `toDocumentHttpError` + private `matchDocumentError` into one exported function `toDocumentHttpError` containing the switch. Callers (`packages/api/index.ts`) unchanged.

### Commit B — `refactor(ui): drop dead provider branch and api guard`

`src/webview/app/providers.tsx`
- `children` becomes required (`children: ReactNode`), body becomes `<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>`.
- Delete the `?? <RouterProvider router={router} />` fallback and the `router` import. (`main.tsx` always passes children — verified.)

`src/webview/app/api-guards.ts`
- Delete only `hasApiError` (no importers). Keep `readPaths`/`readOptionalPath` for now — the whole file is deleted in WS-5.

**Acceptance:** `bun run check` green; `grep -rn "readRecentsSafe\|recentsErr\|isRecentsError\|toDocumentRef\|hasApiError" src packages` returns nothing.

---

## WS-2 — One path-display module

**Commit:** `refactor(ui): merge path display into one module`

**Goal:** one module owns basename, home abbreviation, and collision-aware recents labels. Today there are three basename implementations (`recent-path-labels.ts:splitPath`, `RecentsSidebar.tsx:fileName`, implicit in `display-path.ts`).

### New file `src/webview/app/components/path-display.ts`

Public interface (exactly this; everything else in the file is unexported):

```ts
export type RecentPathMenuLabel = {
  menuLabel: string;  // SideNav label + collapsed tooltip
  ariaLabel: string;  // full path for screen readers
};

/** Last path segment; tolerant of `/` and `\`. */
export function pathFileName(path: string): string;

/** Home-directory prefix → `~`. Falls back to /home/{user} and /Users/{user} when home unknown. */
export function formatDisplayPath(path: string, homeDirectory?: string): string;

/** Collision-aware labels for the Recents sidebar. */
export function formatRecentMenuLabels(paths: readonly string[]): Map<string, RecentPathMenuLabel>;
```

Implementation: move bodies verbatim from `display-path.ts` (`normalizeDirectory`, `formatDisplayPath`) and `recent-path-labels.ts` (`splitPath`, `groupBy`, `abbreviatePathHint`, `buildRecentPathDisplays`, `formatRecentMenuLabels`). `pathFileName(path)` = `splitPath(path).at(-1) ?? path`. `buildRecentPathDisplays`, `abbreviatePathHint`, `RecentPathDisplay` become **internal** (no export).

### Deletions
- `src/webview/app/components/display-path.ts` + `display-path.test.ts`
- `src/webview/app/components/recent-path-labels.ts` + `recent-path-labels.test.ts`
- `RecentsSidebar.tsx`: local `fileName` function and the `export { fileName as pathFileName }` re-export at the bottom.

### Import updates
- `RecentsSidebar.tsx`: import `formatDisplayPath`, `formatRecentMenuLabels`, `pathFileName` from `./path-display.ts`; replace the `fileName(path)` fallback at the menu-label call site with `pathFileName(path)`.
- `ReaderPage.tsx`: import `formatDisplayPath`, `pathFileName` from `../components/path-display.ts`; stop importing `pathFileName` from `RecentsSidebar.tsx`.

### Tests — new `src/webview/app/components/path-display.test.ts`
Port every case from the two deleted test files, rewritten against the public interface only:
- `formatDisplayPath`: home provided (exact home, under home, outside home), no home (`/home/x/...`, `/Users/x/...`, non-home path), backslash normalization, trailing-slash home.
- `formatRecentMenuLabels`: unique basenames → plain label; colliding basenames → `label · hint` with minimal distinguishing suffix; long hints abbreviated with `…/` prefix (covers old `abbreviatePathHint` cases); `ariaLabel` is always full path.
- `pathFileName`: posix, windows separators, trailing slash, bare name.

**Acceptance:** check green; `grep -rn "display-path\|recent-path-labels" src` returns nothing.

---

## WS-3 — Reader markdown pipeline seam

**Commit:** `refactor(ui): consolidate markdown pipeline seam`

**Goal:** one module (`pipeline.tsx`) is the only import surface for markdown rendering knowledge. Kills three duplications: special-fence dispatch ×3, image sanitize/resolve ×3, badge token regex ×2. **Also fixes a live bug:** `align` fences are not excluded from pinnable-code collection (`block-ids.ts:isPinnableCodeBlock` excludes only mermaid/math/badges), so the allocator assigns a code id to each `align` fence which the renderer never consumes — every code block after a `<div align>` hero gets a shifted, wrong `data-block-id`.

### New file `src/webview/app/markdown/pipeline.tsx`

Public interface:

```ts
import type { MarkdownInlinePlugin } from "@astryxdesign/core/Markdown";
import type { ReactNode } from "react";
import type { ImageSrcResolver } from "./assets.ts";

export type { ImageSrcResolver };
export { createAssetResolver } from "./assets.ts";
export { preprocessReaderMarkdown } from "./preprocess.ts";

/** Fence languages with dedicated renderers (align, mermaid, math, badges). */
export function isSpecialFence(language: string | undefined): boolean;

/** Render a special fence, or null when `language` is not special / payload invalid. */
export function renderSpecialFence(
  language: string | undefined,
  code: string,
  ctx: { resolveImageSrc?: ImageSrcResolver },
): ReactNode | null;

/** Single sanitize+resolve image renderer used by block, inline-HTML, and nested renderers. */
export function ReaderImage(props: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  resolveImageSrc?: ImageSrcResolver;
}): ReactNode;

/** All reader inline plugins (linked badges, inline math, inline HTML) in canonical order. */
export function createReaderInlinePlugins(resolveImageSrc?: ImageSrcResolver): MarkdownInlinePlugin[];
```

Implementation details:
1. **Fence registry** (internal): `const SPECIAL_FENCES: Record<string, (code, ctx) => ReactNode | null>` with entries `align` (→ `AlignBlock`), `mermaid` (→ `MermaidChart`), `math` (→ `MathBlock`), `badges` (→ `parseBadgeBlock` + `BadgeRow`; return `null` when parse fails so caller falls through to a plain pinnable code block — preserves current behaviour in `pin-components.tsx:98-104`). `isSpecialFence = (lang) => lang != null && lang in SPECIAL_FENCES`. **Registration order/list is the single source of truth for "special".**
2. **ReaderImage**: if `DANGEROUS_URL_PATTERN.test(src.trim())` → return `<span>{alt}</span>`; else `<img alt className="reader-inline-img" loading="lazy" src={resolveImageSrc ? resolveImageSrc(src) : src} width height />`.
3. **Badge token single source:** in `preprocess.ts`, add `export const LINKED_BADGE_TOKEN_SOURCE = String.raw`\[\[\[BADGE:(\{.*?\})\]\]\]`;` and build `BADGE_TOKEN_RE` from it. In `badges.tsx`, delete `LINKED_BADGE_PATTERN` and build the plugin pattern with `new RegExp(LINKED_BADGE_TOKEN_SOURCE, "g")` (fresh instance — never share a `/g` regex object between the preprocess replace and the inline plugin; `lastIndex` is stateful).
4. **createReaderInlinePlugins** returns `[linkedBadgePlugin, inlineMathPlugin, ...createInlineHtmlPlugins(resolveImageSrc)]` — the assembly currently duplicated in `MarkdownView.tsx:45-48` and `align-block.tsx:80-84`.

### Consumer rewiring
- `pin-components.tsx` (`PinCodeBlock`): replace the `switch (language)` with
  ```ts
  const special = renderSpecialFence(language, code, { resolveImageSrc });
  if (special !== null) return special;
  ```
  Replace its `image({ src, alt })` renderer body with `ReaderImage`. Import only from `pipeline.tsx` (plus ui/ and domain imports).
- `inline-html.tsx` (`createImgPlugin`): keep `parseImgTag` (attribute parsing + dangerous check returning `null` → raw-text span fallback unchanged), but render the parsed result through `ReaderImage`.
- `align-block.tsx` (`createNestedComponents`): nested `code` renderer = `renderSpecialFence(language, code, ctx) ?? <CodeBlock code={code} language={language} />` **except** it must not recurse into `align` infinitely — current behaviour: nested align fences inside an align body. Preserve current behaviour exactly: check what the current nested `code` switch handles (mermaid/math/badges) and register the nested renderer to skip `align` (pass an internal option `renderSpecialFence(language, code, ctx, { skip: ["align"] })` — add the optional 4th param as internal-only, not in the public signature above; alternatively export `renderNestedSpecialFence`). Nested `image` renderer → `ReaderImage`. Nested inline plugins → `createReaderInlinePlugins(resolveImageSrc)`. Keep the `preprocessReaderMarkdown(payload.body)` recursion (documented, intentional).
- `MarkdownView.tsx`: import `preprocessReaderMarkdown`, `createAssetResolver`, `createReaderInlinePlugins` from `pipeline.tsx`; delete direct imports of `badges.tsx`, `math.tsx`, `inline-html.tsx`, `assets.ts`, `preprocess.ts`.
- `block-ids.ts`: replace `isPinnableCodeBlock`'s hardcoded list with `!isSpecialFence(language)` imported from `pipeline.tsx`. **This is the align-desync fix.** (File itself is restructured in WS-4; do the minimal import swap here.)

**Import rule after this WS:** `MarkdownView.tsx`, `pin-components.tsx`, and (after WS-4) `anchors.ts` import markdown knowledge **only** from `pipeline.tsx`. Files `preprocess.ts`, `badges.tsx`, `math.tsx`, `mermaid.tsx`, `align-block.tsx`, `inline-html.tsx`, `assets.ts` are implementation — nothing outside `src/webview/app/markdown/` may import them. Verify: `grep -rn "markdown/preprocess\|markdown/badges\|markdown/math\|markdown/mermaid\|markdown/align-block\|markdown/inline-html\|markdown/assets" src/webview/app --include='*.tsx' --include='*.ts' | grep -v "app/markdown/"` → empty.

### Tests
- New `src/webview/app/markdown/pipeline.test.ts`:
  - `isSpecialFence`: true for align/mermaid/math/badges, false for ts/js/undefined/"".
  - badge token: `LINKED_BADGE_TOKEN_SOURCE` round-trips — `encodeLinkedBadge(...)` output matches a fresh regex built from the source.
- **Align-desync regression** (goes in the allocator test file; see WS-4 test list — write it in this WS against `createBlockIdAllocator`): document = align fence followed by a `ts` code fence; the `ts` fence's allocated id must equal `blockIdForCode(code, "ts", 0)` computed directly. This fails before the fix, passes after.
- Existing `preprocess.test.ts`, `inline-html.test.ts`, `assets.test.ts` keep passing unchanged (pure functions untouched).

**Acceptance:** check green; import-rule grep empty; align regression test passes.

---

## WS-4 — Anchor identity module

**Commit:** `refactor(ui): deepen anchor identity module`

**Goal:** one module owns Anchor identity for a Document: every pinnable block's `blockId` in render order (headings, paragraphs, code), plus locate/scroll/flash. Kills the split where headings are numbered by regex + refs in `MarkdownView` while paragraphs/code are numbered by the AST allocator in `block-ids.ts`.

### New file `src/webview/app/markdown/anchors.ts` (replaces `block-ids.ts`)

Public interface:

```ts
import type { BlockAnchor, TocEntry } from "@mdreadr/domain";

export type AnchorPlan = {
  /** Headings of the *prepared* markdown, in order (drives heading ids). */
  headings: TocEntry[];
  /** Reset render cursors. MUST be called at the start of every render pass. */
  begin(): void;
  /** Next heading: anchor + the DOM id to stamp (id === anchor.blockId). */
  nextHeading(level: number, text: string): { anchor: BlockAnchor; domId: string };
  nextParagraph(text: string): BlockAnchor;
  nextCode(code: string, language?: string): BlockAnchor;
};

/** Build the Anchor plan for a Document's *prepared* markdown (post-preprocess). */
export function createAnchorPlan(prepared: string): AnchorPlan;

export function scrollToAnchor(blockId: string): boolean;                  // was scrollToBlock
export function flashAnchor(blockId: string, className?: string): boolean; // was flashBlock
export function anchorDisplayLabel(anchor: BlockAnchor): string;           // moved verbatim
```

Implementation:
- Fold in from `block-ids.ts`: `inlineToText`, `collectPinnableBlocks` (using `!isSpecialFence(language)` from pipeline), paragraph/code pre-computation from `createBlockIdAllocator`, `flashBlock`/`scrollToBlock` bodies (renamed), `anchorDisplayLabel`.
- Headings: `extractHeadings(prepared)` (from `@mdreadr/domain`) computed once in `createAnchorPlan` → `headings`. `nextHeading` keeps an internal index cursor and an internal heading-path stack (move `headingPathForLevel` from `MarkdownView.tsx:22-32` verbatim). Returns `{ anchor: { kind: "heading", blockId, headingPath, label: truncateAnchorLabel(text) }, domId: blockId }` where `blockId = blockIdForHeading(entry)` for the cursor's entry, falling back to `` `heading-${index}` `` past the end (current behaviour).
- Paragraph/code cursors and their silent fallbacks (`blockIdForParagraph(text, 0)` / `blockIdForCode(code, language, 0)`) move over unchanged.
- `begin()` resets all three cursors and clears the heading stack. **Fixes a latent bug:** today the allocator cursors are memoized on `prepared` but advance during render, so a re-render with unchanged content (e.g. notes changed → new components identity) re-invokes renderers against exhausted cursors and every duplicate-content block falls back to occurrence-0 ids; the heading index has the same flaw gated on `contentKeyRef`. With `begin()` called per render pass, ids are identical on every pass.
- **Behaviour note (heading source):** heading ids move from `extractHeadings(content)` (raw) to `extractHeadings(prepared)`. Preprocess does not add/remove/rewrite `#`-heading lines outside code fences (verify by reading `preprocess.ts` transforms — they touch HTML comments, entities, math, images, badges, alerts, align wrappers), so slugs are unchanged for real documents; this makes heading numbering consistent with what is actually rendered.

### Deletions
- `src/webview/app/markdown/block-ids.ts` and `block-ids.test.ts` (superseded).
- In `MarkdownView.tsx`: `headingPathForLevel`, `headingStackRef`, `headingIndexRef`, `contentKeyRef`, the `headings` memo, `nextHeadingId`, and the `blockIdForHeading`/`extractHeadings` imports.

### Consumer rewiring
- `MarkdownView.tsx`:
  ```ts
  const prepared = useMemo(() => preprocessReaderMarkdown(content), [content]);
  const plan = useMemo(() => createAnchorPlan(prepared), [prepared]);
  plan.begin(); // every render pass, in the component body before <Markdown> renders
  ```
  Pass `plan` to `createPinComponents` instead of `nextHeadingId`/`headingPathForLevel`/`blockIds`.
- `pin-components.tsx`: `PinContext` becomes `{ onPinBlock?, plan: AnchorPlan, notedBlockIds, resolveImageSrc? }`. Heading renderer: `const { anchor, domId } = ctx.plan.nextHeading(level, textFromChildren(children))` → stamp `id={domId} data-block-id={domId}`, pin with `anchor`. Paragraph renderer: `ctx.plan.nextParagraph(text)` returns the full `BlockAnchor` (build `label: truncateAnchorLabel(...)` inside the plan so pin-components stops assembling anchors by hand). Code renderer: `ctx.plan.nextCode(code, language)` likewise.
- `ReaderPage.tsx`: import `scrollToAnchor`, `flashAnchor` from `../markdown/anchors.ts` (rename call sites `scrollToBlock`→`scrollToAnchor`, `flashBlock`→`flashAnchor`).
- `pin-button.tsx`, `NotesPanel.tsx`: import `anchorDisplayLabel` from `../markdown/anchors.ts`.
- `ReaderPage.tsx` TOC (`extractHeadings(content)` for `TocSidebar`) stays **unchanged** — out of scope here (it already reads raw content today; changing it is a separate decision).

### Tests — new `src/webview/app/markdown/anchors.test.ts`
Port the stability/order cases from `block-ids.test.ts`, then add:
1. **Full-plan order:** doc with headings + paragraphs + code, consume via `nextHeading`/`nextParagraph`/`nextCode` in document order → ids match direct `blockIdForHeading`/`blockIdForParagraph`/`blockIdForCode` computation with correct occurrence counts.
2. **Duplicates:** two identical paragraphs → occurrence 0 and 1; identical code fences likewise.
3. **Align-desync regression** (from WS-3): align fence before a `ts` fence → `nextCode` for the `ts` fence returns occurrence-0 id for the `ts` content, not the align payload's id.
4. **Re-render determinism:** consume the plan fully, call `begin()`, consume again → identical id sequence both passes (including headings and heading paths).
5. **Desync fallback:** consume one more paragraph than the doc contains → falls back to `blockIdForParagraph(text, 0)` without throwing.
6. **Heading paths:** `# A / ## B / ### C / ## D` → `nextHeading` paths `[A]`, `[A,B]`, `[A,B,C]`, `[A,D]`.
7. `anchorDisplayLabel` cases moved from old test file (if present) or added: label wins, headingPath fallback, kind fallback.

**Acceptance:** check green; `grep -rn "block-ids" src` → empty; `grep -rn "createBlockIdAllocator\|scrollToBlock\|flashBlock" src` → empty.

---

## WS-5 — Reader session module

**Commit:** `refactor(ui): extract reader session module`

**Goal:** ReaderPage (519 lines) keeps only layout + view state; data operations, invalidation, and flow chaining move behind a seam with two adapters (treaty in prod, in-memory fake in tests).

### New file `src/webview/app/session/reader-api.ts` — the adapter seam

```ts
import type { BlockAnchor, DocumentRef, Note, NoteStatus } from "@mdreadr/domain";

export type SessionSnapshot = {
  document: DocumentRef | null;
  documentContent: string | null;
  notes: Note[];
  homeDirectory: string;
};

export type ReaderApi = {
  getSession(): Promise<SessionSnapshot>;
  getRecents(): Promise<string[]>;
  getNotes(): Promise<Note[]>;
  openDocument(path: string): Promise<{ path: string; content: string }>;
  pickPath(input: { mode: "open" | "save"; filters?: string[]; defaultPath?: string }): Promise<string | null>;
  createNote(input: { anchor: BlockAnchor; body: string }): Promise<void>;
  addReply(noteId: string, body: string): Promise<Note>;
  setNoteStatus(noteId: string, status: NoteStatus): Promise<Note>;
  saveNotes(input: { path: string; notes: Note[]; document?: DocumentRef }): Promise<void>;
  loadNotes(path: string): Promise<{ notes: Note[]; document?: DocumentRef | null }>;
  log(message: string): void; // fire-and-forget diagnostics
};

/** Extract a human message from an Eden Treaty error shape (moved from useMutationToast.errorMessage). */
export function apiErrorMessage(error: unknown): string;

export function createTreatyReaderApi(): ReaderApi;
```

`createTreatyReaderApi` wraps the existing `api` treaty client (`../treaty.ts`). Every method unwraps `{ data, error }`: on `error`, `throw new Error(apiErrorMessage(error))`. The `readPaths`/`readOptionalPath` narrowing from `api-guards.ts` moves **inside** `getRecents`/`pickPath` (the only places Treaty's inference is too weak). `log` posts via `api.log.post({ message })` and swallows failures — this deletes ReaderPage's hand-built `fetch` + hardcoded `http://127.0.0.1:3000` (`ReaderPage.tsx:343-368`'s fetch parts).

Move `apiErrorMessage` verbatim from `useMutationToast.ts:errorMessage`; `useMutationToast` then reduces its unwrapping to `error instanceof Error ? error.message : apiErrorMessage(error)` by importing it (single owner).

### New file `src/webview/app/session/reader-flows.ts` — pure flows (the testable core)

```ts
export type SaveNotesOutcome = { kind: "saved"; path: string } | { kind: "cancelled" };
export type LoadNotesOutcome =
  | { kind: "loaded"; documentPath: string | null }
  | { kind: "cancelled" };

/** Pick a target path (cancel → cancelled), then persist Session Notes as a Notes file. */
export async function saveNotesFlow(
  api: ReaderApi,
  input: { notes: Note[]; document?: DocumentRef },
): Promise<SaveNotesOutcome>;

/** Pick a Notes file (cancel → cancelled), load it, report the Document to reopen (if any). */
export async function loadNotesFlow(api: ReaderApi): Promise<LoadNotesOutcome>;

/** Pick a Document (cancel → null). */
export async function pickDocumentFlow(api: ReaderApi): Promise<string | null>;
```

Bodies are the current mutation fns from `ReaderPage.tsx:134-151` (pick), `211-240` (save: pick with `mode:"save", defaultPath:"notes.json"`, null path → cancelled, else `api.saveNotes`), `242-271` (load: pick with `mode:"open", filters:["*.json"]`, null → cancelled, else `api.loadNotes`, surface `document?.path ?? null`). Errors propagate as thrown `Error` (adapter already normalized messages).

### New file `src/webview/app/session/useReaderSession.ts` — the hook

```ts
export function useReaderSession(api: ReaderApi): {
  session: UseQueryResult<SessionSnapshot>;
  recents: UseQueryResult<string[]>;
  notes: UseQueryResult<Note[]>;
  open: (path: string) => void;
  pick: () => void;
  createNote: (input: { anchor: BlockAnchor; body: string }) => Promise<void>;
  addReply: (noteId: string, body: string) => Promise<void>;
  setStatus: (noteId: string, status: NoteStatus) => Promise<void>;
  save: () => Promise<void>;
  load: () => Promise<void>;
  refresh: () => void; // invalidate session + notes (used by the mdreadr:open-document listener)
  isOpening: boolean;
  isSaving: boolean;
  isLoadingNotes: boolean;
  isCreatingNote: boolean;
};
```

Contains the three `useQuery` + seven `useMutation` blocks moved from ReaderPage, calling `api.*` / the flows. Keeps all `onSuccess` invalidations, toast calls (`useMutationToast`), and live-region messages? **No** — live-region text (`setLiveMessage`) and `setPendingAnchor(null)` are view state: expose success via optional callbacks instead:

```ts
useReaderSession(api, callbacks?: {
  onOpened?: (path: string) => void;       // ReaderPage: clear pendingAnchor, set live message, toast handled inside hook
  onNoteCreated?: () => void;              // ReaderPage: clear pendingAnchor + live message
  onReplyAdded?: () => void;
  onStatusChanged?: (status: NoteStatus | undefined) => void;
  onNotesSaved?: () => void;
  onNotesLoaded?: () => void;
})
```

Toasts (`showError`/`showSuccess`) live **inside** the hook (they're session feedback, not layout). `loadNotesFlow` outcome with a `documentPath` chains `open(documentPath)` inside the hook — the chain from `ReaderPage.tsx:256-262`.

### ReaderPage rewiring
- Delete: three query blocks, seven mutation blocks, the `/log` fetch effect (replace with `api.log("ReaderPage mounted")` once + `refresh()` in the `mdreadr:open-document` listener), `api-guards` imports.
- Keep: `pendingAnchor`, `documentViewMode`, `liveMessage`, drag state + handlers, keyboard effect (calls `pick()`), `onScrollToAnchor`, all JSX.
- Construct once at module scope: `const readerApi = createTreatyReaderApi();` pass into `useReaderSession(readerApi, {...callbacks setting liveMessage/pendingAnchor})`.
- Delete `src/webview/app/api-guards.ts` entirely.
- Target: ReaderPage ≤ ~300 lines, no direct `api`/treaty/queryClient usage left except via the hook (`grep -n "useQueryClient\|api\." ReaderPage.tsx` shows only hook usage).

### Tests
New `src/webview/app/session/reader-session.test.ts` (no DOM needed):
- `createInMemoryReaderApi()` test helper **in the test file**: full `ReaderApi` over plain arrays/maps + a scripted `pickPath` queue (`pushPick(path | null)`).
- `saveNotesFlow`: pick returns null → `{kind:"cancelled"}`, `saveNotes` not called (spy count 0); pick returns path → saved with that path and the exact notes/document passed through.
- `loadNotesFlow`: cancel path; loaded with document → `documentPath` set; loaded without document → `documentPath: null`.
- `apiErrorMessage`: Eden shapes — `{ value: { error: "x" } }`, `{ value: { message: "x" } }`, `{ value: "x" }`, `{ error: "x" }`, `{ message: "x" }`, `Error`, string, `undefined` → `"Something went wrong"`. (Port semantics from current `errorMessage`.)
- Treaty adapter unwrap: feed `createTreatyReaderApi` is hard to fake (module-scope treaty import) — instead export internal `unwrap<T>(res: { data: T | null; error: unknown }): T` from `reader-api.ts` and test it directly: error → throws with extracted message; data → returned.

**Acceptance:** check green; `api-guards.ts` gone; ReaderPage has no `fetch(`, no `__MDREADR_API__`, no `useQueryClient` import; behaviour identical in manual smoke.

---

## WS-6 — Document session module (API)

**Commit:** `refactor(api): own document session behind one seam`

**Goal:** one module owns open + watch + current-Document scope + change notification. Today: `watchFile` + module-level `currentWatcher` live in `packages/api/index.ts:36-67`, change callbacks live on `SessionStore`, and `src/bun/index.ts` hand-builds `Request` objects against `/documents/open` in three places.

### New file `packages/api/document-session.ts`

```ts
import type { FSWatcher } from "node:fs";
import type { ResultAsync } from "@onrails/result";
import type { DocumentError, OpenDocumentResult } from "./documents.ts";
import type { SessionStore } from "./session.ts";

export type WatchFn = (path: string, listener: (eventType: string) => void) => FSWatcher;

export type DocumentSession = {
  /** Read + record the Document, refresh recents, start watching it. */
  open(path: string): ResultAsync<OpenDocumentResult, DocumentError>;
  /** Asset requests may only reference the currently open Document. */
  isAssetAllowed(docPath: string): boolean;
  /** Fired after the watched Document's content changes on disk. */
  onChange(callback: () => void): void;
  /** Stop the active watcher (idempotent). */
  close(): void;
};

export function createDocumentSession(deps: {
  store: SessionStore;
  watch?: WatchFn; // default: node:fs watch
}): DocumentSession;

export const documentSession: DocumentSession; // singleton over `sessionStore`
```

Implementation:
- `open(path)` = current route body's domain part: `openDocument(path)` → on ok, `store.setDocument({ path }, content)` + start watcher (close previous; the `currentWatcher` state moves inside the instance) → return the result. Watcher callback = current `watchFile` body (`index.ts:47-63`): on `change`, re-read file; if content differs from `store.snapshot().documentContent`, `store.setDocument` + fire `onChange` callbacks (swallow individual callback errors, as `triggerDocumentChange` does).
- `isAssetAllowed(docPath)` = `store.snapshot().document?.path === docPath`.
- Change callbacks move **off** `SessionStore`: delete `onDocumentChange`, `triggerDocumentChange`, and `onDocumentChangeCallbacks` from `session.ts` (grep first: only `bun/index.ts:11` and `index.ts:56` use them).

### Rewiring
- `packages/api/index.ts`: delete `watchFile` + `currentWatcher` + the `node:fs` watch import. `/documents/open` route: `const result = await documentSession.open(parsed.data.path)` then map ok/err exactly as now. `/documents/asset` route: replace the `current !== doc` check with `!documentSession.isAssetAllowed(doc)`. Re-export `documentSession` next to `sessionStore`.
- `src/bun/index.ts`:
  - Replace `sessionStore.onDocumentChange(...)` with `documentSession.onChange(...)` (same body).
  - Replace all **three** hand-built `Request(`${apiBase}/documents/open`)` calls (`handleOpenUrl`, pending-startup block, `openArgvDocument`) with `await documentSession.open(path)` — log `isErr` results with `console.error`. Remove now-unused `apiApp` import if nothing else uses it (check: it's also imported as `app as apiApp` — after this change nothing in `bun/index.ts` should call `apiApp.handle`; drop the import).
- Note: `documentSession.open` inside the same process is equivalent to the route (route adds only Zod parse + HTTP mapping, callers pass literal paths).

### Tests — new `packages/api/document-session.test.ts` + extend `packages/api/api.test.ts`
`document-session.test.ts` (inject a fake `watch`):
- fake `watch` records `(path, listener)` and returns `{ close: spy }`-shaped `FSWatcher` stub.
- `open` on a real temp `.md` file (write via `Bun.write` under a `mkdtemp` dir): ok result, `store.snapshot().document.path` set, watcher started on that path.
- second `open` closes the first watcher (close spy called).
- simulated change: rewrite the temp file, invoke the captured listener with `"change"`, await a tick → store content updated, `onChange` fired once. Unchanged content → `onChange` **not** fired.
- `isAssetAllowed`: true only for the open Document's exact path; false when nothing open.
- `open` on a missing path → `DocumentNotFound`, no watcher started.

`api.test.ts` additions (via `app.handle`, temp files):
- `POST /documents/open` with missing file → 404 + `code: "DocumentNotFound"`.
- `GET /documents/asset` scope: open temp doc A (with a sibling image file), request asset with `doc` = other path → **403**; `doc` = A + existing `src` → 200; `doc` = A + missing `src` → 404. (This is the security-relevant untested route.)
- `POST /notes/save` then `POST /notes/load` roundtrip through a temp Notes file → same notes back; load of a file with `schemaVersion: 2` → 400 + `code: "InvalidNotesFile"`.
- `POST /notes/:id/replies` and `PATCH /notes/:id/status`: happy path + unknown id → 404.

**Acceptance:** check green; `grep -n "watchFile\|currentWatcher\|onDocumentChange\|triggerDocumentChange" packages src` → only `document-session.ts` internals; `grep -n "documents/open" src/bun/index.ts` → empty.

---

## Documentation side-effects (fold into the relevant commits)

1. **CONTEXT.md** — add one term (WS-4 commit):
   ```markdown
   **Anchor Plan**: the render-ordered assignment of block ids for a Document — the single source of truth for where Anchors can attach and how they are found again.
   _Avoid_: allocator, block-id map
   ```
2. **`.agents/skills/`** — after WS-2/WS-4/WS-5, grep skills for `block-ids`, `display-path`, `recent-path-labels`, `api-guards` and update file references (`grep -rn "block-ids\|display-path\|recent-path-labels\|api-guards" .agents`).
3. **AGENTS.md** — no structural changes needed (layout table stays valid); update only if a grep finds stale filenames.

## Final gate + PR

1. `bun run check` — must be fully green.
2. Manual smoke (if a display is available): `bun run start -- README.md` — open a Document, pin a heading/paragraph/code Note, jump to it from the Notes panel, switch raw/preview, save + load a Notes file, open a doc containing `<div align="center">` + badges + mermaid and confirm pins land on the right blocks.
3. PR: base `main`, head `refactor/deepen-modules`, title `refactor: deepen modules per architecture review`. Body: one section per workstream (problem → change → tests), call out the two bug fixes explicitly (align fence id desync; re-render cursor exhaustion) and the new api route coverage. Assign to the authenticated user (`gh pr create --assignee @me`).

## Commit sequence (recap)

1. `refactor(api): drop dead recents and documents exports`
2. `refactor(ui): drop dead provider branch and api guard`
3. `refactor(ui): merge path display into one module`
4. `refactor(ui): consolidate markdown pipeline seam`
5. `refactor(ui): deepen anchor identity module`
6. `refactor(ui): extract reader session module`
7. `refactor(api): own document session behind one seam`

Each commit compiles, lints, and passes tests on its own.
