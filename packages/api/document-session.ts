import { type FSWatcher, watch } from "node:fs";
import type { ResultAsync } from "@onrails/result";
import { type DocumentError, type OpenDocumentResult, openDocument } from "./documents.ts";
import { type SessionStore, sessionStore } from "./session.ts";

export type WatchFn = (path: string, listener: (eventType: string) => void) => FSWatcher;

export type DocumentSession = {
  /** Read + record Document, refresh recents, start watching it. */
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
  watch?: WatchFn;
}): DocumentSession {
  const watchFn = deps.watch ?? watch;
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
    onChange(callback) {
      changeCallbacks.push(callback);
    },
    close() {
      stopWatching();
    },
  };
}

export const documentSession: DocumentSession = createDocumentSession({ store: sessionStore });
