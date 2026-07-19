import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { isErr } from "@onrails/result";
import {
  addReply,
  type BlockAnchor,
  createNote,
  createSuggestion,
  type Note,
  resolveBlockText,
  setNoteStatus,
} from "../domain/index.ts";
import { documentSession } from "./document-session.ts";
import { isSaveNotesPathAllowed, writeTextFile } from "./documents.ts";
import { sessionStore } from "./session.ts";

const authorInputSchema = {
  type: "object",
  description: "Who is acting: a human, an AI agent, or the system itself.",
  properties: {
    kind: { type: "string", enum: ["human", "agent", "system"] },
    agentId: {
      type: "string",
      description: "Identifier for the acting agent, if kind is 'agent'.",
    },
  },
  required: ["kind"],
} as const;

const anchorInputSchema = {
  type: "object",
  description: "A reference to one block (or the whole document) in the currently open document.",
  properties: {
    kind: { type: "string", enum: ["document", "heading", "paragraph", "code"] },
    blockId: { type: "string" },
    headingPath: { type: "array", items: { type: "string" } },
    label: { type: "string" },
  },
  required: ["kind", "blockId"],
} as const;

function createMcpServer(): Server {
  const server = new Server(
    {
      name: "mdreadr",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
  registerHandlers(server);
  return server;
}

function registerHandlers(mcpServer: Server) {
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_current_document",
          description: "Get the path and content of the currently open document.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_session_notes",
          description: "Get all notes in the current session.",
          inputSchema: {
            type: "object",
            properties: {},
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
        {
          name: "get_document_block",
          description:
            "Get the current text of one block in the open document, using a note's anchor. Returns null if the anchored block no longer matches (the document changed since the anchor was captured).",
          inputSchema: {
            type: "object",
            properties: {
              anchor: anchorInputSchema,
            },
            required: ["anchor"],
          },
        },
        {
          name: "propose_edit",
          description:
            "Propose a replacement for the text at a block anchor. Never writes the document: the human must explicitly accept it in-app, which applies it to their in-progress Draft, and it only reaches disk once they save.",
          inputSchema: {
            type: "object",
            properties: {
              anchor: anchorInputSchema,
              replacementText: {
                type: "string",
                description: "The proposed replacement text for the anchored block.",
              },
              noteId: {
                type: "string",
                description: "The note/request this suggestion answers, if any.",
              },
              author: {
                ...authorInputSchema,
                description: "The author of the suggestion. Defaults to kind: 'agent'.",
              },
            },
            required: ["anchor", "replacementText"],
          },
        },
        {
          name: "wait_for_activity",
          description:
            "Long-poll for session activity (notes, replies, status changes, suggestions) newer than sinceSeq. Resolves immediately if activity already happened, otherwise waits up to timeoutMs (default 25000) before resolving with an empty events list. Call again with the highest seq seen to keep watching.",
          inputSchema: {
            type: "object",
            properties: {
              sinceSeq: {
                type: "number",
                description: "The highest journal seq already seen. Use 0 to catch everything.",
              },
              timeoutMs: {
                type: "number",
                description: "Max time to wait before resolving with no events. Defaults to 25000.",
              },
            },
            required: ["sinceSeq"],
          },
        },
        {
          name: "get_events",
          description:
            "Non-blocking catch-up read of journal entries newer than sinceSeq. Use this to resume after a reconnect instead of waiting.",
          inputSchema: {
            type: "object",
            properties: {
              sinceSeq: {
                type: "number",
                description: "The highest journal seq already seen. Use 0 to catch everything.",
              },
            },
            required: ["sinceSeq"],
          },
        },
      ],
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "get_current_document") {
      const snapshot = sessionStore.snapshot();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              path: snapshot.document?.path ?? null,
              content: snapshot.documentContent ?? null,
            }),
          },
        ],
      };
    }

    if (request.params.name === "get_session_notes") {
      const snapshot = sessionStore.snapshot();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ notes: snapshot.notes }),
          },
        ],
      };
    }

    if (request.params.name === "add_note") {
      const args = request.params.arguments as unknown as Parameters<typeof createNote>[0];
      const note = createNote({
        anchor: args.anchor,
        body: args.body,
        author: args.author,
        kind: args.kind,
      });
      sessionStore.addNote(note);
      documentSession.triggerChange();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(note),
          },
        ],
      };
    }

    if (request.params.name === "add_reply") {
      const args = request.params.arguments as unknown as { noteId: string } & Parameters<
        typeof addReply
      >[1];
      const notes = sessionStore.getNotes();
      const note = notes.find((n) => n.id === args.noteId);
      if (!note) {
        throw new Error(`Note not found: ${args.noteId}`);
      }
      const updatedNote = addReply(note, {
        body: args.body,
        author: args.author,
      });
      sessionStore.noteReplied(updatedNote);
      documentSession.triggerChange();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(updatedNote),
          },
        ],
      };
    }

    if (request.params.name === "set_note_status") {
      const args = request.params.arguments as unknown as {
        noteId: string;
        status: Parameters<typeof setNoteStatus>[1];
      };
      const notes = sessionStore.getNotes();
      const note = notes.find((n) => n.id === args.noteId);
      if (!note) {
        throw new Error(`Note not found: ${args.noteId}`);
      }
      const updatedNote = setNoteStatus(note, args.status);
      sessionStore.noteStatusChanged(updatedNote);
      documentSession.triggerChange();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(updatedNote),
          },
        ],
      };
    }

    if (request.params.name === "save_session_notes") {
      const args = request.params.arguments as { path: string };
      const documentPath = sessionStore.snapshot().document?.path ?? null;
      if (!isSaveNotesPathAllowed(args.path, documentPath)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Path not allowed: ${args.path}`,
                code: "PathNotAllowed",
              }),
            },
          ],
        };
      }
      const notes = sessionStore.getNotes();
      const content = JSON.stringify({ version: 1, notes }, null, 2);
      const result = await writeTextFile(args.path, content);
      if (isErr(result)) {
        throw new Error(`Failed to save notes: ${result.error.message}`);
      }
      return {
        content: [
          {
            type: "text",
            text: "Saved successfully",
          },
        ],
      };
    }

    if (request.params.name === "get_document_block") {
      const args = request.params.arguments as unknown as { anchor: BlockAnchor };
      const snapshot = sessionStore.snapshot();
      const text = snapshot.documentContent
        ? resolveBlockText(snapshot.documentContent, args.anchor)
        : undefined;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ text: text ?? null }),
          },
        ],
      };
    }

    if (request.params.name === "propose_edit") {
      const args = request.params.arguments as unknown as {
        anchor: BlockAnchor;
        replacementText: string;
        noteId?: string;
        author?: Parameters<typeof createSuggestion>[0]["author"];
      };
      const suggestion = createSuggestion({
        anchor: args.anchor,
        replacementText: args.replacementText,
        noteId: args.noteId,
        author: args.author ?? { kind: "agent" },
      });
      sessionStore.addSuggestion(suggestion);
      documentSession.triggerChange();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(suggestion),
          },
        ],
      };
    }

    if (request.params.name === "wait_for_activity") {
      const args = request.params.arguments as unknown as {
        sinceSeq: number;
        timeoutMs?: number;
      };
      const events = await sessionStore.waitForActivity(args.sinceSeq, args.timeoutMs ?? 25000);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ events }),
          },
        ],
      };
    }

    if (request.params.name === "get_events") {
      const args = request.params.arguments as unknown as { sinceSeq: number };
      const events = sessionStore.getEvents(args.sinceSeq);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ events }),
          },
        ],
      };
    }

    throw new Error(`Tool not found: ${request.params.name}`);
  });
}

/** Test-only entry point: handlers registered but never connected to a transport. */
export const mcpServer = createMcpServer();

type McpSession = { server: Server; transport: WebStandardStreamableHTTPServerTransport };

/**
 * The SDK's Server/transport pair is single-session (Server.connect() throws if
 * called twice). Each real client session gets its own Server+transport instance,
 * keyed by the SDK-generated session id, instead of one global transport reset
 * between requests (which clobbered concurrent clients' state).
 */
const sessions = new Map<string, McpSession>();

function createSession(): McpSession {
  const server = createMcpServer();
  let session: McpSession;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, session);
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  session = { server, transport };
  server.connect(transport).catch(console.error);
  return session;
}

/** Routes a request to its session's transport by `mcp-session-id`, creating a fresh session for header-less (i.e. initialize) requests. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return existing.transport.handleRequest(request);
  }
  const { transport } = createSession();
  return transport.handleRequest(request);
}
