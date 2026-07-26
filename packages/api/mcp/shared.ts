import type { Note, Suggestion } from "../../domain/index.ts";

export const DEFAULT_WAIT_TIMEOUT_MS = 25_000;
export const MAX_WAIT_TIMEOUT_MS = 600_000;
export const REPLY_PREVIEW_LENGTH = 140;

export const authorInputSchema = {
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

export const anchorInputSchema = {
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

export type ToolResult = { content: Array<{ type: "text"; text: string }> };
export type ToolHandler = (args: unknown) => Promise<ToolResult> | ToolResult;
export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** Wraps a tool result payload in the MCP `content` envelope. */
export function toolJson(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/** Compact row for note listings: enough to decide whether to fetch the full thread. */
export function toNoteSummary(note: Note) {
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
export function toSuggestionSummary(suggestion: Suggestion) {
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
