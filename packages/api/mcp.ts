import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { isErr } from "@onrails/result";
import {
  addReply,
  type BlockAnchor,
  createNote,
  createSuggestion,
  listDocumentBlocks,
  type Note,
  nowIso,
  resolveBlockText,
  type Suggestion,
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

export const DEFAULT_WAIT_TIMEOUT_MS = 25_000;
export const MAX_WAIT_TIMEOUT_MS = 600_000;
const REPLY_PREVIEW_LENGTH = 140;

/** Compact row for note listings: enough to decide whether to fetch the full thread. */
function toNoteSummary(note: Note) {
  const lastReply = note.replies.at(-1);
  return {
    id: note.id,
    kind: note.kind,
    status: note.status,
    anchor: note.anchor.label ?? note.anchor.blockId,
    replies: note.replies.length,
    updatedAt: note.updatedAt,
    lastReply: lastReply
      ? {
          author: lastReply.author,
          preview:
            lastReply.body.length > REPLY_PREVIEW_LENGTH
              ? `${lastReply.body.slice(0, REPLY_PREVIEW_LENGTH)}…`
              : lastReply.body,
        }
      : null,
  };
}

/** Compact row for suggestion listings: status + where it lands, without the full replacement text. */
function toSuggestionSummary(suggestion: Suggestion) {
  return {
    id: suggestion.id,
    status: suggestion.status,
    noteId: suggestion.noteId ?? null,
    anchor: suggestion.anchor.label ?? suggestion.anchor.blockId,
    blockId: suggestion.anchor.blockId,
    author: suggestion.author,
    updatedAt: suggestion.updatedAt,
  };
}

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
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
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
          "Long-poll for session activity (notes, replies, status changes, suggestions) newer than sinceSeq. Resolves immediately if activity already happened, otherwise waits up to timeoutMs (default 25000, capped at 600000) before resolving with an empty events list. Call again with the highest seq seen to keep watching. For watching without holding an MCP call open, prefer the HTTP endpoint GET /events/wait?sinceSeq=N&timeoutMs=M on the same server (e.g. from a background curl): it blocks the same way and exits when activity lands.",
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
          "Non-blocking catch-up read of journal entries newer than sinceSeq. Each event carries a `summary` of the entity it touched (note kind/status/last-author, or suggestion status), so you can act without a follow-up read. Response also includes `latestSeq`. Use this to resume after a reconnect instead of waiting.",
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
      {
        name: "get_document_blocks",
        description:
          "List every anchorable block in the open document, in order, with the exact blockId to use in propose_edit / get_document_block / add_note. Each entry has { kind (heading|paragraph|code), blockId, label, headingPath, language? }. Read the target block's id off this list instead of reconstructing the content-hash id scheme by hand — e.g. to fix a code block under a heading, find the `code` entry whose headingPath ends with that heading.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_suggestions",
        description:
          "List edit suggestions (propose_edit results) as compact rows (id, status, anchor, noteId, author). Status is pending → accepted → completed (landed on disk) or rejected. After a suggestion_status_changed event, call this (or get_suggestion) to learn whether the human accepted or rejected your proposal. Pass verbose: true for full suggestions including replacementText.",
        inputSchema: {
          type: "object",
          properties: {
            verbose: {
              type: "boolean",
              description:
                "Return full suggestions including replacementText and anchor. Defaults to false.",
            },
          },
        },
      },
      {
        name: "get_suggestion",
        description: "Get one suggestion by id, including its replacementText, anchor, and status.",
        inputSchema: {
          type: "object",
          properties: {
            suggestionId: {
              type: "string",
            },
          },
          required: ["suggestionId"],
        },
      },
    ],
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
      case "get_current_document": {
        const snapshot = sessionStore.snapshot();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                path: snapshot.document?.path ?? null,
                content: snapshot.documentContent ?? null,
                latestSeq: sessionStore.latestSeq(),
              }),
            },
          ],
        };
      }
      case "get_session_notes": {
        const args = (request.params.arguments ?? {}) as { verbose?: boolean };
        const notes = sessionStore.getNotes();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(args.verbose ? { notes } : { notes: notes.map(toNoteSummary) }),
            },
          ],
        };
      }
      case "get_note": {
        const args = request.params.arguments as unknown as { noteId: string };
        const note = sessionStore.getNotes().find((n) => n.id === args.noteId);
        if (!note) {
          throw new Error(`Note not found: ${args.noteId}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(note),
            },
          ],
        };
      }
      case "add_note": {
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
              text: JSON.stringify({
                id: note.id,
                kind: note.kind,
                status: note.status,
                createdAt: note.createdAt,
              }),
            },
          ],
        };
      }
      case "add_reply": {
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
        const reply = updatedNote.replies.at(-1);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                noteId: updatedNote.id,
                replyId: reply?.id ?? null,
                replies: updatedNote.replies.length,
                updatedAt: updatedNote.updatedAt,
              }),
            },
          ],
        };
      }
      case "set_note_status": {
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
              text: JSON.stringify({
                noteId: updatedNote.id,
                status: updatedNote.status,
                updatedAt: updatedNote.updatedAt,
              }),
            },
          ],
        };
      }
      case "save_session_notes": {
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
      case "get_document_block": {
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
      case "propose_edit": {
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
              text: JSON.stringify({
                id: suggestion.id,
                noteId: suggestion.noteId ?? null,
                status: suggestion.status,
                author: suggestion.author,
                createdAt: suggestion.createdAt,
              }),
            },
          ],
        };
      }
      case "wait_for_activity": {
        const args = request.params.arguments as unknown as {
          sinceSeq: number;
          timeoutMs?: number;
        };
        const timeoutMs = Math.min(args.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS, MAX_WAIT_TIMEOUT_MS);
        const events = await sessionStore.waitForActivity(args.sinceSeq, timeoutMs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                events: sessionStore.enrichEvents(events),
                latestSeq: sessionStore.latestSeq(),
              }),
            },
          ],
        };
      }
      case "get_events": {
        const args = request.params.arguments as unknown as { sinceSeq: number };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                events: sessionStore.getEnrichedEvents(args.sinceSeq),
                latestSeq: sessionStore.latestSeq(),
              }),
            },
          ],
        };
      }
      case "get_document_blocks": {
        const snapshot = sessionStore.snapshot();
        const blocks = snapshot.documentContent ? listDocumentBlocks(snapshot.documentContent) : [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ blocks }),
            },
          ],
        };
      }
      case "get_suggestions": {
        const args = request.params.arguments as unknown as { verbose?: boolean };
        const suggestions = sessionStore.getSuggestions();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                suggestions: args.verbose ? suggestions : suggestions.map(toSuggestionSummary),
              }),
            },
          ],
        };
      }
      case "get_suggestion": {
        const args = request.params.arguments as unknown as { suggestionId: string };
        const suggestion = sessionStore
          .getSuggestions()
          .find((item) => item.id === args.suggestionId);
        if (!suggestion) {
          throw new Error(`Suggestion not found: ${args.suggestionId}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(suggestion),
            },
          ],
        };
      }
    }

    throw new Error(`Tool not found: ${request.params.name}`);
  });
}

