# Implementation plan — Document editing (write/edit file feature)

**Scope decision (user-confirmed):** human edits the Document in-app via a raw markdown editor (a third view mode next to Preview/Source), with an **explicit save** model (Cmd+S / Save button), a dirty **Draft** buffer, and an unsaved-changes guard. No autosave. No agent-facing write routes. No Note-anchor re-mapping on edit (existing behaviour for externally-changed content applies: stale anchors simply stop matching).

Branch: `feat/document-editing`, created off `refactor/deepen-modules` (this feature builds on the `documentSession` and `ReaderApi` seams from that branch). Three workstreams, in order, one commit each. Gate after every workstream: `bun run check` — **beware: the check script's exit code must be read directly, not through a pipe** (`bun run check; echo "exit=$?"`).

Same ground rules as `.agents/plans/deepen-modules-plan.md` (Bun, `bun:test`, no new deps, no RTL, `@onrails/result`, strict TS, Biome, conventional commits with scope, no AI attribution, CONTEXT.md vocabulary).

---

## WS-1 — Domain: save schema + language

**Commit:** `feat(domain): add document save schema`

`packages/domain/schemas/index.ts`
- Add, next to the other body schemas:
  ```ts
  export const SaveDocumentBodySchema = z.object({
    path: z.string().min(1),
    content: z.string(),
  });
  ```

`CONTEXT.md`
- Add term (keep the existing entry format):
  ```markdown
  **Draft**: the in-memory edited content of the open Document before the user explicitly saves it back to disk. Discarded on switch unless confirmed. _Avoid_: buffer, unsaved changes, dirty state
  ```
- Amend the **Document** entry: it is rendered read-only in Preview/Source, and rewritten on disk only by an explicit save from Edit mode. Keep the sentence terse; do not delete the existing *Avoid* list.

Tests: `packages/domain/domain.test.ts` — `SaveDocumentBodySchema` accepts `{path, content}`, rejects empty path and missing content.

---

## WS-2 — API: save the open Document

**Commit:** `feat(api): save open document route`

### `packages/api/document-session.ts`

Extend the seam:

```ts
export type DocumentSaveError =
  | { _tag: "DocumentNotOpen"; path: string }
  | { _tag: "WriteFailed"; message: string };

export type DocumentSession = {
  // …existing…
  /** Persist edited content to the currently open Document. Scope-checked. */
  save(path: string, content: string): ResultAsync<void, DocumentSaveError>;
};
```

`createDocumentSession(deps)` gains an injectable writer:

```ts
deps: {
  store: SessionStore;
  watch?: WatchFn;
  writeFile?: (path: string, content: string) => ResultAsync<void, { _tag: "WriteFailed"; message: string }>;
  // default: writeTextFile from ./documents.ts
}
```

`save(path, content)` semantics — **exact order matters** (watcher-echo suppression):
1. If `store.snapshot().document?.path !== path` → `errAsync({ _tag: "DocumentNotOpen", path })`.
2. Capture `previousContent = store.snapshot().documentContent`.
3. `store.setDocument({ path }, content)` **before** writing — the file watcher's change handler re-reads the file and compares with `store.snapshot().documentContent`; updating the store first makes the comparison equal, so our own save never fires `onChange`.
4. `writeFile(path, content)`; on failure, restore `store.setDocument({ path }, previousContent ?? "")` and pass the `WriteFailed` through.

### `packages/api/index.ts`

New route after `/documents/asset`:

```
POST /documents/save
```
- Parse body with `SaveDocumentBodySchema` (400 + `code: "ValidationError"` on failure, same shape as sibling routes).
- `await documentSession.save(path, content)`; map errors with `match(error._tag)`: `DocumentNotOpen` → 403 + `{ error: "Only the open Document can be saved", code: "DocumentNotOpen" }`, `WriteFailed` → 500 + `{ error: message, code: "WriteFailed" }`.
- Ok → `{ path }`.

### Tests

