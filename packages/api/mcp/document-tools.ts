import type { McpServer } from "@modelcontextprotocol/server";
import { isErr } from "@onrails/result";
import {
  BlockAnchorSchema,
  listDocumentBlocks,
  OpenDocumentBodySchema,
  resolveBlockText,
} from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import {
  isSupportedDocumentPath,
  isWorkspacePathAllowed,
  toDocumentHttpError,
  toPathNotAllowedError,
} from "../documents.ts";
import { sessionStore } from "../session.ts";
import { defineTool, registerTools, toolJson } from "./shared.ts";

const documentTools = {
  get_current_document: defineTool({
    description: "Get the path and content of the currently open document.",
    inputSchema: {},
    handle: () => {
      const snapshot = sessionStore.snapshot();
      return toolJson({
        path: snapshot.document?.path ?? null,
        content: snapshot.documentContent ?? null,
        latestSeq: sessionStore.latestSeq(),
      });
    },
  }),

  open_document: defineTool({
    description:
      "Switch mdreadr to a Markdown file by path, making it the current document. Reopening an already-open path just activates its tab (notes/suggestions on it are preserved). Path must be a .md/.markdown file inside the home directory tree (home, ~/Documents, ~/Desktop, or the currently open document's directory). Use this after creating or updating a file the user wants reviewed in mdreadr — it unblocks the workflow where the human would otherwise have to open the file manually.",
    inputSchema: {
      path: OpenDocumentBodySchema.shape.path.describe(
        "Absolute path to the Markdown file to open.",
      ),
    },
    handle: async ({ path }) => {
      if (!isSupportedDocumentPath(path)) {
        return toolJson({
          error: `Unsupported document type: ${path}`,
          code: "UnsupportedDocumentType",
        });
      }
      const currentDocumentPath = sessionStore.snapshot().document?.path ?? null;
      if (!isWorkspacePathAllowed(path, currentDocumentPath)) {
        return toolJson(toPathNotAllowedError(path));
      }
      const result = await documentSession.open(path);
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
  }),

  get_document_block: defineTool({
    description:
      "Get the current text of one block in the open document, using a note's anchor. Returns null if the anchored block no longer matches (the document changed since the anchor was captured).",
    inputSchema: { anchor: BlockAnchorSchema },
    handle: ({ anchor }) => {
      const snapshot = sessionStore.snapshot();
      const text = snapshot.documentContent
        ? resolveBlockText(snapshot.documentContent, anchor)
        : undefined;
      return toolJson({ text: text ?? null });
    },
  }),

  get_document_blocks: defineTool({
    description:
      "List every anchorable block in the open document, in order, with the exact blockId to use in propose_edit / get_document_block / add_note. Each entry has { kind (heading|paragraph|code), blockId, label, headingPath, language? }. Read the target block's id off this list instead of reconstructing the content-hash id scheme by hand — e.g. to fix a code block under a heading, find the `code` entry whose headingPath ends with that heading.",
    inputSchema: {},
    handle: () => {
      const snapshot = sessionStore.snapshot();
      const blocks = snapshot.documentContent ? listDocumentBlocks(snapshot.documentContent) : [];
      return toolJson({ blocks });
    },
  }),
};

export function registerDocumentTools(server: McpServer): void {
  registerTools(server, documentTools);
}
