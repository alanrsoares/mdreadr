import { type BlockNode, type InlineNode, parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import type { BlockAnchor } from "../schemas/index.ts";
import {
  blockIdForCode,
  blockIdForHeading,
  blockIdForList,
  blockIdForParagraph,
  blockIdForTable,
  extractHeadings,
  hashBlockContent,
  truncateAnchorLabel,
} from "./markdown.ts";

export type BlockSourceRange = {
  start: number;
  end: number;
};

export type PinnableBlock =
  | { kind: "paragraph"; text: string; range?: BlockSourceRange }
  | { kind: "code"; text: string; language: string | undefined; range?: BlockSourceRange }
  | { kind: "list"; text: string; range?: BlockSourceRange }
  | { kind: "table"; text: string; range?: BlockSourceRange };

export type HeadingStackEntry = { level: number; text: string };

export type HeadingPathResult = { stack: HeadingStackEntry[]; path: string[] };

type ResolveBlockTextOptions = { isPinnableCode?: (language: string | undefined) => boolean };

export const inlineToText = (nodes: InlineNode[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.content;
        case "code":
          return node.content;
        case "break":
          return " ";
        case "link":
        case "bold":
        case "italic":
        case "strikethrough":
          return inlineToText(node.children);
        case "image":
          return node.alt;
        case "citation":
          return node.sourceId;
        default:
          return "";
      }
    })
    .join("");

export type ListNode = Extract<BlockNode, { type: "list" }>;
export type TableNode = Extract<BlockNode, { type: "table" }>;

export function listToText(block: ListNode): string {
  return block.items
    .map((item) =>
      item.children
        .map((child) => (child.type === "paragraph" ? inlineToText(child.children) : ""))
        .join(" ")
        .trim(),
    )
    .join("\n");
}

export function tableToText(block: TableNode): string {
  const headers = block.headers.map((h) => inlineToText(h.children)).join(" | ");
  const rows = block.rows
    .map((row) => row.map((cell) => inlineToText(cell.children)).join(" | "))
    .join("\n");
  return `${headers}\n${rows}`;
}

/**
 * Walks parsed blocks in document order, same shape the reader's AnchorPlan
 * pins against. `isPinnableCode` lets a caller exclude fence languages it
 * renders specially (e.g. mermaid/math) instead of treating them as content;
 * defaults to including every code block.
 */
export function collectPinnableBlocks(
  blocks: BlockNode[],
  isPinnableCode: (language: string | undefined) => boolean = () => true,
): PinnableBlock[] {
  const result: PinnableBlock[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        result.push({
          kind: "paragraph",
          text: inlineToText(block.children),
          range: block.range,
        });
        continue;
      case "codeblock":
        if (isPinnableCode(block.language)) {
          result.push({
            kind: "code",
            text: block.content,
            language: block.language,
            range: block.range,
          });
        }
        continue;
      case "list":
        result.push({
          kind: "list",
          text: listToText(block),
          range: block.range,
        });
        continue;
      case "table":
        result.push({
          kind: "table",
          text: tableToText(block),
          range: block.range,
        });
        continue;
      case "blockquote":
        for (const child of block.children) {
          if (child.type === "paragraph") {
            result.push({
              kind: "paragraph",
              text: inlineToText(child.children),
              range: child.range ?? block.range,
            });
          } else if (child.type === "codeblock" && isPinnableCode(child.language)) {
            result.push({
              kind: "code",
              text: child.content,
              language: child.language,
              range: child.range ?? block.range,
            });
          }
        }
        continue;
    }
  }

  return result;
}

export function headingPathForLevel(
  stack: HeadingStackEntry[],
  level: number,
  text: string,
): HeadingPathResult {
  let next = stack;
  while (next.length > 0 && (next.at(-1)?.level ?? 0) >= level) {
    next = next.slice(0, -1);
  }
  next = [...next, { level, text }];
  return { stack: next, path: next.map((item) => item.text) };
}

function findHeadingSection(
  content: string,
  headingIndex: number,
  level: number,
): string | undefined {
  const lines = content.split("\n");
  let seen = -1;
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(#{1,6})\s+(.+)$/.exec(lines[i]?.trim() ?? "");
    if (!match) continue;

    if (start === -1) {
      seen += 1;
      if (seen === headingIndex) start = i;
      continue;
    }

    const matchLevel = match[1]?.length ?? 1;
    if (matchLevel <= level) {
      end = i;
      break;
    }
  }

  return start === -1 ? undefined : lines.slice(start, end).join("\n");
}

/**
 * Resolves the current text at a block Anchor against markdown content,
 * matching the same block-id assignment the reader's AnchorPlan uses
 * (paragraph/code content hash + occurrence, heading slug). Returns
 * `undefined` when the anchor no longer matches any block (the Document
 * changed since the anchor was captured).
 *
 * Known gap: this parses `content` as-is. The reader pins anchors against
 * `preprocessReaderMarkdown`'s output (GitHub badge rows, `<div align>`
 * wrappers, etc. get rewritten before parsing), so an anchor captured on a
 * heavily-preprocessed section may not resolve here even though it resolves
 * in the UI. Plain paragraphs/headings/code fences are unaffected.
 */
