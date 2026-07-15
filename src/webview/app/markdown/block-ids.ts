import { type BlockNode, type InlineNode, parseMarkdown } from "@astryxdesign/core/Markdown/utils";
import {
  type BlockAnchor,
  blockIdForCode,
  blockIdForParagraph,
  hashBlockContent,
} from "@mdreadr/domain";

export type BlockIdAllocator = {
  nextParagraphId: (text: string) => string;
  nextCodeId: (code: string, language?: string) => string;
};

function inlineToText(nodes: InlineNode[]): string {
  return nodes
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
}

function isPinnableCodeBlock(language: string | undefined): boolean {
  return language !== "mermaid" && language !== "math" && language !== "badges";
}

function collectPinnableBlocks(
  blocks: BlockNode[],
): Array<
  { kind: "paragraph"; text: string } | { kind: "code"; text: string; language: string | undefined }
> {
  const result: Array<
    | { kind: "paragraph"; text: string }
    | { kind: "code"; text: string; language: string | undefined }
  > = [];

  for (const block of blocks) {
    if (block.type === "paragraph") {
      result.push({ kind: "paragraph", text: inlineToText(block.children) });
      continue;
    }

    if (block.type === "codeblock") {
      if (isPinnableCodeBlock(block.language)) {
        result.push({ kind: "code", text: block.content, language: block.language });
      }
      continue;
    }

    if (block.type === "blockquote") {
      result.push(...collectPinnableBlocks(block.children));
      continue;
    }

    if (block.type === "list") {
      for (const item of block.items) {
        result.push(...collectPinnableBlocks(item.children));
      }
    }
  }

  return result;
}

export function createBlockIdAllocator(preparedMarkdown: string): BlockIdAllocator {
  const blocks = parseMarkdown(preparedMarkdown, { autolink: "gfm" });
  const pinnable = collectPinnableBlocks(blocks);

  const paragraphCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const paragraphIds: string[] = [];
  const codeIds: string[] = [];

  for (const block of pinnable) {
    if (block.kind === "paragraph") {
      const hash = hashBlockContent(block.text);
      const occurrence = paragraphCounts.get(hash) ?? 0;
      paragraphCounts.set(hash, occurrence + 1);
      paragraphIds.push(blockIdForParagraph(block.text, occurrence));
      continue;
    }

    const key = hashBlockContent(`${block.language ?? ""}\n${block.text}`);
    const occurrence = codeCounts.get(key) ?? 0;
    codeCounts.set(key, occurrence + 1);
    codeIds.push(blockIdForCode(block.text, block.language, occurrence));
  }

  let paragraphIndex = 0;
  let codeIndex = 0;

  return {
    nextParagraphId(text: string) {
      const id = paragraphIds[paragraphIndex];
      paragraphIndex += 1;
      return id ?? blockIdForParagraph(text, 0);
    },
    nextCodeId(code: string, language?: string) {
      const id = codeIds[codeIndex];
      codeIndex += 1;
      return id ?? blockIdForCode(code, language, 0);
    },
  };
}

export function scrollToBlock(blockId: string): boolean {
  const element = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!(element instanceof HTMLElement)) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add("reader-block-highlight");
  window.setTimeout(() => {
    element.classList.remove("reader-block-highlight");
  }, 1800);
  return true;
}

export function anchorDisplayLabel(anchor: BlockAnchor): string {
  if (anchor.label?.trim()) return anchor.label.trim();
  if (anchor.headingPath?.length) return anchor.headingPath.join(" › ");
  return anchor.kind;
}
