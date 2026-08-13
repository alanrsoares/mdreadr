import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Note, Suggestion } from "../../domain/index.ts";

export const DEFAULT_WAIT_TIMEOUT_MS = 25_000;
export const MAX_WAIT_TIMEOUT_MS = 600_000;
export const REPLY_PREVIEW_LENGTH = 140;

export const sinceSeqSchema = z
  .number()
  .describe("The highest journal seq already seen. Use 0 to catch everything.");

export type ToolResult = { content: Array<{ type: "text"; text: string }> };

export type ZodRawShape = Record<string, z.ZodTypeAny>;

export interface ToolDef<Shape extends ZodRawShape = ZodRawShape> {
  description: string;
  inputSchema: Shape;
  handle(args: z.infer<z.ZodObject<Shape>>, extra?: unknown): Promise<ToolResult> | ToolResult;
}

export const defineTool = <Shape extends ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> => def;

export function registerTools(
  server: McpServer,
  tools: Record<string, ToolDef<ZodRawShape>>,
): void {
  for (const [name, { description, inputSchema, handle }] of Object.entries(tools)) {
    server.registerTool(name, { description, inputSchema }, (args, extra) =>
      handle(args as Parameters<typeof handle>[0], extra),
    );
  }
}

export function getOrThrow<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`${label} not found: ${id}`);
  }
  return item;
}

export const toolJson = (payload: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(payload) }],
});

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

export const toSuggestionSummary = (suggestion: Suggestion) => ({
  id: suggestion.id,
  status: suggestion.status,
  noteId: suggestion.noteId ?? null,
  anchor: suggestion.anchor.label ?? suggestion.anchor.blockId,
  blockId: suggestion.anchor.blockId,
  author: suggestion.author,
  updatedAt: suggestion.updatedAt,
});
