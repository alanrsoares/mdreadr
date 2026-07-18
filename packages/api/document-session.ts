import { type FSWatcher, watch } from "node:fs";
import { errAsync, type ResultAsync } from "@onrails/result";
import {
  type DocumentError,
  type OpenDocumentResult,
  openDocument,
  writeTextFile,
} from "./documents.ts";
import { type SessionStore, sessionStore } from "./session.ts";

export type WatchFn = (path: string, listener: (eventType: string) => void) => FSWatcher;

export type DocumentSaveError =
  | { _tag: "DocumentNotOpen"; path: string }
  | { _tag: "WriteFailed"; message: string };

export type DocumentSession = {
  /** Read + record Document, refresh recents, start watching it. */
  open(path: string): ResultAsync<OpenDocumentResult, DocumentError>;
  /** Asset requests may only reference the currently open Document. */
  isAssetAllowed(docPath: string): boolean;
  /** Persist edited content to the currently open Document. Scope-checked. */
  save(path: string, content: string): ResultAsync<void, DocumentSaveError>;
  /** Fired after the watched Document's content changes on disk. */
  onChange(callback: () => void): void;
  /** Manually trigger change callbacks (e.g., from MCP mutations). */
  triggerChange(): void;
  /** Stop the active watcher (idempotent). */
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
  let currentWatcher: FSWatcher | null = null;
  const changeCallbacks: Array<() => void> = [];

  function stopWatching(): void {
    if (currentWatcher) {
      try {
        currentWatcher.close();
      } catch {}
      currentWatcher = null;
    }
  }

  function startWatching(path: string): void {
    stopWatching();

    try {
      currentWatcher = watchFn(path, async (eventType) => {
        if (eventType !== "change") return;
        try {
          const file = Bun.file(path);
          if (await file.exists()) {
            const newContent = await file.text();
            const snapshot = store.snapshot();
            if (snapshot.documentContent !== newContent) {
              store.setDocument({ path }, newContent);
              for (const callback of changeCallbacks) {
                try {
                  callback();
                } catch {}
              }
            }
          }
        } catch (e) {
          console.error(`Error reading watched file: ${e}`);
        }
      });
    } catch (e) {
      console.error(`Failed to watch file ${path}: ${e}`);
    }
  }

  return {
    open(path) {
      return openDocument(path).map((result) => {
        store.setDocument({ path: result.path }, result.content);
        startWatching(result.path);
        return result;
      });
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
      // re-reads the file and compares it against `store.snapshot().documentContent`.
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
      for (const callback of changeCallbacks) {
        try {
          callback();
        } catch {}
      }
    },
    close() {
      stopWatching();
    },
  };
}

export const documentSession: DocumentSession = createDocumentSession({ store: sessionStore });
