import type { BlockAnchor, DocumentRef, Note, NoteStatus } from "@mdreadr/domain";
import { api } from "../treaty.ts";

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
  pickPath(input: {
    mode: "open" | "save";
    filters?: string[];
    defaultPath?: string;
  }): Promise<string | null>;
  createNote(input: { anchor: BlockAnchor; body: string }): Promise<void>;
  addReply(noteId: string, body: string): Promise<Note>;
  setNoteStatus(noteId: string, status: NoteStatus): Promise<Note>;
  saveNotes(input: { path: string; notes: Note[]; document?: DocumentRef }): Promise<void>;
  loadNotes(path: string): Promise<{ notes: Note[]; document?: DocumentRef | null }>;
  saveDocument(path: string, content: string): Promise<void>;
  log(message: string): void; // fire-and-forget diagnostics
};

/** Extract a human message from an Eden Treaty error shape (moved from useMutationToast.errorMessage). */
export function apiErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    // Handle Eden Treaty error format and other error shapes
    const anyError = error as Record<string, unknown>;
    if (anyError.value) {
      if (typeof anyError.value === "string") return anyError.value;
      if (typeof anyError.value === "object" && anyError.value !== null) {
        const valObj = anyError.value as Record<string, unknown>;
        if (typeof valObj.error === "string") return valObj.error;
        if (typeof valObj.message === "string") return valObj.message;
      }
    }
    if (typeof anyError.error === "string") return anyError.error;
    if (typeof anyError.message === "string") return anyError.message;
  }

  try {
    return String(error);
  } catch {
    return "Something went wrong";
  }
}

/** Unwrap an Eden Treaty `{ data, error }` result: throws a normalized Error on `error`. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw new Error(apiErrorMessage(res.error));
  return res.data as T;
}

function readPaths(value: unknown): string[] {
  return typeof value === "object" &&
    value !== null &&
    "paths" in value &&
    Array.isArray((value as { paths: unknown }).paths)
    ? (value as { paths: string[] }).paths
    : [];
}

function readOptionalPath(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "path" in value &&
    ((value as { path: unknown }).path === null ||
      typeof (value as { path: unknown }).path === "string")
    ? (value as { path: string | null }).path
    : null;
}

export function createTreatyReaderApi(): ReaderApi {
  return {
    async getSession() {
      return unwrap(await api.session.get());
    },
    async getRecents() {
      const data = unwrap(await api.documents.recent.get());
      return readPaths(data);
    },
    async getNotes() {
      const data = unwrap(await api.notes.get());
      return data?.notes ?? [];
    },
    async openDocument(path) {
      const data = unwrap(await api.documents.open.post({ path }));
      if (!data || "error" in data) throw new Error("Failed to open document");
      return data;
    },
    async pickPath(input) {
      const data = unwrap(
        await api.dialogs.pick.post({
          mode: input.mode,
          filters: input.filters,
          defaultPath: input.defaultPath,
        }),
      );
      return readOptionalPath(data);
    },
    async createNote(input) {
      unwrap(
        await api.notes.post({
          anchor: input.anchor,
          body: input.body,
          author: { kind: "human" },
        }),
      );
    },
    async addReply(noteId, body) {
      const data = unwrap(
        await api.notes({ id: noteId }).replies.post({
          body,
          author: { kind: "human" },
        }),
      );
      if (!data || "error" in data) throw new Error("Failed to add reply");
      return data.note;
    },
    async setNoteStatus(noteId, status) {
      const data = unwrap(await api.notes({ id: noteId }).status.patch({ status }));
      if (!data || "error" in data) throw new Error("Failed to update note status");
      return data.note;
    },
    async saveNotes(input) {
      unwrap(
        await api.notes.save.post({
          path: input.path,
          notes: input.notes,
          document: input.document,
        }),
      );
    },
    async loadNotes(path) {
      const data = unwrap(await api.notes.load.post({ path }));
      if (!data || "error" in data) throw new Error("Failed to load notes");
      return {
        notes: data.notes,
        document: "document" in data ? (data.document ?? null) : null,
      };
    },
    async saveDocument(path, content) {
      unwrap(await api.documents.save.post({ path, content }));
    },
    log(message) {
      void api.log.post({ message }).catch(() => {});
    },
  };
}
