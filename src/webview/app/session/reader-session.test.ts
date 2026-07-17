import { describe, expect, test } from "bun:test";
import type { DocumentRef, Note } from "@mdreadr/domain";
import { apiErrorMessage, type ReaderApi, unwrap } from "./reader-api.ts";
import { loadNotesFlow, saveNotesFlow } from "./reader-flows.ts";

const sampleNote: Note = {
  id: "note-1",
  anchor: { kind: "document", blockId: "doc" },
  status: "open",
  replies: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

function createInMemoryReaderApi() {
  const pickQueue: Array<string | null> = [];
  let saveNotesCallCount = 0;
  let savedInput: { path: string; notes: Note[]; document?: DocumentRef } | null = null;
  let loadNotesResult: { notes: Note[]; document?: DocumentRef | null } = {
    notes: [],
    document: null,
  };
  let lastSaveDocumentCall: { path: string; content: string } | null = null;
  let fakeDocumentContent = "";

  const api: ReaderApi = {
    async getSession() {
      return { document: null, documentContent: null, notes: [], homeDirectory: "/home/test" };
    },
    async getRecents() {
      return [];
    },
    async getNotes() {
      return [];
    },
    async openDocument(path) {
      return { path, content: fakeDocumentContent };
    },
    async pickPath() {
      if (pickQueue.length === 0) throw new Error("test bug: no scripted pick left");
      return pickQueue.shift() ?? null;
    },
    async createNote() {},
    async addReply() {
      throw new Error("not exercised by these tests");
    },
    async setNoteStatus() {
      throw new Error("not exercised by these tests");
    },
    async saveNotes(input) {
      saveNotesCallCount += 1;
      savedInput = input;
    },
    async loadNotes() {
      return loadNotesResult;
    },
    async saveDocument(path, content) {
      lastSaveDocumentCall = { path, content };
      fakeDocumentContent = content;
    },
    log() {},
  };

  return {
    api,
    pushPick: (path: string | null) => pickQueue.push(path),
    getSaveNotesCallCount: () => saveNotesCallCount,
    getSavedInput: () => savedInput,
    setLoadNotesResult: (result: { notes: Note[]; document?: DocumentRef | null }) => {
      loadNotesResult = result;
    },
    getLastSaveDocumentCall: () => lastSaveDocumentCall,
  };
}

describe("saveNotesFlow", () => {
  test("cancel: pick returns null -> cancelled, saveNotes not called", async () => {
    const helper = createInMemoryReaderApi();
    helper.pushPick(null);

    const outcome = await saveNotesFlow(helper.api, { notes: [], document: undefined });

    expect(outcome).toEqual({ kind: "cancelled" });
    expect(helper.getSaveNotesCallCount()).toBe(0);
  });

  test("pick returns a path -> saved with the exact notes/document passed through", async () => {
    const helper = createInMemoryReaderApi();
    helper.pushPick("/tmp/notes.json");
    const notes = [sampleNote];
    const document: DocumentRef = { path: "/tmp/doc.md" };

    const outcome = await saveNotesFlow(helper.api, { notes, document });

    expect(outcome).toEqual({ kind: "saved", path: "/tmp/notes.json" });
    expect(helper.getSaveNotesCallCount()).toBe(1);
    expect(helper.getSavedInput()).toEqual({ path: "/tmp/notes.json", notes, document });
  });
});

describe("loadNotesFlow", () => {
  test("cancel: pick returns null -> cancelled", async () => {
    const helper = createInMemoryReaderApi();
    helper.pushPick(null);

    const outcome = await loadNotesFlow(helper.api);

    expect(outcome).toEqual({ kind: "cancelled" });
  });

  test("loaded with a document -> documentPath is set", async () => {
    const helper = createInMemoryReaderApi();
    helper.pushPick("/tmp/notes.json");
    helper.setLoadNotesResult({ notes: [], document: { path: "/tmp/doc.md" } });

    const outcome = await loadNotesFlow(helper.api);

    expect(outcome).toEqual({ kind: "loaded", documentPath: "/tmp/doc.md" });
  });

  test("loaded without a document -> documentPath is null", async () => {
    const helper = createInMemoryReaderApi();
    helper.pushPick("/tmp/notes.json");
    helper.setLoadNotesResult({ notes: [], document: null });

    const outcome = await loadNotesFlow(helper.api);

    expect(outcome).toEqual({ kind: "loaded", documentPath: null });
  });
});

describe("apiErrorMessage", () => {
  test("Eden nested value.error", () => {
    expect(apiErrorMessage({ value: { error: "x" } })).toBe("x");
  });

  test("Eden nested value.message", () => {
    expect(apiErrorMessage({ value: { message: "x" } })).toBe("x");
  });

  test("Eden value as a plain string", () => {
    expect(apiErrorMessage({ value: "x" })).toBe("x");
  });

  test("top-level error field", () => {
    expect(apiErrorMessage({ error: "x" })).toBe("x");
  });

  test("top-level message field", () => {
    expect(apiErrorMessage({ message: "x" })).toBe("x");
  });

  test("Error instance", () => {
    expect(apiErrorMessage(new Error("boom"))).toBe("boom");
  });

  test("plain string", () => {
    expect(apiErrorMessage("just a string")).toBe("just a string");
  });

  test("undefined falls back to a generic message", () => {
    expect(apiErrorMessage(undefined)).toBe("Something went wrong");
  });
});

describe("unwrap", () => {
  test("throws a normalized Error when res.error is set", () => {
    expect(() => unwrap({ data: null, error: { error: "boom" } })).toThrow("boom");
  });

  test("returns data unchanged when there is no error", () => {
    expect(unwrap({ data: { ok: true }, error: null })).toEqual({ ok: true });
  });
});
