import { match } from "@onrails/pattern";
import { err, ok, type Result } from "@onrails/result";
import type { Author, BlockAnchor, Note, NoteStatus, NotesFile, Reply } from "../schemas/index.ts";
import { NotesFileSchema } from "../schemas/index.ts";

export type NotesDomainError =
  | { _tag: "InvalidNotesFile"; message: string }
  | { _tag: "NoteNotFound"; id: string };

export const newId = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

export function createNote(input: { anchor: BlockAnchor; body: string; author: Author }): Note {
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
    status: "open",
    replies: [reply],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function addReply(note: Note, input: { body: string; author: Author }): Note {
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

export const formatAuthorLabel = (author: Author): string =>
  match(author.kind)
    .with("human", () => "You")
    .with("system", () => "System")
    .with("agent", () => author.agentId ?? "Agent")
    .exhaustive();
