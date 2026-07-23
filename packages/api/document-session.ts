import { type FSWatcher, watch } from "node:fs";
import { errAsync, okAsync, type ResultAsync } from "@onrails/result";
import {
  createDocument,
  type DocumentError,
  type OpenDocumentResult,
  openDocument,
  writeTextFile,
} from "./documents.ts";
import { SessionStore, sessionStore } from "./session.ts";

export type WatchFn = (path: string, listener: (eventType: string) => void) => FSWatcher;

export type DocumentSaveError =
  | { _tag: "DocumentNotOpen"; path: string }
  | { _tag: "WriteFailed"; message: string };

export type DocumentSession = {
  /** Opens (or activates, if already open) a Document's tab, refreshing recents and watching it. */
  open(path: string): ResultAsync<OpenDocumentResult, DocumentError>;
  /** Write a new Document (e.g. Save As for a dropped/unsaved file), then open it like `open`. */
  createAndOpen(path: string, content: string): ResultAsync<OpenDocumentResult, DocumentError>;
  /** Asset requests may only reference the currently active Document. */
  isAssetAllowed(docPath: string): boolean;
  /** Persist edited content to the currently active Document. Scope-checked. */
  save(path: string, content: string): ResultAsync<void, DocumentSaveError>;
  /** Fired after a watched Document's content changes on disk, with the id of that tab. */
  onChange(callback: (documentId: string) => void): void;
  /** Manually trigger change callbacks (e.g., from MCP mutations) for the active tab. */
  triggerChange(): void;
  /** Stop watching and close a single tab (idempotent). */
  closeTab(id: string): void;
  /** Stop every watcher (idempotent). */
  close(): void;
};

export type CreateDocumentSessionDeps = {
  store: SessionStore;
  watch?: WatchFn;
  writeFile?: (
    path: string,
    content: string,
  ) => ResultAsync<void, { _tag: "WriteFailed"; message: string }>;
};

export function createDocumentSession(deps: CreateDocumentSessionDeps): DocumentSession {
  const watchFn = deps.watch ?? watch;
  const writeFile = deps.writeFile ?? writeTextFile;
  const { store } = deps;
  const watchers = new Map<string, FSWatcher>();
  const changeCallbacks: Array<(documentId: string) => void> = [];

  function stopWatching(id: string): void {
    const watcher = watchers.get(id);
    if (watcher) {
      try {
        watcher.close();
      } catch {}
      watchers.delete(id);
    }
  }

  function startWatching(id: string, path: string): void {
    stopWatching(id);

    try {
      watchers.set(
        id,
        watchFn(path, async (eventType) => {
          if (eventType !== "change") return;
          try {
            const file = Bun.file(path);
            if (await file.exists()) {
              const newContent = await file.text();
              if (store.updateTabContentIfChanged(id, newContent)) {
                for (const callback of changeCallbacks) {
                  try {
                    callback(id);
                  } catch {}
                }
              }
            }
          } catch (e) {
            console.error(`Error reading watched file: ${e}`);
          }
        }),
      );
    } catch (e) {
      console.error(`Failed to watch file ${path}: ${e}`);
    }
  }

  function applyOpenedDocument(id: string, result: OpenDocumentResult): OpenDocumentResult {
    store.openTab(id, { path: result.path }, result.content);
    startWatching(id, result.path);
    return result;
  }

  return {
    open(path) {
      const id = SessionStore.normalizeDocumentId(path);
      const alreadyOpen = store.listTabs().some((tab) => tab.id === id);
      if (alreadyOpen) {
        store.activateTab(id);
        return okAsync({ path, content: store.getTabContent(id) ?? "" });
      }
      return openDocument(path).map((result) => applyOpenedDocument(id, result));
    },
    createAndOpen(path, content) {
      const id = SessionStore.normalizeDocumentId(path);
      return createDocument(path, content).map((result) => applyOpenedDocument(id, result));
    },
    isAssetAllowed(docPath) {
      return store.snapshot().document?.path === docPath;
    },
    save(path, content) {
      const snapshot = store.snapshot();
      if (snapshot.document?.path !== path) {
        return errAsync({ _tag: "DocumentNotOpen", path });
      }

      const previousContent = snapshot.documentContent;
      // Update the store before writing: the file watcher's change handler
      // re-reads the file and compares it against the tab's stored content.
      // Updating the store first makes that comparison equal, so our own save
      // never fires `onChange` (watcher-echo suppression).
      store.setDocument({ path }, content);

      return writeFile(path, content).orElse((error) => {
        store.setDocument({ path }, previousContent ?? "");
        return errAsync(error);
      });
    },
    onChange(callback) {
      changeCallbacks.push(callback);
    },
    triggerChange() {
      const activeId = store.activeTabId ?? "";
      for (const callback of changeCallbacks) {
        try {
          callback(activeId);
        } catch {}
      }
    },
    closeTab(id) {
      stopWatching(id);
      store.closeTab(id);
    },
    close() {
      for (const id of watchers.keys()) stopWatching(id);
    },
  };
}

export const documentSession: DocumentSession = createDocumentSession({ store: sessionStore });