export function resolveBlockText(
  content: string,
  anchor: BlockAnchor,
  options?: ResolveBlockTextOptions,
): string | undefined {
  if (anchor.kind === "document") return content;

  const blocks = parseMarkdown(content, { autolink: "gfm" });
  const pinnable = collectPinnableBlocks(blocks, options?.isPinnableCode);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const listCounts = new Map<string, number>();
  const tableCounts = new Map<string, number>();

  for (const block of pinnable) {
    if (block.kind === "paragraph") {
      const hash = hashBlockContent(block.text);
      const occurrence = paragraphCounts.get(hash) ?? 0;
      paragraphCounts.set(hash, occurrence + 1);
      if (
        anchor.kind === "paragraph" &&
        blockIdForParagraph(block.text, occurrence) === anchor.blockId
      ) {
        return block.text;
      }
      continue;
    }

    if (block.kind === "code") {
      const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
      const occurrence = codeCounts.get(key) ?? 0;
      codeCounts.set(key, occurrence + 1);
      if (
        anchor.kind === "code" &&
        blockIdForCode(block.text, block.language, occurrence) === anchor.blockId
      ) {
        return block.text;
      }
      continue;
    }

    if (block.kind === "list") {
      const hash = hashBlockContent(block.text);
      const occurrence = listCounts.get(hash) ?? 0;
      listCounts.set(hash, occurrence + 1);
      if (anchor.kind === "list" && blockIdForList(block.text, occurrence) === anchor.blockId) {
        return block.text;
      }
      continue;
    }

    if (block.kind === "table") {
      const hash = hashBlockContent(block.text);
      const occurrence = tableCounts.get(hash) ?? 0;
      tableCounts.set(hash, occurrence + 1);
      if (anchor.kind === "table" && blockIdForTable(block.text, occurrence) === anchor.blockId) {
        return block.text;
      }
    }
  }

  if (anchor.kind === "heading") {
    const headings = extractHeadings(content);
    const index = headings.findIndex((entry) => blockIdForHeading(entry) === anchor.blockId);
    if (index === -1) return undefined;
    const entry = headings[index];
    return entry ? findHeadingSection(content, index, entry.level) : undefined;
  }

  return undefined;
}

/**
 * Finds the exact source range [start, end) of a block in markdown content.
 */
export function findBlockRange(
  content: string,
  anchor: BlockAnchor,
  options?: ResolveBlockTextOptions,
): BlockSourceRange | undefined {
  if (anchor.kind === "document") {
    return { start: 0, end: content.length };
  }

  const blocks = parseMarkdown(content, { sourceRanges: true, autolink: "gfm" });

  if (anchor.kind === "heading") {
    const headings = extractHeadings(content);
    const index = headings.findIndex((entry) => blockIdForHeading(entry) === anchor.blockId);
    if (index === -1) return undefined;
    let headingCount = 0;
    for (const block of blocks) {
      if (block.type === "heading") {
        if (headingCount === index) {
          return block.range;
        }
        headingCount += 1;
      }
    }
    return undefined;
  }

  const pinnable = collectPinnableBlocks(blocks, options?.isPinnableCode);
  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const listCounts = new Map<string, number>();
  const tableCounts = new Map<string, number>();

  for (const block of pinnable) {
    if (block.kind === "paragraph") {
      const hash = hashBlockContent(block.text);
      const occurrence = paragraphCounts.get(hash) ?? 0;
      paragraphCounts.set(hash, occurrence + 1);
      if (
        anchor.kind === "paragraph" &&
        blockIdForParagraph(block.text, occurrence) === anchor.blockId
      ) {
        return block.range;
      }
      continue;
    }

    if (block.kind === "code") {
      const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
      const occurrence = codeCounts.get(key) ?? 0;
      codeCounts.set(key, occurrence + 1);
      if (
        anchor.kind === "code" &&
        blockIdForCode(block.text, block.language, occurrence) === anchor.blockId
      ) {
        return block.range;
      }
      continue;
    }

    if (block.kind === "list") {
      const hash = hashBlockContent(block.text);
      const occurrence = listCounts.get(hash) ?? 0;
      listCounts.set(hash, occurrence + 1);
      if (anchor.kind === "list" && blockIdForList(block.text, occurrence) === anchor.blockId) {
        return block.range;
      }
      continue;
    }

    if (block.kind === "table") {
      const hash = hashBlockContent(block.text);
      const occurrence = tableCounts.get(hash) ?? 0;
      tableCounts.set(hash, occurrence + 1);
      if (anchor.kind === "table" && blockIdForTable(block.text, occurrence) === anchor.blockId) {
        return block.range;
      }
    }
  }

  return undefined;
}