`packages/api/document-session.test.ts` (extend, reuse the existing fake-`watch` + temp-`HOME` harness):
- save happy path: open a temp Document, `save` with new content → ok; file on disk has new content (`Bun.file(...).text()`); `store.snapshot().documentContent` is the new content.
- scope: `save` with a path that is not the open Document → `DocumentNotOpen`; nothing written.
- **no watcher echo**: after a successful save, invoke the captured watch listener with `"change"` (file content now equals store content) → `onChange` NOT fired.
- write failure: inject `writeFile` returning `errAsync({_tag:"WriteFailed", message:"disk full"})` → error surfaces AND `store.snapshot().documentContent` is restored to the pre-save content.

`packages/api/api.test.ts` (extend):
- `POST /documents/save` with nothing open → 403 `DocumentNotOpen`.
- open a temp Document via `/documents/open`, save different content → 200 + `{ path }`, disk updated, subsequent `GET /session` returns the new `documentContent`.
- invalid body (missing content) → 400 `ValidationError`.

---

## WS-3 — Webview: Edit mode with explicit save

**Commit:** `feat(ui): edit mode with explicit save`

### `src/webview/app/session/reader-api.ts`
- `ReaderApi` gains `saveDocument(path: string, content: string): Promise<void>`.
- Treaty adapter: `api.documents.save.post({ path, content })`, unwrap like siblings (throw `Error(apiErrorMessage(error))`).
- The in-memory fake in `reader-session.test.ts` gains `saveDocument` (records last call, mutates its fake document content).

### `src/webview/app/session/useReaderSession.ts`
- New mutation `saveDocument` wired like the others: on success invalidate `["session"]`, toast success ("Document saved"), new optional callback `onDocumentSaved?: () => void`.
- Expose `saveDocument: (path: string, content: string) => Promise<void>` and `isSavingDocument: boolean`.

### New file `src/webview/app/session/document-draft.ts` — pure Draft logic (the testable core)

```ts
export type DraftState = {
  /** Path the Draft belongs to; a Draft never survives a Document switch. */
  path: string | null;
  /** null = no edits since open/save. */
  text: string | null;
};

export const emptyDraft: DraftState;
export function editDraft(state: DraftState, path: string, text: string, savedContent: string): DraftState;
  // text === savedContent → clears back to { path, text: null } (typing back to the saved content un-dirties)
export function isDirty(state: DraftState, path: string | undefined): boolean;
  // true only when state.path === path && state.text !== null
export function discardDraft(state: DraftState): DraftState;   // → emptyDraft
export function draftSaved(state: DraftState): DraftState;     // → { path, text: null }
```

Tests — new `src/webview/app/session/document-draft.test.ts`: edit → dirty; edit back to saved content → clean; dirty is path-scoped (dirty for A, false when asked about B); discard/saved transitions; editing with a different path replaces the Draft.

### New file `src/webview/app/components/DocumentEditor.tsx`

