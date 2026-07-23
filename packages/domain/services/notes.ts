import { match } from "@onrails/pattern";
import { err, ok, type Result } from "@onrails/result";
import { NOTES_SCHEMA_VERSION } from "../../../shared/constants.ts";
import type {
  AddReplyInput,
  Author,
  CreateNoteInput,
  DocumentRef,
  Note,
  NoteStatus,
  NotesFile,
  Reply,
} from "../schemas/index.ts";
import { NotesFileSchema } from "../schemas/index.ts";

export type NotesDomainError =
  | { _tag: "InvalidNotesFile"; message: string }
  | { _tag: "NoteNotFound"; id: string };

export const newId = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

export function createNote(input: CreateNoteInput, document?: DocumentRef): Note {
  const timestamp = nowIso();
  const reply: Reply = {
    id: newId(),
    author: input.author,
    body: input.body,
    createdAt: timestamp,
  };

  return {
    id: newId(),
    anchor: input.anchor,
    kind: input.kind ?? "comment",
    status: "open",
    replies: [reply],
    createdAt: timestamp,
    updatedAt: timestamp,
    document,
  };
}

export function addReply(note: Note, input: AddReplyInput): Note {
  const timestamp = nowIso();
  const reply: Reply = {
    id: newId(),
    author: input.author,
    body: input.body,
    createdAt: timestamp,
  };

  return {
    ...note,
    replies: [...note.replies, reply],
    updatedAt: timestamp,
  };
}

export const setNoteStatus = (note: Note, status: NoteStatus): Note => ({
  ...note,
  status,
  updatedAt: nowIso(),
});

export function parseNotesFileJson(raw: unknown): Result<NotesFile, NotesDomainError> {
  const parsed = NotesFileSchema.safeParse(raw);
  return !parsed.success
    ? err({
        _tag: "InvalidNotesFile",
        message: parsed.error.message,
      })
    : ok(parsed.data);
}

export function findNote(notes: Note[], id: string): Result<Note, NotesDomainError> {
  const note = notes.find((item) => item.id === id);
  return !note ? err({ _tag: "NoteNotFound", id }) : ok(note);
}

/**
 * Legacy notes.json files (saved before multi-document support) only carry
 * the file-level `document` ref, not one per note. Stamp it onto any note
 * that doesn't already have its own.
 */
export function backfillNoteDocument(file: NotesFile): NotesFile {
  if (!file.document) return file;
  return {
    ...file,
    notes: file.notes.map((note) => (note.document ? note : { ...note, document: file.document })),
  };
}

/** Shared shape for both the `/notes/save` route and the `save_session_notes`
 * MCP tool, so the two never drift into incompatible notes.json shapes again. */
export function buildNotesFilePayload(document: DocumentRef | undefined, notes: Note[]): NotesFile {
  return { schemaVersion: NOTES_SCHEMA_VERSION, document, notes };
}

export const formatAuthorLabel = (author: Author): string =>
  match(author.kind)
    .with("human", () => "You")
    .with("system", () => "System")
    .with("agent", () => author.agentId ?? "Agent")
    .exhaustive();
