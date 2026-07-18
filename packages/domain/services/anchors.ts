import { type BlockNode, type InlineNode, parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import type { BlockAnchor } from "../schemas/index.ts";
import {
  blockIdForCode,
  blockIdForHeading,
  blockIdForParagraph,
  extractHeadings,
  hashBlockContent,
} from "./markdown.ts";

export type PinnableBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "code"; text: string; language: string | undefined };

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
        result.push({ kind: "paragraph", text: inlineToText(block.children) });
        continue;
      case "codeblock":
        if (isPinnableCode(block.language)) {
          result.push({ kind: "code", text: block.content, language: block.language });
        }
        continue;
      case "blockquote":
        result.push(...collectPinnableBlocks(block.children, isPinnableCode));
        continue;
      case "list":
        for (const item of block.items) {
          result.push(...collectPinnableBlocks(item.children, isPinnableCode));
        }
        break;
    }
  }

  return result;
}

export function headingPathForLevel(
  stack: { level: number; text: string }[],
  level: number,
  text: string,
): string[] {
  while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= level) {
    stack.pop();
  }
  stack.push({ level, text });
  return stack.map((item) => item.text);
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
  options?: { isPinnableCode?: (language: string | undefined) => boolean },
): string | undefined {
  if (anchor.kind === "document") return content;

  const blocks = parseMarkdown(content, { autolink: "gfm" });
  const pinnable = collectPinnableBlocks(blocks, options?.isPinnableCode);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();

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

    const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
    const occurrence = codeCounts.get(key) ?? 0;
    codeCounts.set(key, occurrence + 1);
    if (
      anchor.kind === "code" &&
      blockIdForCode(block.text, block.language, occurrence) === anchor.blockId
    ) {
      return block.text;
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
