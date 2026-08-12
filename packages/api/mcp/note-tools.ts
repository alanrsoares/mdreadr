import type { McpServer } from "@modelcontextprotocol/server";
import { isErr } from "@onrails/result";
import { z } from "zod";
import {
  AddReplyBodySchema,
  addReply,
  buildNotesFilePayload,
  CreateNoteBodySchema,
  createNote,
  NoteStatusSchema,
  setNoteStatus,
} from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import { isWorkspacePathAllowed, toPathNotAllowedError, writeTextFile } from "../documents.ts";
import { sessionStore } from "../session.ts";
import { defineTool, getOrThrow, registerTools, toNoteSummary, toolJson } from "./shared.ts";

const noteTools = {
  get_session_notes: defineTool({
    description:
      "List notes in the current session as compact summaries (id, kind, status, anchor, reply count, last-reply preview). Use get_note for one full thread; pass verbose: true only when every full thread is really needed.",
    inputSchema: {
      verbose: z
        .boolean()
        .optional()
        .describe("Return full notes with complete reply threads. Defaults to false."),
    },
    handle: ({ verbose }) => {
      const notes = sessionStore.getNotes();
      return toolJson(verbose ? { notes } : { notes: notes.map(toNoteSummary) });
    },
  }),

  get_note: defineTool({
    description: "Get one note by id, with its full reply thread.",
    inputSchema: { noteId: z.string() },
    handle: ({ noteId }) => {
      const note = getOrThrow(sessionStore.getNotes(), noteId, "Note");
      return toolJson(note);
    },
  }),

  add_note: defineTool({
    description: "Create a new note on the document.",
    inputSchema: {
      anchor: CreateNoteBodySchema.shape.anchor.describe("The block anchor for the note"),
      body: CreateNoteBodySchema.shape.body.describe("The body content of the note"),
      author: CreateNoteBodySchema.shape.author.describe("The author of the note"),
      kind: CreateNoteBodySchema.shape.kind.describe(
        "'comment' for a question/observation, 'request' for a change ask on the anchored block. Defaults to 'comment'.",
      ),
    },
    handle: ({ anchor, body, author, kind }) => {
      const note = createNote(
        { anchor, body, author, kind },
        sessionStore.snapshot().document ?? undefined,
      );
      sessionStore.addNote(note);
      documentSession.triggerChange();
      return toolJson({
        id: note.id,
        kind: note.kind,
        status: note.status,
        createdAt: note.createdAt,
      });
    },
  }),

  add_reply: defineTool({
    description: "Add a reply to an existing note.",
    inputSchema: { noteId: z.string(), ...AddReplyBodySchema.shape },
    handle: ({ noteId, body, author }) => {
      const note = getOrThrow(sessionStore.getNotes(), noteId, "Note");
      const updatedNote = addReply(note, { body, author });
      sessionStore.noteReplied(updatedNote);
      documentSession.triggerChange();
      const reply = updatedNote.replies.at(-1);
      return toolJson({
        noteId: updatedNote.id,
        replyId: reply?.id ?? null,
        replies: updatedNote.replies.length,
        updatedAt: updatedNote.updatedAt,
      });
    },
  }),

  set_note_status: defineTool({
    description: "Change the status of a note.",
    inputSchema: { noteId: z.string(), status: NoteStatusSchema },
    handle: ({ noteId, status }) => {
      const note = getOrThrow(sessionStore.getNotes(), noteId, "Note");
      const updatedNote = setNoteStatus(note, status);
      sessionStore.noteStatusChanged(updatedNote);
      documentSession.triggerChange();
      return toolJson({
        noteId: updatedNote.id,
        status: updatedNote.status,
        updatedAt: updatedNote.updatedAt,
      });
    },
  }),

  save_session_notes: defineTool({
    description: "Save session notes to a JSON file on disk.",
    inputSchema: { path: z.string() },
    handle: async ({ path }) => {
      const documentPath = sessionStore.snapshot().document?.path ?? null;
      if (!isWorkspacePathAllowed(path, documentPath)) {
        return toolJson(toPathNotAllowedError(path));
      }
      const notes = sessionStore.getNotes();
      const document = sessionStore.snapshot().document ?? undefined;
      const content = JSON.stringify(buildNotesFilePayload(document, notes), null, 2);
      const result = await writeTextFile(path, content);
      if (isErr(result)) {
        throw new Error(`Failed to save notes: ${result.error.message}`);
      }
      return { content: [{ type: "text" as const, text: "Saved successfully" }] };
    },
  }),
};

export function registerNoteTools(server: McpServer): void {
  registerTools(server, noteTools);
}
