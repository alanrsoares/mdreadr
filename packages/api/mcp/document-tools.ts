import { isErr } from "@onrails/result";
import { type BlockAnchor, listDocumentBlocks, resolveBlockText } from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import {
  isSupportedDocumentPath,
  isWorkspacePathAllowed,
  toDocumentHttpError,
  toPathNotAllowedError,
} from "../documents.ts";
import { sessionStore } from "../session.ts";
import { anchorInputSchema, type ToolDefinition, type ToolHandler, toolJson } from "./shared.ts";

export const documentTools: ToolDefinition[] = [
  {
    name: "get_current_document",
    description: "Get the path and content of the currently open document.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "open_document",
    description:
      "Switch mdreadr to a Markdown file by path, making it the current document. Reopening an already-open path just activates its tab (notes/suggestions on it are preserved). Path must be a .md/.markdown file inside the home directory tree (home, ~/Documents, ~/Desktop, or the currently open document's directory). Use this after creating or updating a file the user wants reviewed in mdreadr — it unblocks the workflow where the human would otherwise have to open the file manually.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the Markdown file to open.",
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
    name: "get_document_blocks",
    description:
      "List every anchorable block in the open document, in order, with the exact blockId to use in propose_edit / get_document_block / add_note. Each entry has { kind (heading|paragraph|code), blockId, label, headingPath, language? }. Read the target block's id off this list instead of reconstructing the content-hash id scheme by hand — e.g. to fix a code block under a heading, find the `code` entry whose headingPath ends with that heading.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export const documentToolHandlers: Record<string, ToolHandler> = {
  get_current_document: () => {
    const snapshot = sessionStore.snapshot();
    return toolJson({
      path: snapshot.document?.path ?? null,
      content: snapshot.documentContent ?? null,
      latestSeq: sessionStore.latestSeq(),
    });
  },
  open_document: async (args) => {
    const params = args as { path: string };
    if (!isSupportedDocumentPath(params.path)) {
      return toolJson({
        error: `Unsupported document type: ${params.path}`,
        code: "UnsupportedDocumentType",
      });
    }
    const currentDocumentPath = sessionStore.snapshot().document?.path ?? null;
    if (!isWorkspacePathAllowed(params.path, currentDocumentPath)) {
      return toolJson(toPathNotAllowedError(params.path));
    }
    const result = await documentSession.open(params.path);
    if (isErr(result)) {
      return toolJson(toDocumentHttpError(result.error));
    }
    documentSession.triggerChange();
    return toolJson({
      path: result.value.path,
      content: result.value.content,
      latestSeq: sessionStore.latestSeq(),
    });
  },
  get_document_block: (args) => {
    const params = args as { anchor: BlockAnchor };
    const snapshot = sessionStore.snapshot();
    const text = snapshot.documentContent
      ? resolveBlockText(snapshot.documentContent, params.anchor)
      : undefined;
    return toolJson({ text: text ?? null });
  },
  get_document_blocks: () => {
    const snapshot = sessionStore.snapshot();
    const blocks = snapshot.documentContent ? listDocumentBlocks(snapshot.documentContent) : [];
    return toolJson({ blocks });
  },
};
