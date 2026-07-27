import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod";
import type { Note, Suggestion } from "../../domain/index.ts";

export const DEFAULT_WAIT_TIMEOUT_MS = 25_000;
export const MAX_WAIT_TIMEOUT_MS = 600_000;
export const REPLY_PREVIEW_LENGTH = 140;

export const sinceSeqSchema = z
  .number()
  .describe("The highest journal seq already seen. Use 0 to catch everything.");

export type ToolResult = { content: Array<{ type: "text"; text: string }> };

/**
 * One MCP tool: schema + handler, with the tool name supplied by its key in a tool map
 * (see `registerTools`). `handle` is declared as a method (not a `handle: (...) => ...`
 * property) so TS checks its parameter bivariantly - that's what lets a `Record<string, ToolDef>`
 * hold entries with different, concrete `Shape`s without collapsing them to `any`.
 */
export interface ToolDef<Shape extends ZodRawShapeCompat = ZodRawShapeCompat> {
  description: string;
  inputSchema: Shape;
  handle(...args: Parameters<ToolCallback<Shape>>): ReturnType<ToolCallback<Shape>>;
}

/** Identity function that anchors `Shape` inference to a single tool's own `inputSchema`. */
export function defineTool<Shape extends ZodRawShapeCompat>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def;
}

/** Registers every tool in a map onto `server`, using each key as the tool name. */
export function registerTools(server: McpServer, tools: Record<string, ToolDef>): void {
  for (const [name, { description, inputSchema, handle }] of Object.entries(tools)) {
    server.registerTool(name, { description, inputSchema }, handle);
  }
}

/** Finds an entity by id in a list, or throws a uniform "<label> not found: <id>" error. */
export function getOrThrow<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`${label} not found: ${id}`);
  }
  return item;
}

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
