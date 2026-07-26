import { isErr } from "@onrails/result";
import { addReply, buildNotesFilePayload, createNote, setNoteStatus } from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import { isWorkspacePathAllowed, toPathNotAllowedError, writeTextFile } from "../documents.ts";
import { sessionStore } from "../session.ts";
import {
  anchorInputSchema,
  authorInputSchema,
  type ToolDefinition,
  type ToolHandler,
  toNoteSummary,
  toolJson,
} from "./shared.ts";

export const noteTools: ToolDefinition[] = [
  {
    name: "get_session_notes",
    description:
      "List notes in the current session as compact summaries (id, kind, status, anchor, reply count, last-reply preview). Use get_note for one full thread; pass verbose: true only when every full thread is really needed.",
    inputSchema: {
      type: "object",
      properties: {
        verbose: {
          type: "boolean",
          description: "Return full notes with complete reply threads. Defaults to false.",
        },
      },
    },
  },
  {
    name: "get_note",
    description: "Get one note by id, with its full reply thread.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "add_note",
    description: "Create a new note on the document.",
    inputSchema: {
      type: "object",
      properties: {
        anchor: { ...anchorInputSchema, description: "The block anchor for the note" },
        body: {
          type: "string",
          description: "The body content of the note",
        },
        author: { ...authorInputSchema, description: "The author of the note" },
        kind: {
          type: "string",
          enum: ["comment", "request"],
          description:
            "'comment' for a question/observation, 'request' for a change ask on the anchored block. Defaults to 'comment'.",
        },
      },
      required: ["anchor", "body", "author"],
    },
  },
  {
    name: "add_reply",
    description: "Add a reply to an existing note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
        },
        body: {
          type: "string",
        },
        author: authorInputSchema,
      },
      required: ["noteId", "body", "author"],
    },
  },
  {
    name: "set_note_status",
    description: "Change the status of a note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["open", "resolved", "wontfix"],
        },
      },
      required: ["noteId", "status"],
    },
  },
  {
    name: "save_session_notes",
    description: "Save session notes to a JSON file on disk.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
        },
      },
      required: ["path"],
    },
  },
];

export const noteToolHandlers: Record<string, ToolHandler> = {
  get_session_notes: (args) => {
    const params = args as { verbose?: boolean };
    const notes = sessionStore.getNotes();
    return toolJson(params.verbose ? { notes } : { notes: notes.map(toNoteSummary) });
  },
  get_note: (args) => {
    const params = args as { noteId: string };
    const note = sessionStore.getNotes().find((n) => n.id === params.noteId);
    if (!note) {
      throw new Error(`Note not found: ${params.noteId}`);
    }
    return toolJson(note);
  },
  add_note: (args) => {
    const params = args as Parameters<typeof createNote>[0];
    const note = createNote(
      {
        anchor: params.anchor,
        body: params.body,
        author: params.author,
        kind: params.kind,
      },
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
  add_reply: (args) => {
    const params = args as { noteId: string } & Parameters<typeof addReply>[1];
    const notes = sessionStore.getNotes();
    const note = notes.find((n) => n.id === params.noteId);
    if (!note) {
      throw new Error(`Note not found: ${params.noteId}`);
    }
    const updatedNote = addReply(note, {
      body: params.body,
      author: params.author,
    });
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
  set_note_status: (args) => {
    const params = args as { noteId: string; status: Parameters<typeof setNoteStatus>[1] };
    const notes = sessionStore.getNotes();
    const note = notes.find((n) => n.id === params.noteId);
    if (!note) {
      throw new Error(`Note not found: ${params.noteId}`);
    }
    const updatedNote = setNoteStatus(note, params.status);
    sessionStore.noteStatusChanged(updatedNote);
    documentSession.triggerChange();
    return toolJson({
      noteId: updatedNote.id,
      status: updatedNote.status,
      updatedAt: updatedNote.updatedAt,
    });
  },
  save_session_notes: async (args) => {
    const params = args as { path: string };
    const documentPath = sessionStore.snapshot().document?.path ?? null;
    if (!isWorkspacePathAllowed(params.path, documentPath)) {
      return toolJson(toPathNotAllowedError(params.path));
    }
    const notes = sessionStore.getNotes();
    const document = sessionStore.snapshot().document ?? undefined;
    const content = JSON.stringify(buildNotesFilePayload(document, notes), null, 2);
    const result = await writeTextFile(params.path, content);
    if (isErr(result)) {
      throw new Error(`Failed to save notes: ${result.error.message}`);
    }
    return { content: [{ type: "text" as const, text: "Saved successfully" }] };
  },
};