```tsx
import { TextArea } from "@astryxdesign/core/TextArea";
```
Controlled raw-markdown editor: props `{ value: string; onChange: (text: string) => void }`. Render `TextArea` full-width/height inside the existing reader body shell (match `RawMarkdownView`'s wrapper approach — use a `ReaderRaw`-like styled container from `ui/reader.tsx`; add a `ReaderEditor` styled wrapper there if needed, monospace via existing tokens, no raw hex/px). Check `TextArea`'s actual props with `bun run astryx -- docs` or the package types before wiring (label, hide-label, rows/auto-grow) and pick the minimal correct set; the editor must fill the document body area and scroll.

### `src/webview/app/components/DocumentViewModeSwitch.tsx`
- `DocumentViewMode = "preview" | "source" | "edit"`.
- Third `SegmentedControlItem` value `"edit"`, label "Edit", tooltip "Edit markdown", icon `PencilSquareIcon` — add the export to `src/webview/app/icons.ts` from `@heroicons/react/24/outline` (follow the existing icon re-export pattern in that file).
- Widen the `selectMode` guard to include `"edit"`.

### `src/webview/app/components/DocumentView.tsx`
- New props: `editorValue: string`, `onEditorChange: (text: string) => void`.
- `viewMode === "edit"` → `<DocumentEditor value={editorValue} onChange={onEditorChange} />`. Keep the mode switch + chrome identical across modes.

### `src/webview/app/pages/ReaderPage.tsx`

State: `const [draft, setDraft] = useState<DraftState>(emptyDraft);`
Derived: `const dirty = isDirty(draft, documentPath);` and `const editorValue = (draft.path === documentPath ? draft.text : null) ?? content;`

Wiring:
- `onEditorChange`: `setDraft((s) => editDraft(s, documentPath!, text, content))` (edit mode is only reachable with a Document open).
- **Save action** `saveDraft`: if `dirty && documentPath` → `await reader.saveDocument(documentPath, draft.text!)`; `onDocumentSaved` callback → `setDraft(draftSaved)`, `setLiveMessage("Document saved")`.
- **Cmd+S**: extend the existing keydown effect (same guard style as Cmd+O): meta/ctrl + `s`, no alt/shift → if `documentViewMode === "edit"`, always `event.preventDefault()`; if `dirty`, call `saveDraft`. Note the Cmd+O handler's input/textarea early-return must NOT apply to Cmd+S (the editor is a textarea; Cmd+S must work while it has focus) — structure the handler accordingly.
- **Save button**: in edit mode, render next to the mode switch inside `ReaderChromeControls` (pass through `DocumentView` as an optional `chromeEnd?: ReactNode` prop, or lift the existing controls—choose the smaller diff): `<Button label="Save" variant="primary" size="sm" isDisabled={!dirty} isLoading={reader.isSavingDocument} onClick={saveDraft} />`.
- **Unsaved-changes guard**: page-level `requestOpen(path: string)` and `requestPick()` wrappers used by every open entry point (RecentsSidebar `onOpen`, drop handler, empty-state/TopNav buttons, Cmd+O). When `dirty`, open an Astryx `Dialog` (`@astryxdesign/core/Dialog` — check its API before use): title "Discard draft?", body names the Document (`pathFileName(draft.path!)`), actions **Discard** (destructive → `setDraft(discardDraft)`, proceed with the pending action) and **Keep editing** (close, do nothing). Store the pending action in a ref. When not dirty, proceed directly.
- **External change while dirty**: effect watching `content`: if it changes while `dirty` (compare against a `prevContentRef`), do NOT touch the Draft; `showError("Document changed on disk", "Your draft is kept. Save to overwrite, or discard to reload.")`. (The session refetch after `mdreadr:open-document` already updates `content`; the Draft shadows it in the editor.)
- Switching to edit mode with no Document open: impossible (mode switch renders only when `content` truthy) — no handling needed.
- TocSidebar: the existing non-preview `EmptyState` branch already covers edit mode; update its copy check (it currently reads "available in preview" — fine as-is).

### Acceptance greps / invariants
- `grep -n "saveDocument" src/webview/app/session/reader-api.ts src/webview/app/session/useReaderSession.ts` — present in both.
- ReaderPage still has no direct `api`/`fetch` usage; all IO via `useReaderSession`.
- No `data:`-style raw hex/px classes introduced (Biome + AGENTS.md styling rules; use existing tokens/styled wrappers).

---

## Final gate

1. `bun run check; echo "exit=$?"` — must print `exit=0`.
2. Vite-dev sanity (the WS that broke last time): `bunx vite --port 5199` in background, then confirm `curl -s http://localhost:5199/app/components/DocumentEditor.tsx` returns 200 and the module graph pulls no `node:*` (crawl script exists at the session scratchpad; a plain `grep -rn "node:" src/webview shared packages/domain --include='*.ts*'` must stay empty outside tests). Kill the server after.
3. Do NOT push or open a PR — commits only. Report per workstream: commit hash, files changed, deviations, final check output.