/** Test-only entry point: handlers registered but never connected to a transport. */
export const mcpServer = createMcpServer();

type McpSession = {
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
  connectedAt: string;
  lastSeenAt: number;
};

/**
 * How long a session may go without a routed request before it is treated as
 * gone. Streamable-HTTP clients rarely send an explicit DELETE on disconnect
 * (the SDK only does so via `terminateSession()`), and the transport gives no
 * disconnect callback — so "connected" means "made a request within this
 * window". mdreadr agents long-poll `wait_for_activity` at <=25s, staying live.
 */
const CLIENT_STALE_MS = 60_000;

/** A live MCP client session, as surfaced to the webview status indicator. */
export type ConnectedClient = {
  id: string;
  name: string | null;
  version: string | null;
  connectedAt: string;
};

/**
 * Active MCP client sessions, newest first. Prunes sessions idle longer than
 * `CLIENT_STALE_MS` as a side effect, then reads clientInfo captured at `initialize`.
 */
export function getConnectedClients(): ConnectedClient[] {
  const cutoff = Date.now() - CLIENT_STALE_MS;
  for (const [id, session] of sessions) {
    if (session.lastSeenAt < cutoff) {
      sessions.delete(id);
    }
  }
  return [...sessions.entries()]
    .map(([id, session]) => {
      const info = session.server.getClientVersion();
      return {
        id,
        name: info?.name ?? null,
        version: info?.version ?? null,
        connectedAt: session.connectedAt,
      };
    })
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

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
      sessions.set(sessionId, { ...session, connectedAt: nowIso(), lastSeenAt: Date.now() });
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  session = { server, transport, connectedAt: nowIso(), lastSeenAt: Date.now() };
  server.connect(transport).catch(console.error);
  return session;
}

function normalizeMcpRequest(request: Request): Request {
  const accept = request.headers.get("accept");
  if (!accept?.includes("text/event-stream") || !accept?.includes("application/json")) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set("accept", "application/json, text/event-stream");
    return new Request(request, { headers: newHeaders });
  }
  return request;
}

/** Routes a request to its session's transport by `mcp-session-id`, creating a fresh session for header-less (i.e. initialize) requests. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const req = normalizeMcpRequest(request);
  const sessionId = req.headers.get("mcp-session-id");
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (!existing) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    existing.lastSeenAt = Date.now();
    return existing.transport.handleRequest(req);
  }
  const { transport } = createSession();
  return transport.handleRequest(req);
}