/**
 * Resolves the raw markdown source of an anchored block from the document.
 */
export function resolveBlockRawMarkdown(
  content: string,
  anchor: BlockAnchor,
  options?: ResolveBlockTextOptions,
): string | undefined {
  const range = findBlockRange(content, anchor, options);
  if (!range) return undefined;
  return content.slice(range.start, range.end);
}

/**
 * Replaces the exact source range of an anchored block in markdown content.
 */
export function applyBlockEdit(
  content: string,
  anchor: BlockAnchor,
  newBlockMarkdown: string,
  options?: ResolveBlockTextOptions,
): string | undefined {
  const range = findBlockRange(content, anchor, options);
  if (!range) return undefined;
  return `${content.slice(0, range.start)}${newBlockMarkdown}${content.slice(range.end)}`;
}

/** One anchorable block in the open document, ready to hand to propose_edit. */
export type DocumentBlockSummary = {
  kind: "heading" | "paragraph" | "code" | "list" | "table";
  /** The id to put in a BlockAnchor — no client-side hashing required. */
  blockId: string;
  /** Short preview: heading/paragraph text, or a code block's first line. */
  label: string;
  /** Enclosing heading trail (a heading includes itself as the last entry). */
  headingPath: string[];
  /** Fence language, for code blocks only. */
  language?: string;
};

/**
 * Lists every anchorable block in `content` in document order, with the exact
 * `blockId` the reader's AnchorPlan pins against. Lets an agent target a
 * specific block for `propose_edit`/`get_document_block` by reading it off this
 * list instead of reconstructing the content-hash id scheme by hand.
 *
 * Ids stay in parity with `resolveBlockText`: heading ids are index-paired to
 * `extractHeadings` (as the renderer does), and paragraph/code occurrence
 * counts follow the same `collectPinnableBlocks` traversal order.
 */
export function listDocumentBlocks(
  content: string,
  options?: ResolveBlockTextOptions,
): DocumentBlockSummary[] {
  const headings = extractHeadings(content);
  const blocks = parseMarkdown(content, { autolink: "gfm" });
  const isPinnableCode = options?.isPinnableCode ?? (() => true);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const listCounts = new Map<string, number>();
  const tableCounts = new Map<string, number>();
  let headingIndex = 0;
  let headingStack: HeadingStackEntry[] = [];
  const result: DocumentBlockSummary[] = [];

  const walk = (nodes: BlockNode[]): void => {
    for (const block of nodes) {
      switch (block.type) {
        case "heading": {
          const text = inlineToText(block.children);
          const { stack, path } = headingPathForLevel(headingStack, block.level, text);
          headingStack = stack;
          const entry = headings[headingIndex];
          headingIndex += 1;
          const blockId = entry ? blockIdForHeading(entry) : `heading-${headingIndex}`;
          result.push({
            kind: "heading",
            blockId,
            label: truncateAnchorLabel(text),
            headingPath: path,
          });
          continue;
        }
        case "paragraph": {
          const text = inlineToText(block.children);
          const hash = hashBlockContent(text);
          const occurrence = paragraphCounts.get(hash) ?? 0;
          paragraphCounts.set(hash, occurrence + 1);
          result.push({
            kind: "paragraph",
            blockId: blockIdForParagraph(text, occurrence),
            label: truncateAnchorLabel(text),
            headingPath: headingStack.map((item) => item.text),
          });
          continue;
        }
        case "codeblock": {
          if (!isPinnableCode(block.language)) continue;
          const key = hashBlockContent(`${block.language ?? ""}\n${block.content}`);
          const occurrence = codeCounts.get(key) ?? 0;
          codeCounts.set(key, occurrence + 1);
          result.push({
            kind: "code",
            blockId: blockIdForCode(block.content, block.language, occurrence),
            label: truncateAnchorLabel(block.content.split("\n")[0] ?? block.content),
            headingPath: headingStack.map((item) => item.text),
            language: block.language,
          });
          continue;
        }
        case "list": {
          const text = listToText(block);
          const hash = hashBlockContent(text);
          const occurrence = listCounts.get(hash) ?? 0;
          listCounts.set(hash, occurrence + 1);
          result.push({
            kind: "list",
            blockId: blockIdForList(text, occurrence),
            label: truncateAnchorLabel(text),
            headingPath: headingStack.map((item) => item.text),
          });
          continue;
        }
        case "table": {
          const text = tableToText(block);
          const hash = hashBlockContent(text);
          const occurrence = tableCounts.get(hash) ?? 0;
          tableCounts.set(hash, occurrence + 1);
          result.push({
            kind: "table",
            blockId: blockIdForTable(text, occurrence),
            label: truncateAnchorLabel(text),
            headingPath: headingStack.map((item) => item.text),
          });
          continue;
        }
        case "blockquote":
          walk(block.children);
          continue;
      }
    }
  };

  walk(blocks);
  return result;
}
